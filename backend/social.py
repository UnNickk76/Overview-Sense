"""Social network — Observations, feed, interactions, comments, follows, profiles.

Interactions replace "likes" entirely: Views, Observed, Discovery, Learned.
Every observation receives a Scientific Value (0-100) computed from real data
completeness and the presence of notable phenomena (planets, ISS, rare events).
"""
import uuid
import math
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import db, UPLOAD_DIR
from auth import get_current_user, get_optional_user

social_router = APIRouter(prefix="/api", tags=["social"])

INTERACTIONS = ("observed", "discovery", "learned")
CATEGORY_PRIORITY = [
    "ISS", "Aurore", "Via Lattea", "Pianeti", "Luna", "Sole",
    "Costellazioni", "Satelliti", "Campo magnetico", "Meteo", "Atmosfera",
    "Listening Layer", "Astronomia",
]


# ---------------------------------------------------------------------------
# Scientific value + categories (derived server-side from real data)
# ---------------------------------------------------------------------------
def compute_scientific_value(data: dict, source: str) -> int:
    if source == "listening":
        score = 40
        if data.get("noiseDb") is not None:
            score += 10
        return max(0, min(100, score))
    d = data or {}
    score = 0
    if d.get("lat") is not None:
        score += 8
    if d.get("altitude") is not None:
        score += 4
    if d.get("cameraAz") is not None:
        score += 6
    if d.get("sun"):
        score += 4
    if d.get("moon"):
        score += 6
    if d.get("weather"):
        score += 6
    if d.get("spaceWeather"):
        score += 6
    score += min(len(d.get("planets") or []) * 5, 20)
    score += min(len(d.get("constellations") or []) * 2, 10)
    if d.get("iss"):
        score += 15
    score += min(len(d.get("satellites") or []), 10)
    sw = d.get("spaceWeather") or {}
    if sw.get("kp") and sw["kp"] >= 5:
        score += 10
    gc = d.get("galacticCenter")
    if gc and gc.get("alt", -90) > 0:
        score += 5
    return max(0, min(100, round(score)))


def derive_categories(data: dict, source: str):
    cats = set(["Astronomia"])
    if source == "listening":
        return "Listening Layer", ["Listening Layer"]
    cats.add("Observation Reality")
    d = data or {}
    if d.get("sun") and d["sun"].get("alt", -90) > 0:
        cats.add("Sole")
    if d.get("moon"):
        cats.add("Luna")
    if d.get("planets"):
        cats.add("Pianeti")
    if d.get("constellations"):
        cats.add("Costellazioni")
    gc = d.get("galacticCenter")
    if gc and gc.get("alt", -90) > 0:
        cats.add("Via Lattea")
    if d.get("iss"):
        cats.add("ISS")
    if d.get("satellites"):
        cats.add("Satelliti")
    sw = d.get("spaceWeather") or {}
    if sw.get("kp") and sw["kp"] >= 5:
        cats.add("Aurore")
    if d.get("weather"):
        cats.add("Meteo")
        cats.add("Atmosfera")
    primary = next((p for p in CATEGORY_PRIORITY if p in cats), "Astronomia")
    return primary, sorted(cats)


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1, math.sqrt(a)))


# ---------------------------------------------------------------------------
# Indexes
# ---------------------------------------------------------------------------
async def ensure_social_indexes():
    await db.observations.create_index("id", unique=True)
    await db.observations.create_index("created_at")
    await db.observations.create_index("user_id")
    await db.interactions.create_index([("user_id", 1), ("obs_id", 1), ("type", 1)], unique=True)
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.comments.create_index("obs_id")


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
def obs_public(o: dict, viewer_interactions: Optional[set] = None) -> dict:
    return {
        "id": o["id"],
        "user_id": o["user_id"],
        "nickname": o.get("nickname"),
        "media_type": o.get("media_type", "image"),
        "source": o.get("source", "reality"),
        "category": o.get("category"),
        "categories": o.get("categories", []),
        "caption": o.get("caption", ""),
        "scientific_value": o.get("scientific_value", 0),
        "image_url": f"/api/media/{o['id']}" if o.get("has_image") else None,
        "lat": o.get("lat"),
        "lon": o.get("lon"),
        "data": o.get("data"),
        "views": o.get("views", 0),
        "observed": o.get("observed", 0),
        "discovery": o.get("discovery", 0),
        "learned": o.get("learned", 0),
        "comments_count": o.get("comments_count", 0),
        "created_at": o.get("created_at"),
        "my_interactions": sorted(viewer_interactions) if viewer_interactions else [],
    }


# ---------------------------------------------------------------------------
# Create observation
# ---------------------------------------------------------------------------
class CreateObs(BaseModel):
    media_type: str = "image"
    source: str = "reality"
    caption: str = ""
    image_base64: Optional[str] = None
    data: Optional[dict] = None


@social_router.post("/observations")
async def create_observation(req: CreateObs, user: dict = Depends(get_current_user)):
    oid = str(uuid.uuid4())
    data = req.data or {}
    has_image = False
    if req.image_base64:
        raw = req.image_base64
        if "," in raw and raw.strip().startswith("data:"):
            raw = raw.split(",", 1)[1]
        try:
            img_bytes = base64.b64decode(raw)
            (UPLOAD_DIR / f"{oid}.jpg").write_bytes(img_bytes)
            has_image = True
        except Exception:
            raise HTTPException(status_code=400, detail="Immagine non valida")

    primary, cats = derive_categories(data, req.source)
    doc = {
        "id": oid,
        "user_id": user["id"],
        "nickname": user["nickname"],
        "media_type": req.media_type,
        "source": req.source,
        "caption": req.caption.strip()[:500],
        "data": data,
        "has_image": has_image,
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "category": primary,
        "categories": cats,
        "scientific_value": compute_scientific_value(data, req.source),
        "views": 0, "observed": 0, "discovery": 0, "learned": 0, "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.observations.insert_one(doc)
    return obs_public(doc, set())


@social_router.get("/media/{obs_id}")
async def get_media(obs_id: str):
    path = UPLOAD_DIR / f"{obs_id}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Media non trovato")
    return FileResponse(str(path), media_type="image/jpeg")


# ---------------------------------------------------------------------------
# Feed  (single global feed with rich filters + smart scoring)
# ---------------------------------------------------------------------------
@social_router.get("/feed")
async def feed(
    category: Optional[str] = None,
    media_type: Optional[str] = None,
    source: Optional[str] = None,
    sort: str = "smart",
    window: Optional[str] = None,       # today | week
    following: bool = False,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_km: float = 100.0,
    limit: int = 60,
    viewer: Optional[dict] = Depends(get_optional_user),
):
    q: dict = {}
    if category:
        q["categories"] = category
    if media_type:
        q["media_type"] = media_type
    if source:
        q["source"] = source
    if window in ("today", "week"):
        delta = timedelta(days=1) if window == "today" else timedelta(days=7)
        since = (datetime.now(timezone.utc) - delta).isoformat()
        q["created_at"] = {"$gte": since}
    if following:
        if not viewer:
            return {"items": []}
        ids = [f["following_id"] async for f in db.follows.find({"follower_id": viewer["id"]})]
        q["user_id"] = {"$in": ids}

    docs = await db.observations.find(q).sort("created_at", -1).to_list(400)

    if lat is not None and lon is not None:
        near = []
        for o in docs:
            if o.get("lat") is not None and o.get("lon") is not None:
                dkm = haversine_km(lat, lon, o["lat"], o["lon"])
                if dkm <= radius_km:
                    o["_dist"] = dkm
                    near.append(o)
        docs = near

    now = datetime.now(timezone.utc)

    def recency(o):
        try:
            t = datetime.fromisoformat(o["created_at"])
            hours = (now - t).total_seconds() / 3600
            return max(0.0, 1.0 - hours / (24 * 14))  # decays over 2 weeks
        except Exception:
            return 0.0

    def smart_score(o):
        sv = o.get("scientific_value", 0) / 100.0
        pop = (o.get("observed", 0) + o.get("discovery", 0) * 1.5 + o.get("learned", 0)) / 20.0
        pop = min(pop, 1.0)
        rare = 0.0
        cats = o.get("categories", [])
        for c in ("ISS", "Aurore", "Via Lattea"):
            if c in cats:
                rare += 0.34
        rare = min(rare, 1.0)
        prox = 0.0
        if "_dist" in o:
            prox = max(0.0, 1.0 - o["_dist"] / max(radius_km, 1))
        return sv * 0.4 + rare * 0.2 + recency(o) * 0.2 + pop * 0.15 + prox * 0.05

    if sort == "recent":
        docs.sort(key=lambda o: o.get("created_at", ""), reverse=True)
    elif sort in ("observed", "discovery", "learned", "views"):
        docs.sort(key=lambda o: o.get(sort, 0), reverse=True)
    elif sort == "scientific":
        docs.sort(key=lambda o: o.get("scientific_value", 0), reverse=True)
    else:  # smart
        docs.sort(key=smart_score, reverse=True)

    docs = docs[:limit]
    my: dict = {}
    if viewer:
        oids = [o["id"] for o in docs]
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
    return {"items": [obs_public(o, my.get(o["id"], set())) for o in docs]}


@social_router.get("/observations/{obs_id}")
async def get_observation(obs_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    o = await db.observations.find_one({"id": obs_id})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    my: set = set()
    if viewer:
        # unique-viewer counting
        try:
            await db.interactions.insert_one({
                "user_id": viewer["id"], "obs_id": obs_id, "type": "view",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            await db.observations.update_one({"id": obs_id}, {"$inc": {"views": 1}})
            o["views"] = o.get("views", 0) + 1
        except Exception:
            pass
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": obs_id}):
            if it["type"] in INTERACTIONS:
                my.add(it["type"])
    author = await db.users.find_one({"id": o["user_id"]})
    result = obs_public(o, my)
    result["author"] = {
        "id": author["id"], "nickname": author["nickname"], "bio": author.get("bio", ""),
        "avatar": author.get("avatar"),
    } if author else None
    return result


# ---------------------------------------------------------------------------
# Interactions  (Observed / Discovery / Learned) — toggle per user
# ---------------------------------------------------------------------------
class InteractReq(BaseModel):
    type: str


@social_router.post("/observations/{obs_id}/interact")
async def interact(obs_id: str, req: InteractReq, user: dict = Depends(get_current_user)):
    t = req.type
    if t not in INTERACTIONS:
        raise HTTPException(status_code=400, detail="Tipo non valido")
    o = await db.observations.find_one({"id": obs_id}, {"id": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    existing = await db.interactions.find_one({"user_id": user["id"], "obs_id": obs_id, "type": t})
    if existing:
        await db.interactions.delete_one({"_id": existing["_id"]})
        await db.observations.update_one({"id": obs_id}, {"$inc": {t: -1}})
        active = False
    else:
        await db.interactions.insert_one({
            "user_id": user["id"], "obs_id": obs_id, "type": t,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.observations.update_one({"id": obs_id}, {"$inc": {t: 1}})
        active = True
    doc = await db.observations.find_one({"id": obs_id})
    return {"active": active, "type": t, "count": doc.get(t, 0)}


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
class CommentReq(BaseModel):
    text: str


@social_router.post("/observations/{obs_id}/comments")
async def add_comment(obs_id: str, req: CommentReq, user: dict = Depends(get_current_user)):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Commento vuoto")
    o = await db.observations.find_one({"id": obs_id}, {"id": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    doc = {
        "id": str(uuid.uuid4()), "obs_id": obs_id, "user_id": user["id"],
        "nickname": user["nickname"], "text": text[:1000],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.comments.insert_one(doc)
    await db.observations.update_one({"id": obs_id}, {"$inc": {"comments_count": 1}})
    doc.pop("_id", None)
    return doc


@social_router.get("/observations/{obs_id}/comments")
async def list_comments(obs_id: str):
    items = await db.comments.find({"obs_id": obs_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"items": items}


# ---------------------------------------------------------------------------
# Follow / profiles
# ---------------------------------------------------------------------------
@social_router.post("/users/{user_id}/follow")
async def follow(user_id: str, user: dict = Depends(get_current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi seguire te stesso")
    target = await db.users.find_one({"id": user_id}, {"id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    try:
        await db.follows.insert_one({
            "follower_id": user["id"], "following_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass
    return {"following": True}


@social_router.delete("/users/{user_id}/follow")
async def unfollow(user_id: str, user: dict = Depends(get_current_user)):
    await db.follows.delete_one({"follower_id": user["id"], "following_id": user_id})
    return {"following": False}


@social_router.get("/users/{user_id}")
async def get_profile(user_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    obs_count = await db.observations.count_documents({"user_id": user_id})
    followers = await db.follows.count_documents({"following_id": user_id})
    following = await db.follows.count_documents({"follower_id": user_id})
    is_following = False
    if viewer:
        is_following = (await db.follows.find_one(
            {"follower_id": viewer["id"], "following_id": user_id})) is not None
    return {
        "id": u["id"], "nickname": u["nickname"], "bio": u.get("bio", ""),
        "avatar": u.get("avatar"), "created_at": u.get("created_at"),
        "stats": {"observations": obs_count, "followers": followers, "following": following},
        "is_following": is_following,
        "is_me": bool(viewer and viewer["id"] == user_id),
    }


@social_router.get("/users/{user_id}/observations")
async def user_observations(user_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    docs = await db.observations.find({"user_id": user_id}).sort("created_at", -1).to_list(200)
    my: dict = {}
    if viewer:
        oids = [o["id"] for o in docs]
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
    return {"items": [obs_public(o, my.get(o["id"], set())) for o in docs]}


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    nickname: Optional[str] = None


@social_router.patch("/users/me")
async def update_me(req: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.bio is not None:
        updates["bio"] = req.bio.strip()[:280]
    if req.nickname is not None:
        nn = req.nickname.strip()
        exists = await db.users.find_one({"nickname_lower": nn.lower(), "id": {"$ne": user["id"]}})
        if exists:
            raise HTTPException(status_code=409, detail="Nickname già in uso")
        updates["nickname"] = nn
        updates["nickname_lower"] = nn.lower()
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]})
    return {"id": u["id"], "nickname": u["nickname"], "bio": u.get("bio", ""), "avatar": u.get("avatar")}
