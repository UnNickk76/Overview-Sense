"""Social network — Observations, feed, interactions, comments, follows, profiles.

Interactions replace "likes" entirely: Views, Observed, Discovery, Learned.
Every observation receives a Scientific Value (0-100) computed from real data
completeness and the presence of notable phenomena (planets, ISS, rare events).
"""
import uuid
import math
import re
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from pymongo import UpdateOne

from database import db
from auth import get_current_user, get_optional_user, get_active_user, NICK_RE
import r2_storage
from feedback import get_creator
from push import notify, send_push

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
    await db.observations.create_index("is_pulse")
    # One-time cleanup: remove invalid Pulses (no image) so they never surface.
    try:
        await db.observations.delete_many({"is_pulse": True, "has_image": {"$ne": True}})
    except Exception:
        pass
    await db.interactions.create_index([("user_id", 1), ("obs_id", 1), ("type", 1)], unique=True)
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.comments.create_index("obs_id")
    await db.saves.create_index([("user_id", 1), ("obs_id", 1)], unique=True)
    await db.reposts.create_index([("user_id", 1), ("obs_id", 1)], unique=True)
    await db.media.create_index("id", unique=True)
    # Per-user "already seen" memory (dwell >= 3s) — powers dynamic, non-repetitive ranking.
    await db.obs_views.create_index([("user_id", 1), ("obs_id", 1)], unique=True)
    await db.obs_views.create_index("user_id")
    await db.obs_impressions.create_index([("user_id", 1), ("obs_id", 1)], unique=True)
    await db.obs_impressions.create_index("user_id")


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


# ---------------------------------------------------------------------------
# Go There™ location privacy — 4 sharing levels chosen by the author.
# The RAW capture coordinates never leave the server; public responses expose
# only a deterministically fuzzed position matching the chosen precision.
# ---------------------------------------------------------------------------
GEO_LEVELS = ("none", "area", "approx", "exact")
_GEO_RADIUS_M = {"area": 7000.0, "approx": 300.0}


def _fuzz_coords(oid: str, lat, lon, level: str):
    if lat is None or lon is None:
        return None, None
    if level == "exact":
        return lat, lon
    if level == "none":
        return None, None
    r = _GEO_RADIUS_M.get(level, 300.0)
    seed = int(hashlib.md5(f"{oid}:{level}".encode()).hexdigest()[:8], 16)
    angle = ((seed % 3600) / 10.0) * math.pi / 180.0
    jr = r * (0.5 + (seed % 1000) / 2000.0)  # deterministic radius in [0.5r, r]
    dlat = (jr * math.cos(angle)) / 111320.0
    dlon = (jr * math.sin(angle)) / (111320.0 * max(0.2, math.cos(math.radians(lat))))
    flat, flon = lat + dlat, lon + dlon
    if level == "area":  # snap to a ~0.05° grid → reads as a generic zone
        flat = round(flat / 0.05) * 0.05
        flon = round(flon / 0.05) * 0.05
    return round(flat, 4), round(flon, 4)


def _public_geo(o: dict):
    """Return (pub_lat, pub_lon, sanitized_data) with location privacy applied."""
    data = o.get("data")
    level = (data or {}).get("geoPrecision") or "exact"
    if level not in GEO_LEVELS:
        level = "exact"
    pub_lat, pub_lon = _fuzz_coords(o["id"], o.get("lat"), o.get("lon"), level)
    if data is None:
        return pub_lat, pub_lon, None
    pub = dict(data)
    if "lat" in pub:
        pub["lat"] = pub_lat
    if "lon" in pub:
        pub["lon"] = pub_lon
    pub["geoPrecision"] = level
    if level == "none":
        # No terrestrial viewpoint → Go There™ is unavailable for this Senshot.
        for k in ("cameraAz", "cameraAlt", "altitude"):
            pub.pop(k, None)
    return pub_lat, pub_lon, pub


def obs_public(o: dict, viewer_interactions: Optional[set] = None,
               saved: bool = False, reposted_by: Optional[str] = None) -> dict:
    pub_lat, pub_lon, pub_data = _public_geo(o)
    return {
        "id": o["id"],
        "user_id": o["user_id"],
        "nickname": o.get("nickname"),
        "author_code": o.get("author_code"),
        "avatar": o.get("avatar"),
        "media_type": o.get("media_type", "image"),
        "source": o.get("source", "reality"),
        "kind": o.get("kind", "sense"),
        "category": o.get("category"),
        "categories": o.get("categories", []),
        "caption": o.get("caption", ""),
        "title": o.get("title"),
        "hashtags": o.get("hashtags", []),
        "music": o.get("music"),
        "tagged_users": o.get("tagged_users", []),
        "voice": ({**o["voice"], "url": f"/api/media/{o['voice']['media_id']}"} if o.get("voice") and o["voice"].get("media_id") else None),
        "scientific_value": o.get("scientific_value", 0),
        "ai_confidence": o.get("ai_confidence"),
        "is_pulse": o.get("is_pulse", False),
        "pulse_task": o.get("pulse_task"),
        "image_url": f"/api/media/{o['id']}" if o.get("has_image") else None,
        "lat": pub_lat,
        "lon": pub_lon,
        "data": pub_data,
        "geo_precision": (pub_data or {}).get("geoPrecision", "exact") if pub_data is not None else "exact",
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
    title: Optional[str] = None
    description: Optional[str] = None
    hashtags: Optional[List[str]] = None
    music: Optional[dict] = None
    tagged_users: Optional[List[dict]] = None
    voice: Optional[dict] = None
    image_base64: Optional[str] = None
    data: Optional[dict] = None
    ai_confidence: Optional[int] = None
    is_pulse: bool = False
    pulse_task: Optional[dict] = None
    kind: Optional[str] = None  # "thought" for text-only Pensieri, else Sense


@social_router.post("/observations")
async def create_observation(req: CreateObs, user: dict = Depends(get_active_user)):
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
        if req.is_pulse:
            await r2_storage.put_base64(oid, "pulse", raw, content_type="image/jpeg", owner=user["id"])
        else:
            await r2_storage.put_observation_image(oid, raw, content_type="image/jpeg", owner=user["id"])
        has_image = True

    # ZERO DATA-LOSS SAFETY NET: an image observation must never persist without
    # its media (prevents empty posts / Pulses without an image).
    if req.media_type == "image" and not has_image:
        raise HTTPException(
            status_code=400,
            detail="Immagine mancante: una Sense non può essere pubblicata senza immagine.",
        )

    primary, cats = derive_categories(data, req.source)
    caption = (req.description if req.description is not None else req.caption) or ""
    is_thought = (req.kind == "thought") or (req.media_type == "text" and not has_image)
    if is_thought:
        caption = caption.strip()
        if len(caption) < 1:
            raise HTTPException(status_code=400, detail="Un Pensiero non può essere vuoto.")
        caption = caption[:3000]
    else:
        caption = caption.strip()[:500]
    hashtags = [h.strip().lstrip("#") for h in (req.hashtags or []) if h and h.strip()][:15]
    tagged = [{"id": t.get("id"), "nickname": t.get("nickname")} for t in (req.tagged_users or []) if t.get("id")][:20]
    music = None
    if req.music and (req.music.get("provider_track_id") or req.music.get("audio_id")):
        m = req.music
        music = {
            "provider": m.get("provider", "jamendo"),
            "provider_track_id": m.get("provider_track_id"),
            "audio_id": m.get("audio_id"),           # user-recorded audio → media id
            "title": (m.get("title") or "")[:120],
            "artist": (m.get("artist") or "")[:120],
            "cover_url": m.get("cover_url"),
            "audio_url": m.get("audio_url"),
            "license_url": m.get("license_url"),
            "start": float(m.get("start") or 0),
            "duration": float(m.get("duration") or 0),
        }
    doc = {
        "id": oid,
        "user_id": user["id"],
        "nickname": user["nickname"],
        "author_code": user.get("author_code"),
        "avatar": user.get("avatar"),
        "media_type": req.media_type,
        "source": req.source,
        "kind": "thought" if is_thought else (req.kind or "sense"),
        "caption": caption,
        "title": (req.title or "").strip()[:120] or None,
        "hashtags": hashtags,
        "music": music,
        "tagged_users": tagged,
        "voice": ({"media_id": req.voice.get("media_id"), "duration": float(req.voice.get("duration") or 0)}
                  if req.voice and req.voice.get("media_id") else None),
        "data": data,
        "has_image": has_image,
        "lat": data.get("lat"),
        "lon": data.get("lon"),
        "category": primary,
        "categories": cats,
        "scientific_value": compute_scientific_value(data, req.source),
        "ai_confidence": req.ai_confidence,
        "is_pulse": bool(req.is_pulse),
        "pulse_task": req.pulse_task if req.is_pulse else None,
        "pulse_expires_at": (
            (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            if req.is_pulse else None
        ),
        "views": 0, "observed": 0, "discovery": 0, "learned": 0,
        "comments_count": 0, "saves_count": 0, "repost_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.observations.insert_one(doc)
    return obs_public(doc, set())


@social_router.get("/media/{obs_id}")
async def get_media(obs_id: str, size: Optional[str] = None):
    res = await r2_storage.fetch_bytes(obs_id, size)
    if not res:
        raise HTTPException(status_code=404, detail="Media non trovato")
    content, content_type = res
    return Response(content=content, media_type=content_type,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})


class AudioUpload(BaseModel):
    base64: str
    content_type: str = "audio/m4a"
    duration: Optional[float] = 0


@social_router.post("/media/audio")
async def upload_audio(req: AudioUpload, user: dict = Depends(get_current_user)):
    """Store a short recorded audio clip (voice message / original audio) and return its id.
    We keep only a reference on the observation, never a duplicated copy."""
    raw = req.base64
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    try:
        size = len(base64.b64decode(raw))
    except Exception:
        raise HTTPException(status_code=400, detail="Audio non valido")
    if size > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio troppo lungo (max ~1 min)")
    mid = str(uuid.uuid4())
    await r2_storage.put_base64(mid, "system", raw, content_type=req.content_type,
                               owner=user["id"], kind="audio")
    return {"id": mid, "url": f"/api/media/{mid}", "duration": req.duration}


# ---------------------------------------------------------------------------
# Feed  (single global feed with rich filters + smart scoring)
# ---------------------------------------------------------------------------
class SeenItem(BaseModel):
    id: str
    dwell_ms: int = 0


class SeenBatch(BaseModel):
    items: List[SeenItem]


@social_router.post("/observations/seen")
async def mark_observations_seen(req: SeenBatch, user: dict = Depends(get_current_user)):
    """Record that the viewer actually saw an observation (>= 3s on screen).
    Fuels the "don't re-propose what I've already seen" part of the dynamic feed.
    Author popularity is NEVER involved."""
    now = datetime.now(timezone.utc).isoformat()
    n = 0
    for it in req.items:
        if it.dwell_ms < 3000:
            continue
        await db.obs_views.update_one(
            {"user_id": user["id"], "obs_id": it.id},
            {"$set": {"last_seen_at": now}, "$max": {"dwell_ms": it.dwell_ms},
             "$inc": {"count": 1}, "$setOnInsert": {"first_seen_at": now}},
            upsert=True,
        )
        n += 1
    return {"ok": True, "recorded": n}


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

    # ---- "Already seen" memory: an Observe is "seen" when the viewer spent >=3s
    # on it, opened the full view, OR interacted with it (Apprezza/comment/save/
    # RePost/share/confirmation). Any of these promotes it out of re-proposal. ----
    seen_map: dict = {}      # obs_id -> last_seen datetime
    impr_map: dict = {}      # obs_id -> {"shown": int, "first": datetime, "bucket": int}
    IMPRESSION_CAP = 4       # times an ignored Observe may be re-proposed before muting
    if viewer and sort == "smart":
        async for v in db.obs_views.find({"user_id": viewer["id"]}, {"_id": 0, "obs_id": 1, "last_seen_at": 1}).limit(4000):
            try:
                seen_map[v["obs_id"]] = datetime.fromisoformat(v["last_seen_at"])
            except Exception:
                seen_map[v["obs_id"]] = now
        # Any interaction / save / repost / comment counts as "seen" too.
        for coll in (db.interactions, db.saves, db.reposts):
            async for e in coll.find({"user_id": viewer["id"]}, {"_id": 0, "obs_id": 1}).limit(4000):
                seen_map.setdefault(e["obs_id"], now)
        async for im in db.obs_impressions.find({"user_id": viewer["id"]}, {"_id": 0}).limit(6000):
            try:
                first = datetime.fromisoformat(im.get("first_shown_at"))
            except Exception:
                first = now
            impr_map[im["obs_id"]] = {"shown": im.get("shown", 0), "first": first, "bucket": im.get("last_bucket", -1)}
    # How saturated is each category among fresh content right now — a sparse
    # category is a concrete reason to re-surface an older high-value observation.
    cat_recent: dict = {}
    if sort == "smart":
        for o in docs:
            try:
                if (now - datetime.fromisoformat(o["created_at"])).total_seconds() <= 3 * 86400:
                    for c in (o.get("categories") or []):
                        cat_recent[c] = cat_recent.get(c, 0) + 1
            except Exception:
                pass

    def _age_days(o) -> float:
        try:
            return max(0.0, (now - datetime.fromisoformat(o["created_at"])).total_seconds() / 86400.0)
        except Exception:
            return 999.0

    def recency(o):
        return max(0.0, 1.0 - _age_days(o) / 14.0)  # decays over 2 weeks

    # Fresh-start fairness: every brand-new observation gets an equal initial
    # exposure boost in its first hours, BEFORE any engagement exists — so a
    # first-timer's Observe starts exactly on par with everyone else.
    def fresh_boost(o) -> float:
        try:
            hours = (now - datetime.fromisoformat(o["created_at"])).total_seconds() / 3600.0
        except Exception:
            return 0.0
        if hours < 0:
            hours = 0.0
        return max(0.0, 1.0 - hours / 48.0)  # full at publish, gone after ~48h

    # Second-chance windows: content value doesn't expire the instant it's
    # buried by other excellent Observes. Exposure tapers, it never "dies".
    #   0-3 days  → full        4-10 days → reduced (smart)   >10 days → only with reasons
    def window_mult(o, aff: float) -> float:
        d = _age_days(o)
        if d <= 3:
            return 1.0
        if d <= 10:
            return 0.55
        # Beyond 10 days: shown only if there are concrete reasons.
        reason = 0.0
        if aff >= 0.5:                                   # matches viewer's (new) interests
            reason += 0.5
        cats = o.get("categories") or []
        if cats and min(cat_recent.get(c, 0) for c in cats) <= 1:  # sparse category right now
            reason += 0.4
        if o.get("scientific_value", 0) >= 80:           # exceptional value stays relevant
            reason += 0.3
        return min(0.5, 0.12 + reason * 0.2)

    # Respect what the viewer already saw (>=3s). Re-propose only for real reasons:
    # the content was updated, or enough time has passed and it's relevant again.
    def seen_factor(o) -> float:
        last = seen_map.get(o["id"])
        if not last:
            return 1.0
        try:
            upd = datetime.fromisoformat(o.get("updated_at") or o["created_at"])
        except Exception:
            upd = None
        if upd and upd > last:
            return 0.6          # content changed / new data → allow again, mild penalty
        days_since = (now - last).total_seconds() / 86400.0
        if days_since >= 14:
            return 0.3          # long time since → may reappear if still relevant
        return -1.0             # seen recently & unchanged → drop from the feed

    # Deterministic, slowly-rotating jitter so near-equal items get fresh chances
    # in different sessions (the algorithm keeps hunting the best moment to show).
    day_bucket = int(now.timestamp() // 3600 // 6)  # changes every 6 hours
    def rotation_jitter(o) -> float:
        h = hashlib.md5(f"{o['id']}:{day_bucket}".encode()).hexdigest()
        return (int(h[:6], 16) / 0xFFFFFF) * 0.06  # up to +0.06

    # Anti-invasive cap: an Observe repeatedly proposed but ignored (never seen)
    # is muted for that user after IMPRESSION_CAP shows — unless something
    # significant changes (content updated, or the viewer's interests now match).
    def impression_factor(o, aff: float) -> float:
        im = impr_map.get(o["id"])
        if not im or im["shown"] < IMPRESSION_CAP:
            return 1.0
        try:
            upd = datetime.fromisoformat(o.get("updated_at") or o["created_at"])
        except Exception:
            upd = None
        if (upd and upd > im["first"]) or aff >= 0.5:
            return 0.7          # significant change / new interest → give it another chance
        return -1.0             # ignored too many times → not relevant for this user

    def smart_score(o):
        # You ALWAYS see your own published Senses in Observe — never hidden by the
        # "already seen" / impression logic (you just published & opened it).
        if viewer and o.get("user_id") == viewer.get("id"):
            return 2.0 + recency(o) * 0.5 + rotation_jitter(o)
        sv = o.get("scientific_value", 0) / 100.0
        pop = (o.get("observed", 0) + o.get("discovery", 0) * 1.5 + o.get("learned", 0)) / 20.0
        pop = min(pop, 1.0)   # engagement ON THE CONTENT only — never author popularity
        rare = 0.0
        cats = o.get("categories", [])
        for c in ("ISS", "Aurore", "Via Lattea"):
            if c in cats:
                rare += 0.34
        rare = min(rare, 1.0)
        prox = 0.0
        if "_dist" in o:
            prox = max(0.0, 1.0 - o["_dist"] / max(radius_km, 1))
        aff = 0.0
        if interest and o.get("user_id") != (viewer or {}).get("id"):
            aff = min(1.0, sum(interest.get(c, 0.0) for c in cats))
        sf = seen_factor(o)
        if sf < 0:
            return -1.0  # already seen recently & unchanged → excluded below
        imf = impression_factor(o, aff)
        if imf < 0:
            return -1.0  # ignored past the cap → muted for this viewer
        base = (sv * 0.36 + aff * 0.20 + rare * 0.16 + fresh_boost(o) * 0.14
                + recency(o) * 0.10 + pop * 0.04)
        return base * window_mult(o, aff) * sf * imf + rotation_jitter(o)

    if sort == "recent":
        docs.sort(key=lambda o: o.get("created_at", ""), reverse=True)
    elif sort in ("observed", "discovery", "learned", "views"):
        docs.sort(key=lambda o: o.get(sort, 0), reverse=True)
    elif sort == "scientific":
        docs.sort(key=lambda o: o.get("scientific_value", 0), reverse=True)
    else:  # smart — dynamic, seen-aware, second-chance ranking
        scored = [(o, smart_score(o)) for o in docs]
        kept = [(o, s) for (o, s) in scored if s >= 0]  # drop seen-recently-unchanged
        kept.sort(key=lambda t: t[1], reverse=True)
        result = [o for (o, _s) in kept]
        # Observe must NEVER look empty while real content exists: if the seen /
        # impression logic filtered everything out, fall back to most-recent.
        if not result and docs:
            result = sorted(docs, key=lambda o: o.get("created_at", ""), reverse=True)
        docs = result

    docs = docs[:limit]
    # Record impressions for the smart feed (one per 6h bucket per item) so the
    # anti-invasive cap can mute Observes that keep getting ignored. Items the
    # viewer already saw are not counted as fresh impressions.
    if viewer and sort == "smart" and docs:
        ops = []
        for o in docs:
            oid = o["id"]
            if oid in seen_map:
                continue
            im = impr_map.get(oid)
            if im and im.get("bucket") == day_bucket:
                continue  # already counted this bucket
            ops.append(UpdateOne(
                {"user_id": viewer["id"], "obs_id": oid},
                {"$inc": {"shown": 1}, "$set": {"last_bucket": day_bucket, "last_shown_at": now.isoformat()},
                 "$setOnInsert": {"first_shown_at": now.isoformat()}},
                upsert=True,
            ))
        if ops:
            try:
                await db.obs_impressions.bulk_write(ops, ordered=False)
            except Exception:
                pass
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


# ---------------------------------------------------------------------------
# Pulse™ — daily observational challenges (curated themes, real observations)
# ---------------------------------------------------------------------------
class UpdateObs(BaseModel):
    caption: Optional[str] = None
    legend_hidden: Optional[List[str]] = None
    legend_on: Optional[bool] = None
    sense_layers: Optional[List[str]] = None
    geo_precision: Optional[str] = None


@social_router.patch("/observations/{obs_id}")
async def update_observation(obs_id: str, req: UpdateObs, user: dict = Depends(get_current_user)):
    o = await db.observations.find_one({"id": obs_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    if o["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non sei l'autore di questa osservazione")
    data = dict(o.get("data") or {})
    if req.legend_hidden is not None:
        data["legendHidden"] = req.legend_hidden
    if req.legend_on is not None:
        data["legendOn"] = req.legend_on
    if req.sense_layers is not None:
        data["senseLayers"] = req.sense_layers
    if req.geo_precision is not None:
        if req.geo_precision not in GEO_LEVELS:
            raise HTTPException(status_code=400, detail="Livello di posizione non valido")
        data["geoPrecision"] = req.geo_precision
    update: dict = {"data": data}
    if req.caption is not None:
        update["caption"] = req.caption.strip()[:500]
    await db.observations.update_one({"id": obs_id}, {"$set": update})
    updated = await db.observations.find_one({"id": obs_id}, {"_id": 0})
    return obs_public(updated, set(), False)


@social_router.delete("/observations/{obs_id}")
async def delete_observation(obs_id: str, user: dict = Depends(get_current_user)):
    """Author-only permanent removal of a published Senshot / Pulse / observation."""
    o = await db.observations.find_one({"id": obs_id}, {"_id": 0, "user_id": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    if o["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non sei l'autore di questa osservazione")
    await db.observations.delete_one({"id": obs_id})
    await r2_storage.delete(obs_id)
    await db.interactions.delete_many({"obs_id": obs_id})
    await db.comments.delete_many({"obs_id": obs_id})
    await db.saves.delete_many({"obs_id": obs_id})
    await db.reposts.delete_many({"obs_id": obs_id})
    return {"ok": True}


_SEARCH_STOP = {
    "mostrami", "mostra", "foto", "fotografate", "fotografato", "fotografia", "fotografie",
    "immagini", "immagine", "sense", "senseshot", "osservazione", "osservazioni",
    "di", "del", "della", "delle", "dei", "con", "senza", "le", "la", "il", "lo", "i", "gli",
    "un", "una", "uno", "che", "sono", "visibili", "visibile", "pubblicate", "pubblicata",
    "and", "the", "show", "me", "near", "around", "this", "week",
}


@social_router.get("/search")
async def search_observations(
    q: str = "",
    offset: int = 0,
    limit: int = 30,
    viewer: Optional[dict] = Depends(get_optional_user),
):
    """Content-first discovery. Matches title/description/hashtags/author/place/
    recognized objects/constellations/planets/sense-layer/category. Understands a
    few natural-language hints (time window, 'vicino a <luogo>'). Ranked by
    scientific value — never by author popularity."""
    text = (q or "").strip()
    low = text.lower()
    limit = min(max(limit, 1), 60)
    now = datetime.now(timezone.utc)

    query: dict = {"has_image": True}
    ands: list = []

    # Time hints
    if any(w in low for w in ["questa settimana", "this week", "ultima settimana", "settimana"]):
        ands.append({"created_at": {"$gte": (now - timedelta(days=7)).isoformat()}})
        low = re.sub(r"(questa\s+settimana|ultima\s+settimana|this\s+week|settimana)", " ", low)
    elif any(w in low for w in ["oggi", "today"]):
        ands.append({"created_at": {"$gte": (now - timedelta(days=1)).isoformat()}})
        low = re.sub(r"(oggi|today)", " ", low)

    # Location hint: "vicino a Roma", "near Rome"
    mloc = re.search(r"(?:vicino a|vicino|near|presso|intorno a)\s+([a-zàèéìòùç' ]{2,})", low)
    if mloc:
        place = mloc.group(1).strip().split(" ")[0]
        if len(place) >= 2:
            ands.append({"data.places.name": {"$regex": re.escape(place), "$options": "i"}})
            low = low.replace(mloc.group(0), " ")

    tokens = [t for t in re.split(r"[^a-z0-9àèéìòùç]+", low) if len(t) >= 3 and t not in _SEARCH_STOP]
    fields = [
        "title", "caption", "category", "categories", "hashtags", "nickname", "author_code",
        "data.senseLayer", "data.senseLayers", "data.constellations", "data.planets.name",
        "data.places.name", "data.places.category", "data.subject", "data.aiNote", "data.label",
    ]
    for t in tokens[:6]:
        rx = {"$regex": re.escape(t), "$options": "i"}
        ands.append({"$or": [{f: rx} for f in fields]})

    if ands:
        query["$and"] = ands

    docs = await (
        db.observations.find(query, {"_id": 0})
        .sort([("scientific_value", -1), ("created_at", -1)])
        .skip(max(0, offset)).limit(limit).to_list(limit)
    )

    inter: dict = {}
    saved: set = set()
    if viewer and docs:
        ids = [d["id"] for d in docs]
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}, {"_id": 0, "obs_id": 1, "type": 1}):
            inter.setdefault(it["obs_id"], set()).add(it["type"])
        async for s in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}, {"_id": 0, "obs_id": 1}):
            saved.add(s["obs_id"])

    items = [obs_public(o, inter.get(o["id"]), o["id"] in saved) for o in docs]
    return {"items": items, "offset": offset + len(items), "has_more": len(docs) >= limit}


@social_router.get("/search/trending")
async def search_trending(limit: int = 12):
    """Dynamic discovery chips: most-used hashtags across recent Senses."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    pipeline = [
        {"$match": {"has_image": True, "created_at": {"$gte": cutoff}, "hashtags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": {"$toLower": "$hashtags"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": min(max(limit, 1), 30)},
    ]
    tags = [d["_id"] async for d in db.observations.aggregate(pipeline) if d.get("_id")]
    return {"tags": tags}



@social_router.get("/pulse/feed")
async def pulse_feed(task_id: Optional[str] = None, limit: int = 60,
                     viewer: Optional[dict] = Depends(get_optional_user)):
    q: dict = {"is_pulse": True}
    if task_id:
        q["pulse_task.id"] = task_id
    # Pulses are ephemeral (24h) and must have a valid image. Exclude expired ones
    # (covers legacy pulses without pulse_expires_at via a 24h created_at window)
    # and any image-less record so the Home never shows empty / stale Pulses.
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    q["has_image"] = True
    q["created_at"] = {"$gte": cutoff}
    docs = await db.observations.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 200)).to_list(200)
    my: dict = {}
    saved: set = set()
    if viewer:
        oids = [o["id"] for o in docs]
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
        async for sv in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            saved.add(sv["obs_id"])
    return {"items": [obs_public(o, my.get(o["id"], set()), o["id"] in saved) for o in docs]}


def _pulse_facts(o: dict) -> List[str]:
    d = o.get("data") or {}
    facts = [f"Osservatore: {o.get('nickname', 'anonimo')}"]
    if o.get("caption"):
        facts.append(f"Descrizione: {o['caption']}")
    if d.get("senseLayer"):
        facts.append(f"Sense Layer: {d['senseLayer']}")
    sun = d.get("sun")
    if sun and sun.get("alt") is not None:
        facts.append(f"Sole a {round(sun['alt'])}° di altezza")
    moon = d.get("moon")
    if moon and moon.get("phase"):
        facts.append(f"Luna: {moon['phase']}")
    if (d.get("weather") or {}).get("temp") is not None:
        facts.append(f"Temperatura: {d['weather']['temp']}°C")
    if o.get("created_at"):
        facts.append(f"Catturato: {o['created_at']}")
    return facts


class PulseCompareReq(BaseModel):
    obs_id_a: str
    obs_id_b: str


# ---------------------------------------------------------------------------
# Pulse™ Globali — one shared mission for the whole world.
# Source: (1) auto curated calendar, (2) manual override from the Creator Console.
# Participant counts are ALWAYS the real number of distinct observers (Beyond View).
# ---------------------------------------------------------------------------
# Curated weekly calendar of global themes (real, evergreen observation prompts).
_GLOBAL_CALENDAR = [
    {"key": "sky", "title": "Fotografa il cielo", "theme": "Cielo",
     "prompt": "Ovunque tu sia nel mondo, cattura il cielo sopra di te in questo momento."},
    {"key": "light", "title": "La luce di casa tua", "theme": "Luce",
     "prompt": "Mostra come la luce cade sul tuo mondo, ora."},
    {"key": "water", "title": "L'acqua vicino a te", "theme": "Acqua",
     "prompt": "Trova dell'acqua — mare, fiume, pioggia, una goccia — e osservala."},
    {"key": "green", "title": "Un segno di vita", "theme": "Natura",
     "prompt": "Cattura una pianta, un fiore, un albero: la vita intorno a te."},
    {"key": "horizon", "title": "Il tuo orizzonte", "theme": "Paesaggio",
     "prompt": "Inquadra la linea dove la tua terra incontra il cielo."},
    {"key": "shadow", "title": "Ombre del mondo", "theme": "Luce & Ombra",
     "prompt": "Trova un'ombra e mostrala: la stessa luce, viste diverse."},
    {"key": "color", "title": "Il colore di oggi", "theme": "Colore",
     "prompt": "Qual è il colore che domina il tuo momento? Mostralo."},
]


def _day_bounds(now: datetime):
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def _auto_global_pulse(now: datetime) -> dict:
    start, end = _day_bounds(now)
    theme = _GLOBAL_CALENDAR[now.weekday() % len(_GLOBAL_CALENDAR)]
    return {
        "id": f"g_{theme['key']}_{start.strftime('%Y%m%d')}",
        "title": theme["title"],
        "theme": theme["theme"],
        "prompt": theme["prompt"],
        "source": "auto",
        "global": True,
        "starts_at": start.isoformat(),
        "ends_at": end.isoformat(),
    }


async def _resolve_global_pulse(now: datetime) -> dict:
    """Manual override (Creator Console) wins while active; else the auto calendar."""
    nowiso = now.isoformat()
    manual = await db.global_pulses.find_one(
        {"active": True, "starts_at": {"$lte": nowiso}, "ends_at": {"$gt": nowiso}},
        {"_id": 0}, sort=[("starts_at", -1)])
    if manual:
        return manual
    return _auto_global_pulse(now)


async def _global_participants(gid: str, starts_at: str) -> int:
    ids = await db.observations.distinct(
        "user_id", {"is_pulse": True, "pulse_task.id": gid, "created_at": {"$gte": starts_at}})
    return len(ids)


@social_router.get("/pulse/global/active")
async def pulse_global_active(viewer: Optional[dict] = Depends(get_optional_user)):
    now = datetime.now(timezone.utc)
    g = await _resolve_global_pulse(now)
    participants = await _global_participants(g["id"], g.get("starts_at", ""))
    return {"pulse": g, "participants": participants}


@social_router.get("/pulse/global/{gid}/feed")
async def pulse_global_feed(gid: str, limit: int = 120,
                            viewer: Optional[dict] = Depends(get_optional_user)):
    docs = await db.observations.find(
        {"is_pulse": True, "pulse_task.id": gid}, {"_id": 0}
    ).sort("created_at", -1).limit(min(limit, 300)).to_list(300)
    countries = len({o.get("data", {}).get("country") for o in docs if (o.get("data") or {}).get("country")})
    my: dict = {}
    saved: set = set()
    if viewer:
        oids = [o["id"] for o in docs]
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
        async for sv in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": oids}}):
            saved.add(sv["obs_id"])
    participants = len({o["user_id"] for o in docs})
    return {"items": [obs_public(o, my.get(o["id"], set()), o["id"] in saved) for o in docs],
            "participants": participants, "countries": countries}


class GlobalPulseReq(BaseModel):
    title: str
    prompt: str
    theme: str = "Osservazione"
    hours: int = 24


@social_router.post("/creator/global-pulse")
async def create_global_pulse(req: GlobalPulseReq, creator: dict = Depends(get_creator)):
    now = datetime.now(timezone.utc)
    gid = f"g_manual_{uuid.uuid4().hex[:8]}"
    doc = {
        "id": gid, "title": req.title.strip()[:80], "prompt": req.prompt.strip()[:280],
        "theme": req.theme.strip()[:40] or "Osservazione", "source": "creator", "global": True,
        "starts_at": now.isoformat(),
        "ends_at": (now + timedelta(hours=max(1, min(req.hours, 720)))).isoformat(),
        "active": True, "created_by": creator["id"],
    }
    # Only one manual global pulse active at a time.
    await db.global_pulses.update_many({"active": True}, {"$set": {"active": False}})
    await db.global_pulses.insert_one(doc)
    doc.pop("_id", None)
    # Broadcast to the community (chunked, preference-aware, non-blocking).
    try:
        uids = [u["id"] async for u in db.users.find({}, {"_id": 0, "id": 1})]
        for i in range(0, len(uids), 90):
            chunk = uids[i:i + 90]
            allowed = [uid async for uid in _pulse_optin(chunk)]
            if allowed:
                await send_push(allowed,
                                {"title": "Global Pulse™ 🌍", "message": doc["title"],
                                 "action_url": "/pulse", "kind": "pulse"},
                                idempotency_key=f"gpulse-{gid}-{i}")
    except Exception:
        pass
    return doc


async def _pulse_optin(uids: list):
    """Yield user ids that have NOT opted out of pulse notifications."""
    async for u in db.users.find({"id": {"$in": uids}}, {"_id": 0, "id": 1, "notif_prefs": 1}):
        if (u.get("notif_prefs") or {}).get("pulse", True) is not False:
            yield u["id"]


@social_router.delete("/creator/global-pulse")
async def stop_global_pulse(creator: dict = Depends(get_creator)):
    await db.global_pulses.update_many({"active": True}, {"$set": {"active": False}})
    return {"ok": True}


@social_router.post("/pulse/compare")
async def pulse_compare(req: PulseCompareReq, user: dict = Depends(get_current_user)):
    a = await db.observations.find_one({"id": req.obs_id_a}, {"_id": 0})
    b = await db.observations.find_one({"id": req.obs_id_b}, {"_id": 0})
    if not a or not b:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    ma_b64 = await r2_storage.fetch_base64(req.obs_id_a)
    mb_b64 = await r2_storage.fetch_base64(req.obs_id_b)
    if not ma_b64 or not mb_b64:
        raise HTTPException(status_code=422, detail="Immagini non disponibili per il confronto")
    task = a.get("pulse_task") or b.get("pulse_task") or {}
    theme = task.get("title") or task.get("theme") or "la stessa sfida osservativa"
    from ai_features import compare_pulse
    text = await compare_pulse(theme, ma_b64, _pulse_facts(a), mb_b64, _pulse_facts(b))
    return {"text": text, "theme": theme}



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
async def interact(obs_id: str, req: InteractReq, user: dict = Depends(get_active_user)):
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
    if active:
        owner = doc.get("user_id")
        if owner and owner != user["id"]:
            verb = {"observed": "ha osservato", "discovery": "ha segnato come Scoperta",
                    "learned": "ha imparato da"}.get(t, "ha reagito a")
            await notify(owner, "reactions", "OverView™",
                         f"@{user['nickname']} {verb} la tua Observation.",
                         action_url=f"/observation-detail?id={obs_id}")
    return {"active": active, "type": t, "count": doc.get(t, 0)}


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
class CommentReq(BaseModel):
    text: str


@social_router.post("/observations/{obs_id}/comments")
async def add_comment(obs_id: str, req: CommentReq, user: dict = Depends(get_active_user)):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Commento vuoto")
    o = await db.observations.find_one({"id": obs_id}, {"id": 1, "user_id": 1})
    if not o:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    doc = {
        "id": str(uuid.uuid4()), "obs_id": obs_id, "user_id": user["id"],
        "nickname": user["nickname"], "avatar": user.get("avatar"), "text": text[:1000],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.comments.insert_one(doc)
    await db.observations.update_one({"id": obs_id}, {"$inc": {"comments_count": 1}})
    owner = o.get("user_id")
    if owner and owner != user["id"]:
        preview = text[:60] + ("…" if len(text) > 60 else "")
        await notify(owner, "comments", "OverView™",
                     f"@{user['nickname']} ha commentato: “{preview}”",
                     action_url=f"/observation-detail?id={obs_id}")
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
        await notify(user_id, "follows", "OverView™",
                     f"@{user['nickname']} ha iniziato a seguirti.",
                     action_url=f"/profile?id={user['id']}")
    except Exception:
        pass
    return {"following": True}


@social_router.delete("/users/{user_id}/follow")
async def unfollow(user_id: str, user: dict = Depends(get_current_user)):
    await db.follows.delete_one({"follower_id": user["id"], "following_id": user_id})
    return {"following": False}


@social_router.get("/users/me/connections")
async def my_connections(user: dict = Depends(get_current_user)):
    """OViewers (followers) + Observers (following) — the people you can DM a share to."""
    follower_ids = [f["follower_id"] async for f in db.follows.find({"following_id": user["id"]}, {"follower_id": 1, "_id": 0}).limit(1000)]
    following_ids = [f["following_id"] async for f in db.follows.find({"follower_id": user["id"]}, {"following_id": 1, "_id": 0}).limit(1000)]
    ids = list(dict.fromkeys(follower_ids + following_ids))
    users = {}
    if ids:
        async for u in db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "nickname": 1, "display_name": 1, "avatar": 1}):
            users[u["id"]] = u
    def pub(uid, rel):
        u = users.get(uid)
        if not u:
            return None
        return {"id": uid, "nickname": u.get("nickname"), "display_name": u.get("display_name", ""),
                "avatar": u.get("avatar"), "relation": rel}
    fset, gset = set(follower_ids), set(following_ids)
    out = []
    for uid in ids:
        rel = "mutual" if uid in fset and uid in gset else ("oviewer" if uid in fset else "observer")
        p = pub(uid, rel)
        if p:
            out.append(p)
    # Mutuals first, then the rest — most likely DM targets.
    out.sort(key=lambda x: 0 if x["relation"] == "mutual" else 1)
    return {"items": out}


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
        "id": u["id"], "nickname": u["nickname"],
        "author_code": u.get("author_code"),
        "display_name": u.get("display_name", ""),
        "bio": u.get("bio", ""),
        "avatar": u.get("avatar"), "created_at": u.get("created_at"),
        "links": u.get("links", []),
        "protected": u.get("protected", False),
        "stats": {"observations": obs_count, "observers": following, "oviewers": followers,
                  "followers": followers, "following": following},
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
    o = await db.observations.find_one({"id": obs_id}, {"id": 1, "user_id": 1})
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
    owner = o.get("user_id")
    if owner and owner != user["id"]:
        await notify(owner, "reposts", "OverView™",
                     f"@{user['nickname']} ha condiviso la tua Observation.",
                     action_url=f"/observation-detail?id={obs_id}")
    return {"reposted": True}


class ProfileLink(BaseModel):
    label: Optional[str] = None
    url: str


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None
    nickname: Optional[str] = None
    display_name: Optional[str] = None
    links: Optional[List[ProfileLink]] = None


@social_router.patch("/users/me")
async def update_me(req: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.bio is not None:
        updates["bio"] = req.bio.strip()[:280]
    if req.display_name is not None:
        updates["display_name"] = req.display_name.strip()[:40]
    if req.links is not None:
        clean = []
        for lk in req.links[:3]:
            u = (lk.url or "").strip()
            if not u:
                continue
            if not u.startswith("http://") and not u.startswith("https://"):
                u = "https://" + u
            clean.append({"label": (lk.label or "").strip()[:30], "url": u[:300]})
        updates["links"] = clean
    if req.nickname is not None:
        # Protected (developer/founder) accounts have an immutable nickname.
        if user.get("protected") and req.nickname.strip() != user.get("nickname"):
            raise HTTPException(status_code=403, detail="Il nickname di questo account è protetto e non modificabile")
        nn = req.nickname.strip()
        if len(nn) < 3 or len(nn) > 24:
            raise HTTPException(status_code=400, detail="Il nickname deve avere tra 3 e 24 caratteri")
        if not NICK_RE.match(nn):
            raise HTTPException(status_code=400, detail="Il nickname può contenere solo lettere, numeri, . e _")
        exists = await db.users.find_one({"nickname_lower": nn.lower(), "id": {"$ne": user["id"]}})
        if exists:
            raise HTTPException(status_code=409, detail="Nickname già in uso")
        updates["nickname"] = nn
        updates["nickname_lower"] = nn.lower()
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]})
    return {"id": u["id"], "nickname": u["nickname"], "author_code": u.get("author_code"),
            "display_name": u.get("display_name", ""),
            "bio": u.get("bio", ""), "avatar": u.get("avatar"), "links": u.get("links", [])}


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
    await r2_storage.put_base64(avatar_id, "users/avatars", raw, content_type="image/jpeg", owner=user["id"])
    avatar_url = f"/api/media/{avatar_id}?v={uuid.uuid4().hex[:8]}"
    await db.users.update_one({"id": user["id"]},
                              {"$set": {"avatar": avatar_url, "updated_at": datetime.now(timezone.utc).isoformat()}})
    # Keep the author's identity fresh across the app (denormalised avatar).
    await db.observations.update_many({"user_id": user["id"]}, {"$set": {"avatar": avatar_url}})
    await db.comments.update_many({"user_id": user["id"]}, {"$set": {"avatar": avatar_url}})
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
