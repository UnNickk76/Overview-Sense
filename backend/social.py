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
from fastapi.responses import Response
from pydantic import BaseModel

from database import db
from auth import get_current_user, get_optional_user

social_router = APIRouter(prefix="/api", tags=["social"])


@social_router.get("/cosmos-images")
async def cosmos_images(q: str, limit: int = 8):
    """Real, public-domain imagery for a cosmic object from the NASA Images API."""
    import asyncio
    import json as _json
    import urllib.request
    import urllib.parse
    url = "https://images-api.nasa.gov/search?" + urllib.parse.urlencode(
        {"q": q, "media_type": "image", "page_size": max(1, min(limit, 20))})

    def fetch():
        req = urllib.request.Request(url, headers={"User-Agent": "Overview/1.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            return _json.loads(r.read().decode())

    try:
        data = await asyncio.to_thread(fetch)
    except Exception:
        return {"images": []}
    out = []
    for it in data.get("collection", {}).get("items", []):
        links = it.get("links") or []
        meta = (it.get("data") or [{}])[0]
        href = links[0].get("href") if links else None
        if not href:
            continue
        full = href.replace("~thumb", "~medium").replace("~small", "~medium")
        out.append({
            "thumb": href,
            "image": full,
            "title": meta.get("title", ""),
            "description": (meta.get("description") or "")[:700],
            "center": meta.get("center"),
            "date": meta.get("date_created"),
        })
    return {"images": out}

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
    if source == "satellite":
        d = data or {}
        score = 55
        if d.get("layers"):
            score += min(len(d["layers"]) * 6, 24)
        if d.get("compare_date"):
            score += 12
        if d.get("lat") is not None:
            score += 6
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
    if source == "satellite":
        return "Satellite Intelligence", ["Satellite Intelligence", "Osservazione Terra", "Atmosfera"]
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
    await db.saves.create_index([("user_id", 1), ("obs_id", 1)], unique=True)
    await db.reposts.create_index([("user_id", 1), ("obs_id", 1)], unique=True)
    await db.media.create_index("id", unique=True)


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
def compute_scores(o: dict) -> dict:
    """Composite Overview score — replaces likes with a multi-dimensional value."""
    sv = o.get("scientific_value", 0)
    observed = o.get("observed", 0)
    community = min(100, observed * 2 + o.get("discovery", 0) * 4 + o.get("learned", 0) * 3
                    + o.get("saves_count", 0) * 3 + o.get("repost_count", 0) * 5
                    + o.get("comments_count", 0) * 2)
    cats = o.get("categories", [])
    rarity = 0
    for c, pts in (("ISS", 40), ("Aurore", 45), ("Via Lattea", 35), ("Satellite Intelligence", 25),
                   ("Pianeti", 20), ("Costellazioni", 12)):
        if c in cats:
            rarity += pts
    rarity = min(100, rarity)
    confirmed = observed >= 3
    overall = round(sv * 0.35 + community * 0.30 + rarity * 0.20 + (100 if confirmed else 0) * 0.15)
    return {
        "community_value": community,
        "rarity_score": rarity,
        "confirmed": confirmed,
        "overall_score": max(0, min(100, overall)),
    }


# ---------------------------------------------------------------------------
# Discovery Level — custom cosmic ranks earned through real activity
# ---------------------------------------------------------------------------
DISCOVERY_LEVELS = [
    {"key": "observer", "title": "Observer", "min": 0},
    {"key": "explorer", "title": "Explorer", "min": 40},
    {"key": "seeker", "title": "Seeker", "min": 120},
    {"key": "investigator", "title": "Investigator", "min": 300},
    {"key": "revealer", "title": "Revealer", "min": 700},
    {"key": "sentinel", "title": "Sentinel", "min": 1500},
    {"key": "invisible_sense", "title": "Invisible Sense", "min": 3500},
]


def compute_discovery_level(points: int) -> dict:
    level = DISCOVERY_LEVELS[0]
    nxt = None
    for i, lv in enumerate(DISCOVERY_LEVELS):
        if points >= lv["min"]:
            level = lv
            nxt = DISCOVERY_LEVELS[i + 1] if i + 1 < len(DISCOVERY_LEVELS) else None
    if nxt:
        span = max(1, nxt["min"] - level["min"])
        progress = max(0.0, min(1.0, (points - level["min"]) / span))
    else:
        progress = 1.0
    return {
        "key": level["key"],
        "title": level["title"],
        "points": points,
        "index": DISCOVERY_LEVELS.index(level),
        "total_levels": len(DISCOVERY_LEVELS),
        "next_title": nxt["title"] if nxt else None,
        "next_min": nxt["min"] if nxt else None,
        "progress": round(progress, 3),
    }


def obs_public(o: dict, viewer_interactions: Optional[set] = None,
               saved: bool = False, reposted_by: Optional[str] = None) -> dict:
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
        "ai_confidence": o.get("ai_confidence"),
        "image_url": f"/api/media/{o['id']}" if o.get("has_image") else None,
        "lat": o.get("lat"),
        "lon": o.get("lon"),
        "data": o.get("data"),
        "views": o.get("views", 0),
        "observed": o.get("observed", 0),
        "discovery": o.get("discovery", 0),
        "learned": o.get("learned", 0),
        "comments_count": o.get("comments_count", 0),
        "saves_count": o.get("saves_count", 0),
        "repost_count": o.get("repost_count", 0),
        "created_at": o.get("created_at"),
        "my_interactions": sorted(viewer_interactions) if viewer_interactions else [],
        "my_saved": saved,
        "reposted_by": reposted_by,
        **compute_scores(o),
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
    ai_confidence: Optional[int] = None


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
            base64.b64decode(raw)  # validate
        except Exception:
            raise HTTPException(status_code=400, detail="Immagine non valida")
        # Content moderation: user photos must never contain nudity/explicit content.
        # NASA satellite imagery is public data and skips this check.
        if req.source != "satellite":
            from ai_features import moderate_image_safe
            verdict = await moderate_image_safe(raw)
            if not verdict["safe"]:
                raise HTTPException(
                    status_code=422,
                    detail="Questa immagine non può essere pubblicata: contenuti di nudità o sessualmente espliciti non sono ammessi su Overview.",
                )
        await db.media.insert_one({"id": oid, "content_type": "image/jpeg", "data": raw})
        has_image = True

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
        "ai_confidence": req.ai_confidence,
        "views": 0, "observed": 0, "discovery": 0, "learned": 0,
        "comments_count": 0, "saves_count": 0, "repost_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.observations.insert_one(doc)
    return obs_public(doc, set())


@social_router.get("/media/{obs_id}")
async def get_media(obs_id: str):
    doc = await db.media.find_one({"id": obs_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Media non trovato")
    return Response(content=base64.b64decode(doc["data"]),
                    media_type=doc.get("content_type", "image/jpeg"))


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
        ids = [f["following_id"] async for f in db.follows.find({"follower_id": viewer["id"]}, {"following_id": 1, "_id": 0}).limit(2000)]
        q["user_id"] = {"$in": ids}

    docs = await db.observations.find(q, {"_id": 0}).sort("created_at", -1).limit(400).to_list(400)

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

    # ---- Personalisation: build the viewer's interest profile ----
    # Categories the viewer creates / saves / engages with are boosted in "smart".
    interest: dict = {}
    if viewer and sort == "smart":
        tally: dict = {}
        def _add(cats, w):
            for c in (cats or []):
                tally[c] = tally.get(c, 0.0) + w
        # What they publish is the strongest signal.
        async for o in db.observations.find({"user_id": viewer["id"]}, {"_id": 0, "categories": 1}).limit(200):
            _add(o.get("categories"), 2.0)
        # Saves + interactions.
        eng_ids: set = set()
        async for sv in db.saves.find({"user_id": viewer["id"]}, {"_id": 0, "obs_id": 1}).limit(300):
            eng_ids.add(sv["obs_id"])
        async for it in db.interactions.find({"user_id": viewer["id"]}, {"_id": 0, "obs_id": 1}).limit(500):
            eng_ids.add(it["obs_id"])
        if eng_ids:
            async for o in db.observations.find({"id": {"$in": list(eng_ids)}}, {"_id": 0, "categories": 1}).limit(500):
                _add(o.get("categories"), 1.0)
        if tally:
            mx = max(tally.values())
            interest = {c: v / mx for c, v in tally.items()}

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
        # Personalised affinity: how well this matches the viewer's interests.
        aff = 0.0
        if interest and o.get("user_id") != (viewer or {}).get("id"):
            aff = min(1.0, sum(interest.get(c, 0.0) for c in cats))
        return sv * 0.34 + aff * 0.22 + rare * 0.16 + recency(o) * 0.16 + pop * 0.1 + prox * 0.02

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
    saved: set = set()
    if viewer:
        oids = [o["id"] for o in docs]
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
        async for sv in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            saved.add(sv["obs_id"])
    return {"items": [obs_public(o, my.get(o["id"], set()), o["id"] in saved) for o in docs]}


# ---------------------------------------------------------------------------
# Observation of the Day — highest composite score in the recent window
# ---------------------------------------------------------------------------
@social_router.get("/observation-of-the-day")
async def observation_of_the_day(viewer: Optional[dict] = Depends(get_optional_user)):
    since = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    docs = await db.observations.find({"created_at": {"$gte": since}}, {"_id": 0}).limit(500).to_list(500)
    if not docs:
        docs = await db.observations.find({}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    if not docs:
        return {"observation": None}
    best = max(docs, key=lambda o: compute_scores(o)["overall_score"])
    my: set = set()
    saved = False
    if viewer:
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": best["id"]}):
            if it["type"] in INTERACTIONS:
                my.add(it["type"])
        saved = bool(await db.saves.find_one({"user_id": viewer["id"], "obs_id": best["id"]}))
    return {"observation": obs_public(best, my, saved)}


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
    saved = bool(viewer and await db.saves.find_one({"user_id": viewer["id"], "obs_id": obs_id}))
    author = await db.users.find_one({"id": o["user_id"]})
    result = obs_public(o, my, saved)
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

    # Discovery points from real activity: published observations + interactions received.
    own = await db.observations.find(
        {"user_id": user_id},
        {"observed": 1, "discovery": 1, "learned": 1, "saves_count": 1, "scientific_value": 1, "_id": 0},
    ).to_list(2000)
    tot_observed = sum(o.get("observed", 0) for o in own)
    tot_discovery = sum(o.get("discovery", 0) for o in own)
    tot_learned = sum(o.get("learned", 0) for o in own)
    tot_saves = sum(o.get("saves_count", 0) for o in own)
    avg_sv = (sum(o.get("scientific_value", 0) for o in own) / len(own)) if own else 0
    points = round(
        obs_count * 15 + tot_observed * 2 + tot_discovery * 4 + tot_learned * 3
        + tot_saves * 3 + followers * 3 + avg_sv * (obs_count > 0)
    )

    return {
        "id": u["id"], "nickname": u["nickname"], "bio": u.get("bio", ""),
        "avatar": u.get("avatar"), "created_at": u.get("created_at"),
        "role": u.get("role", "user"),
        "verified_badge": u.get("verified_badge"),
        "protected": u.get("protected", False),
        "stats": {"observations": obs_count, "followers": followers, "following": following},
        "discovery_level": compute_discovery_level(points),
        "is_following": is_following,
        "is_me": bool(viewer and viewer["id"] == user_id),
    }


@social_router.get("/users/{user_id}/observations")
async def user_observations(user_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    own = await db.observations.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    # include reposts made by this user (reference original, tag reposted_by)
    repost_ids = [r["obs_id"] async for r in db.reposts.find({"user_id": user_id}, {"obs_id": 1, "_id": 0}).sort("created_at", -1).limit(200)]
    reposted_docs = []
    if repost_ids:
        found = await db.observations.find({"id": {"$in": repost_ids}}, {"_id": 0}).to_list(200)
        by_id = {d["id"]: d for d in found}
        reposter = await db.users.find_one({"id": user_id})
        rn = reposter["nickname"] if reposter else ""
        for rid in repost_ids:
            if rid in by_id:
                reposted_docs.append((by_id[rid], rn))
    my: dict = {}
    saved: set = set()
    all_ids = [o["id"] for o in own] + [d["id"] for d, _ in reposted_docs]
    if viewer and all_ids:
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": all_ids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
        async for sv in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": all_ids}}):
            saved.add(sv["obs_id"])
    items = [obs_public(o, my.get(o["id"], set()), o["id"] in saved) for o in own]
    items += [obs_public(o, my.get(o["id"], set()), o["id"] in saved, reposted_by=rn) for o, rn in reposted_docs]
    return {"items": items}


# ---------------------------------------------------------------------------
# Save / Collection
# ---------------------------------------------------------------------------
@social_router.post("/observations/{obs_id}/save")
async def save_observation(obs_id: str, user: dict = Depends(get_current_user)):
    o = await db.observations.find_one({"id": obs_id}, {"id": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    existing = await db.saves.find_one({"user_id": user["id"], "obs_id": obs_id})
    if existing:
        await db.saves.delete_one({"_id": existing["_id"]})
        await db.observations.update_one({"id": obs_id}, {"$inc": {"saves_count": -1}})
        return {"saved": False}
    await db.saves.insert_one({"user_id": user["id"], "obs_id": obs_id,
                               "created_at": datetime.now(timezone.utc).isoformat()})
    await db.observations.update_one({"id": obs_id}, {"$inc": {"saves_count": 1}})
    return {"saved": True}


@social_router.get("/users/{user_id}/collection")
async def collection(user_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    ids = [s["obs_id"] async for s in db.saves.find({"user_id": user_id}, {"obs_id": 1, "_id": 0}).sort("created_at", -1).limit(300)]
    if not ids:
        return {"items": []}
    found = await db.observations.find({"id": {"$in": ids}}, {"_id": 0}).to_list(300)
    by_id = {d["id"]: d for d in found}
    ordered = [by_id[i] for i in ids if i in by_id]
    my: dict = {}
    saved_set: set = set()
    if viewer:
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
        async for sv in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}):
            saved_set.add(sv["obs_id"])
    return {"items": [obs_public(o, my.get(o["id"], set()), o["id"] in saved_set) for o in ordered]}


# ---------------------------------------------------------------------------
# Repost
# ---------------------------------------------------------------------------
@social_router.post("/observations/{obs_id}/repost")
async def repost(obs_id: str, user: dict = Depends(get_current_user)):
    o = await db.observations.find_one({"id": obs_id}, {"id": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    existing = await db.reposts.find_one({"user_id": user["id"], "obs_id": obs_id})
    if existing:
        await db.reposts.delete_one({"_id": existing["_id"]})
        await db.observations.update_one({"id": obs_id}, {"$inc": {"repost_count": -1}})
        return {"reposted": False}
    await db.reposts.insert_one({"user_id": user["id"], "obs_id": obs_id,
                                 "created_at": datetime.now(timezone.utc).isoformat()})
    await db.observations.update_one({"id": obs_id}, {"$inc": {"repost_count": 1}})
    return {"reposted": True}


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    nickname: Optional[str] = None


@social_router.patch("/users/me")
async def update_me(req: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.bio is not None:
        updates["bio"] = req.bio.strip()[:280]
    if req.nickname is not None:
        # Protected (developer/founder) accounts have an immutable nickname.
        if user.get("protected") and req.nickname.strip() != user.get("nickname"):
            raise HTTPException(status_code=403, detail="Il nickname di questo account è protetto e non modificabile")
        nn = req.nickname.strip()
        exists = await db.users.find_one({"nickname_lower": nn.lower(), "id": {"$ne": user["id"]}})
        if exists:
            raise HTTPException(status_code=409, detail="Nickname già in uso")
        updates["nickname"] = nn
        updates["nickname_lower"] = nn.lower()
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]})
    return {"id": u["id"], "nickname": u["nickname"], "bio": u.get("bio", ""), "avatar": u.get("avatar")}


class AvatarReq(BaseModel):
    image_base64: str


@social_router.post("/users/me/avatar")
async def update_avatar(req: AvatarReq, user: dict = Depends(get_current_user)):
    raw = req.image_base64
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        base64.b64decode(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Immagine non valida")
    # Avatars must always pass the nudity/obscenity filter.
    from ai_features import moderate_image_safe
    verdict = await moderate_image_safe(raw)
    if not verdict["safe"]:
        raise HTTPException(status_code=422,
                            detail="Questa immagine non può essere usata: contenuti non ammessi su Overview.")
    avatar_id = f"avatar_{user['id']}"
    await db.media.update_one({"id": avatar_id},
                              {"$set": {"id": avatar_id, "content_type": "image/jpeg", "data": raw}},
                              upsert=True)
    avatar_url = f"/api/media/{avatar_id}?v={uuid.uuid4().hex[:8]}"
    await db.users.update_one({"id": user["id"]},
                              {"$set": {"avatar": avatar_url, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"avatar": avatar_url}


# ---------------------------------------------------------------------------
# Activity — interactions received on MY observations + comments + new followers
# ---------------------------------------------------------------------------
@social_router.get("/activity")
async def activity(user: dict = Depends(get_current_user), limit: int = 50):
    obs_ids = [o["id"] async for o in db.observations.find(
        {"user_id": user["id"]}, {"_id": 0, "id": 1}).limit(500)]
    events: List[dict] = []
    if obs_ids:
        async for it in db.interactions.find(
            {"obs_id": {"$in": obs_ids}, "user_id": {"$ne": user["id"]}},
            {"_id": 0}).sort("created_at", -1).limit(150):
            events.append({"kind": it["type"], "actor_id": it["user_id"],
                           "obs_id": it["obs_id"], "created_at": it.get("created_at", ""), "text": None})
        async for c in db.comments.find(
            {"obs_id": {"$in": obs_ids}, "user_id": {"$ne": user["id"]}},
            {"_id": 0}).sort("created_at", -1).limit(80):
            events.append({"kind": "comment", "actor_id": c["user_id"], "actor_nick": c.get("nickname"),
                           "obs_id": c["obs_id"], "created_at": c.get("created_at", ""), "text": c.get("text")})
    async for f in db.follows.find(
            {"following_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(80):
        events.append({"kind": "follow", "actor_id": f["follower_id"],
                       "obs_id": None, "created_at": f.get("created_at", ""), "text": None})

    events.sort(key=lambda e: e.get("created_at", ""), reverse=True)
    events = events[:limit]

    actor_ids = list({e["actor_id"] for e in events})
    users_map = {}
    if actor_ids:
        async for u in db.users.find({"id": {"$in": actor_ids}},
                                     {"_id": 0, "id": 1, "nickname": 1, "avatar": 1}):
            users_map[u["id"]] = u
    for e in events:
        u = users_map.get(e["actor_id"], {})
        e["actor_nickname"] = e.pop("actor_nick", None) or u.get("nickname") or "Qualcuno"
        e["actor_avatar"] = u.get("avatar")
    return {"items": events, "count": len(events)}
