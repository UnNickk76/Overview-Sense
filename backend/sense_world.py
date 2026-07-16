"""The Sense Collection™ + Observe World™.

Two features that reject traditional social popularity metrics:

- **Sense Collection™**: dynamic (auto-rule) or manual folders of observations
  owned by a user. Visibility: private | friends | public | collaborative.
- **Observe World™**: a system-curated "Living Museum of Reality". Contents are
  promoted ONLY by scientific value, rarity and verification — never by likes or
  popularity. Every item carries honest badges (Reality Score, Scientific Value,
  Verified) instead of like counts.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth import get_current_user, get_optional_user
from social import obs_public, compute_scores
from push import notify

world_router = APIRouter(prefix="/api", tags=["sense-world"])

VISIBILITIES = ("private", "friends", "public", "collaborative")


async def ensure_world_indexes():
    await db.sense_collections.create_index("user_id")
    await db.sense_collections.create_index("visibility")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _are_friends(a: str, b: str) -> bool:
    """Mutual follow = friends."""
    if a == b:
        return True
    f1 = await db.follows.find_one({"follower_id": a, "following_id": b}, {"_id": 1})
    if not f1:
        return False
    f2 = await db.follows.find_one({"follower_id": b, "following_id": a}, {"_id": 1})
    return bool(f2)


async def _can_view(coll: dict, viewer: Optional[dict]) -> bool:
    vis = coll.get("visibility", "private")
    vid = (viewer or {}).get("id")
    if vid == coll["user_id"]:
        return True
    if vid and vid in coll.get("collaborators", []):
        return True
    if vis in ("public", "collaborative"):
        return True
    if vis == "friends" and vid:
        return await _are_friends(vid, coll["user_id"])
    return False


async def _can_edit(coll: dict, viewer: dict) -> bool:
    vid = viewer["id"]
    if vid == coll["user_id"]:
        return True
    if coll.get("visibility") == "collaborative" and vid in coll.get("collaborators", []):
        return True
    return False


async def _resolve_obs_ids(coll: dict) -> List[str]:
    """Manual folders use obs_ids; dynamic folders match an auto_rule against the
    owner's own observations."""
    rule = coll.get("auto_rule")
    if not rule or not rule.get("value"):
        return list(coll.get("obs_ids", []))
    q: dict = {"user_id": coll["user_id"]}
    kind, val = rule.get("type"), rule.get("value")
    if kind == "category":
        q["categories"] = val
    elif kind == "source":
        q["source"] = val
    elif kind == "hashtag":
        q["hashtags"] = val.lstrip("#")
    else:
        return list(coll.get("obs_ids", []))
    ids = [o["id"] async for o in db.observations.find(q, {"id": 1, "_id": 0}).sort("created_at", -1).limit(300)]
    return ids


def _coll_public(coll: dict, count: int, cover_url: Optional[str], is_owner: bool) -> dict:
    return {
        "id": coll["id"],
        "user_id": coll["user_id"],
        "nickname": coll.get("nickname"),
        "title": coll.get("title", ""),
        "description": coll.get("description", ""),
        "visibility": coll.get("visibility", "private"),
        "auto_rule": coll.get("auto_rule"),
        "dynamic": bool(coll.get("auto_rule") and coll["auto_rule"].get("value")),
        "count": count,
        "cover_url": cover_url,
        "collaborators": coll.get("collaborators", []),
        "is_owner": is_owner,
        "created_at": coll.get("created_at"),
        "updated_at": coll.get("updated_at"),
    }


async def _cover_url_for(coll: dict, obs_ids: List[str]) -> Optional[str]:
    cover_id = coll.get("cover_obs_id")
    if not cover_id and obs_ids:
        cover_id = obs_ids[0]
    if not cover_id:
        return None
    o = await db.observations.find_one({"id": cover_id}, {"has_image": 1, "_id": 0})
    if o and o.get("has_image"):
        return f"/api/media/{cover_id}"
    return None


# ---------------------------------------------------------------------------
# Sense Collection™ CRUD
# ---------------------------------------------------------------------------
class CreateCollection(BaseModel):
    title: str
    description: Optional[str] = ""
    visibility: str = "private"
    auto_rule: Optional[dict] = None        # {type: category|source|hashtag, value}
    obs_ids: Optional[List[str]] = None
    cover_obs_id: Optional[str] = None


class UpdateCollection(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    auto_rule: Optional[dict] = None
    cover_obs_id: Optional[str] = None
    collaborators: Optional[List[str]] = None


@world_router.post("/collections")
async def create_collection(req: CreateCollection, user: dict = Depends(get_current_user)):
    if not req.title.strip():
        raise HTTPException(status_code=422, detail="Titolo richiesto")
    vis = req.visibility if req.visibility in VISIBILITIES else "private"
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "nickname": user.get("nickname"),
        "title": req.title.strip()[:80],
        "description": (req.description or "").strip()[:400],
        "visibility": vis,
        "auto_rule": req.auto_rule if (req.auto_rule and req.auto_rule.get("value")) else None,
        "obs_ids": list(dict.fromkeys(req.obs_ids or [])),
        "cover_obs_id": req.cover_obs_id,
        "collaborators": [],
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.sense_collections.insert_one(doc)
    ids = await _resolve_obs_ids(doc)
    return _coll_public(doc, len(ids), await _cover_url_for(doc, ids), True)


@world_router.get("/collections/mine")
async def my_collections(user: dict = Depends(get_current_user)):
    out = []
    async for c in db.sense_collections.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1):
        ids = await _resolve_obs_ids(c)
        out.append(_coll_public(c, len(ids), await _cover_url_for(c, ids), True))
    return {"items": out}


@world_router.get("/users/{user_id}/collections")
async def user_collections(user_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    out = []
    async for c in db.sense_collections.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1):
        if not await _can_view(c, viewer):
            continue
        ids = await _resolve_obs_ids(c)
        out.append(_coll_public(c, len(ids), await _cover_url_for(c, ids), (viewer or {}).get("id") == user_id))
    return {"items": out}


@world_router.get("/collections/{coll_id}")
async def collection_detail(coll_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    c = await db.sense_collections.find_one({"id": coll_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Collection non trovata")
    if not await _can_view(c, viewer):
        raise HTTPException(status_code=403, detail="Collection privata")
    ids = await _resolve_obs_ids(c)
    is_owner = (viewer or {}).get("id") == c["user_id"]
    meta = _coll_public(c, len(ids), await _cover_url_for(c, ids), is_owner)
    items = []
    if ids:
        found = await db.observations.find({"id": {"$in": ids}}, {"_id": 0}).to_list(300)
        by_id = {d["id"]: d for d in found}
        ordered = [by_id[i] for i in ids if i in by_id]
        my: dict = {}
        saved: set = set()
        if viewer:
            async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}):
                my.setdefault(it["obs_id"], set()).add(it["type"])
            async for sv in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}):
                saved.add(sv["obs_id"])
        items = [obs_public(o, my.get(o["id"], set()), o["id"] in saved) for o in ordered]
    return {"collection": meta, "items": items}


@world_router.patch("/collections/{coll_id}")
async def update_collection(coll_id: str, req: UpdateCollection, user: dict = Depends(get_current_user)):
    c = await db.sense_collections.find_one({"id": coll_id})
    if not c:
        raise HTTPException(status_code=404, detail="Collection non trovata")
    if c["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo il proprietario può modificare")
    upd: dict = {"updated_at": _now()}
    if req.title is not None:
        upd["title"] = req.title.strip()[:80]
    if req.description is not None:
        upd["description"] = req.description.strip()[:400]
    if req.visibility is not None and req.visibility in VISIBILITIES:
        upd["visibility"] = req.visibility
    if req.auto_rule is not None:
        upd["auto_rule"] = req.auto_rule if req.auto_rule.get("value") else None
    if req.cover_obs_id is not None:
        upd["cover_obs_id"] = req.cover_obs_id
    if req.collaborators is not None:
        upd["collaborators"] = list(dict.fromkeys(req.collaborators))
    await db.sense_collections.update_one({"id": coll_id}, {"$set": upd})
    c = await db.sense_collections.find_one({"id": coll_id}, {"_id": 0})
    ids = await _resolve_obs_ids(c)
    return _coll_public(c, len(ids), await _cover_url_for(c, ids), True)


@world_router.delete("/collections/{coll_id}")
async def delete_collection(coll_id: str, user: dict = Depends(get_current_user)):
    c = await db.sense_collections.find_one({"id": coll_id}, {"user_id": 1})
    if not c:
        raise HTTPException(status_code=404, detail="Collection non trovata")
    if c["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo il proprietario può eliminare")
    await db.sense_collections.delete_one({"id": coll_id})
    return {"ok": True}


class ItemReq(BaseModel):
    obs_id: str


@world_router.post("/collections/{coll_id}/items")
async def add_item(coll_id: str, req: ItemReq, user: dict = Depends(get_current_user)):
    c = await db.sense_collections.find_one({"id": coll_id})
    if not c:
        raise HTTPException(status_code=404, detail="Collection non trovata")
    if not await _can_edit(c, user):
        raise HTTPException(status_code=403, detail="Non puoi modificare questa collection")
    if c.get("auto_rule") and c["auto_rule"].get("value"):
        raise HTTPException(status_code=400, detail="Le collection dinamiche si aggiornano da sole")
    o = await db.observations.find_one({"id": req.obs_id}, {"id": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    await db.sense_collections.update_one(
        {"id": coll_id}, {"$addToSet": {"obs_ids": req.obs_id}, "$set": {"updated_at": _now()}})
    if c["user_id"] != user["id"]:
        await notify(c["user_id"], "collections", "OverView™",
                     f"@{user['nickname']} ha aggiunto un Senshot a «{c.get('title')}».",
                     action_url=f"/collection?id={coll_id}")
    return {"ok": True}


@world_router.delete("/collections/{coll_id}/items/{obs_id}")
async def remove_item(coll_id: str, obs_id: str, user: dict = Depends(get_current_user)):
    c = await db.sense_collections.find_one({"id": coll_id})
    if not c:
        raise HTTPException(status_code=404, detail="Collection non trovata")
    if not await _can_edit(c, user):
        raise HTTPException(status_code=403, detail="Non puoi modificare questa collection")
    await db.sense_collections.update_one(
        {"id": coll_id}, {"$pull": {"obs_ids": obs_id}, "$set": {"updated_at": _now()}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Observe World™ — curated museum of reality (NO likes, only value)
# ---------------------------------------------------------------------------
def reality_score(o: dict) -> int:
    """Museum ranking — scientific value + rarity + verification ONLY.
    Deliberately ignores popularity (observed/saves/reposts) so that a rare,
    scientifically rich observation is never buried by a popular one."""
    s = compute_scores(o)
    sv = o.get("scientific_value", 0)
    rarity = s["rarity_score"]
    verified = 100 if s["confirmed"] else 0
    ai = o.get("ai_confidence") or 0
    return round(sv * 0.48 + rarity * 0.34 + verified * 0.12 + ai * 0.06)


def world_badges(o: dict) -> List[dict]:
    s = compute_scores(o)
    sv = o.get("scientific_value", 0)
    badges = [{"key": "reality", "label": "Reality Score", "value": reality_score(o)}]
    badges.append({"key": "scientific", "label": "Valore Scientifico", "value": sv})
    if s["confirmed"]:
        badges.append({"key": "verified", "label": "Verificata", "value": None})
    if s["rarity_score"] >= 35:
        badges.append({"key": "rare", "label": "Rara", "value": s["rarity_score"]})
    return badges


# Museum sections — each a real observable category.
WORLD_SECTIONS = [
    {"key": "featured", "title": "In evidenza", "subtitle": "Le realtà più notevoli osservate dalla community"},
    {"key": "Aurore", "title": "Aurore", "subtitle": "Tempeste geomagnetiche rese visibili"},
    {"key": "ISS", "title": "ISS & Satelliti", "subtitle": "Presenze umane sopra di te"},
    {"key": "Via Lattea", "title": "Via Lattea", "subtitle": "Il cuore della nostra galassia"},
    {"key": "Pianeti", "title": "Pianeti", "subtitle": "Mondi del Sistema Solare"},
    {"key": "Cielo Profondo", "title": "Cielo Profondo", "subtitle": "Nebulose, ammassi e galassie"},
    {"key": "Satellite Intelligence", "title": "Osservazione della Terra", "subtitle": "Il pianeta visto dall'alto"},
]

MIN_WORLD_SCORE = 25  # museum admission threshold


async def _rank_docs(q: dict, limit: int, viewer: Optional[dict]) -> List[dict]:
    docs = await db.observations.find({**q, "has_image": True}, {"_id": 0}).sort("created_at", -1).limit(400).to_list(400)
    docs = [o for o in docs if reality_score(o) >= MIN_WORLD_SCORE]
    docs.sort(key=reality_score, reverse=True)
    docs = docs[:limit]
    my: dict = {}
    if viewer and docs:
        oids = [o["id"] for o in docs]
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
    out = []
    for o in docs:
        pub = obs_public(o, my.get(o["id"], set()))
        pub["reality_score"] = reality_score(o)
        pub["world_badges"] = world_badges(o)
        out.append(pub)
    return out


@world_router.get("/observe-world")
async def observe_world(viewer: Optional[dict] = Depends(get_optional_user)):
    """Curated home of the museum — a hero + horizontal sections."""
    sections = []
    for sec in WORLD_SECTIONS:
        if sec["key"] == "featured":
            items = await _rank_docs({}, 12, viewer)
        else:
            items = await _rank_docs({"categories": sec["key"]}, 12, viewer)
        if items:
            sections.append({**sec, "items": items})
    hero = sections[0]["items"][0] if sections and sections[0]["items"] else None
    return {"hero": hero, "sections": sections}


@world_router.get("/observe-world/section/{key}")
async def observe_world_section(key: str, viewer: Optional[dict] = Depends(get_optional_user)):
    if key == "featured":
        items = await _rank_docs({}, 60, viewer)
        title = "In evidenza"
    else:
        items = await _rank_docs({"categories": key}, 60, viewer)
        title = next((s["title"] for s in WORLD_SECTIONS if s["key"] == key), key)
    return {"key": key, "title": title, "items": items}
