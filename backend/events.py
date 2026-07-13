"""Community events derived from real Observations.

Three rigorous, data-driven features (no invented data):
  - Verified Events: when multiple distinct users observe the same phenomenon
    (same category, same UTC day) their Observations aggregate into a single
    community-verified event.
  - Live Earth: real coordinates of recent Observations so the client can plot
    where the planet is being observed right now.
  - Observation Chains: Observations of the same phenomenon linked in time into
    a shared story.
"""
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from auth import get_optional_user
from social import obs_public, compute_scores

events_router = APIRouter(prefix="/api", tags=["events"])

# Phenomena meaningful enough to aggregate/verify (skip generic "Astronomia").
NOTABLE = [
    "Aurore", "ISS", "Via Lattea", "Pianeti", "Luna", "Sole",
    "Costellazioni", "Satelliti", "Campo magnetico", "Meteo", "Atmosfera",
    "Satellite Intelligence", "Listening Layer",
]
MIN_OBSERVERS = 2  # "multiple users" observing the same phenomenon


def _day_key(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).astimezone(timezone.utc).date().isoformat()
    except Exception:
        return ""


def _primary_notable(o: dict) -> Optional[str]:
    # Prefer the server-computed primary category for consistency across features.
    primary = o.get("category")
    if primary and primary in NOTABLE:
        return primary
    for c in NOTABLE:
        if c in (o.get("categories", []) or []):
            return c
    return None


async def _recent(hours: int, limit: int = 500):
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    return await db.observations.find(
        {"created_at": {"$gte": since}}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)


# ---------------------------------------------------------------------------
# Verified Events
# ---------------------------------------------------------------------------
@events_router.get("/events/verified")
async def verified_events(hours: int = 72, limit: int = 20):
    docs = await _recent(hours, 600)
    clusters: dict = defaultdict(list)
    for o in docs:
        cat = _primary_notable(o)
        if not cat:
            continue
        day = _day_key(o.get("created_at", ""))
        if not day:
            continue
        clusters[(cat, day)].append(o)

    events = []
    for (cat, day), group in clusters.items():
        users = {o["user_id"] for o in group}
        if len(users) < MIN_OBSERVERS:
            continue
        times = sorted(o.get("created_at", "") for o in group)
        lats = [o["lat"] for o in group if o.get("lat") is not None]
        lons = [o["lon"] for o in group if o.get("lon") is not None]
        samples = [f"/api/media/{o['id']}" for o in group if o.get("has_image")][:4]
        avg_sv = round(sum(o.get("scientific_value", 0) for o in group) / len(group))
        events.append({
            "id": f"{cat}:{day}",
            "category": cat,
            "day": day,
            "title": f"{cat} · {len(users)} osservatori",
            "observers": len(users),
            "observations": len(group),
            "first_at": times[0],
            "last_at": times[-1],
            "avg_scientific_value": avg_sv,
            "centroid": (
                {"lat": round(sum(lats) / len(lats), 3), "lon": round(sum(lons) / len(lons), 3)}
                if lats and lons else None
            ),
            "samples": samples,
            "obs_ids": [o["id"] for o in group][:12],
        })

    # Strongest events first: more observers, then more observations, then recency.
    events.sort(key=lambda e: (e["observers"], e["observations"], e["last_at"]), reverse=True)
    return {"events": events[:limit]}


# ---------------------------------------------------------------------------
# Live Earth — real observation coordinates in the recent window
# ---------------------------------------------------------------------------
@events_router.get("/events/live-earth")
async def live_earth(hours: int = 24, limit: int = 200):
    docs = await _recent(hours, 600)
    points = []
    total_geo = 0
    for o in docs:
        lat, lon = o.get("lat"), o.get("lon")
        if lat is None or lon is None:
            continue
        total_geo += 1
        if len(points) < limit:
            points.append({
                "id": o["id"],
                "lat": round(lat, 3),
                "lon": round(lon, 3),
                "category": o.get("category"),
                "intensity": o.get("scientific_value", 0),
                "created_at": o.get("created_at"),
                "image_url": f"/api/media/{o['id']}" if o.get("has_image") else None,
                "nickname": o.get("nickname"),
            })
    return {
        "points": points,
        "total_recent": len(docs),
        "total_geolocated": total_geo,
        "window_hours": hours,
    }


# ---------------------------------------------------------------------------
# Observation Chain — connected phenomena linked into a shared story
# ---------------------------------------------------------------------------
def _haversine_km(lat1, lon1, lat2, lon2):
    import math
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1, math.sqrt(a)))

# Rare, planet-scale phenomena link globally; local ones link by proximity.
GLOBAL_PHENOMENA = {"Aurore", "ISS", "Via Lattea", "Pianeti", "Sole", "Luna"}


@events_router.get("/observations/{obs_id}/chain")
async def observation_chain(obs_id: str, viewer: Optional[dict] = Depends(get_optional_user)):
    anchor = await db.observations.find_one({"id": obs_id}, {"_id": 0})
    if not anchor:
        raise HTTPException(status_code=404, detail="Observation non trovata")
    cat = _primary_notable(anchor)
    if not cat:
        return {"category": None, "title": None, "items": []}

    try:
        t0 = datetime.fromisoformat(anchor["created_at"])
    except Exception:
        t0 = datetime.now(timezone.utc)
    lo = (t0 - timedelta(hours=36)).isoformat()
    hi = (t0 + timedelta(hours=36)).isoformat()

    q = {"categories": cat, "created_at": {"$gte": lo, "$lte": hi}}
    docs = await db.observations.find(q, {"_id": 0}).sort("created_at", 1).limit(200).to_list(200)

    is_global = cat in GLOBAL_PHENOMENA
    a_lat, a_lon = anchor.get("lat"), anchor.get("lon")
    linked = []
    for o in docs:
        if o["id"] == obs_id:
            linked.append(o)
            continue
        if is_global or a_lat is None or a_lon is None or o.get("lat") is None or o.get("lon") is None:
            linked.append(o)
        else:
            if _haversine_km(a_lat, a_lon, o["lat"], o["lon"]) <= 300:
                linked.append(o)

    # Interaction state for viewer.
    my: dict = {}
    saved: set = set()
    ids = [o["id"] for o in linked]
    if viewer and ids:
        async for it in db.interactions.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}):
            my.setdefault(it["obs_id"], set()).add(it["type"])
        async for s in db.saves.find({"user_id": viewer["id"], "obs_id": {"$in": ids}}):
            saved.add(s["obs_id"])

    items = [obs_public(o, my.get(o["id"], set()), o["id"] in saved) for o in linked]
    users = {o["user_id"] for o in linked}
    day = _day_key(anchor["created_at"])
    title = f"Catena {cat} · {day}" if len(linked) > 1 else None
    return {
        "category": cat,
        "title": title,
        "day": day,
        "observers": len(users),
        "count": len(linked),
        "scope": "globale" if is_global else "locale",
        "items": items,
    }
