"""Sense Vision — Geographic layer ("Luoghi").

Reveals real, geographically identifiable features in the direction the user is
looking, using GPS + compass + device orientation + FOV — NOT image AI. Data
comes from OpenStreetMap via the Overpass API. Beyond View: nothing invented,
only what actually exists is revealed; position, bearing and elevation angle are
computed from real coordinates (with Earth curvature + atmospheric refraction).
"""
import math
import time
import asyncio
import logging
import requests
from fastapi import APIRouter, Query, HTTPException

from database import db

logger = logging.getLogger("overview.geo")
geo_router = APIRouter(prefix="/api/geo")

# overpass-api.de has full data and fails FAST (504 in ~8s) or succeeds, so quick
# retries are cheap. Other mirrors block ~30s on timeout from datacenter IPs and
# rarely help, so they're used only as a last-resort single pass.
OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter"]
OVERPASS_FALLBACK = ["https://overpass.kumi.systems/api/interpreter"]
UA = {"User-Agent": "OverviewApp/1.0 (scientific instrument; geo layer)"}

# Effective Earth radius including standard atmospheric refraction (~7/6 * R).
R_EFF = 6371000.0 * 7.0 / 6.0

# Two-tier cache (Overpass is rate-limited & flaky): in-memory L1 + MongoDB L2
# (survives restarts). Keyed by rounded location + radius. Raw OSM elements are
# cached (location-independent) and re-projected per request for exact bearings.
_CACHE: dict = {}
_TTL = 6 * 3600          # in-memory freshness
_TTL_DB = 30 * 24 * 3600  # persistent freshness (30 days)


def _classify(tags: dict):
    """Map OSM tags to a broad (category, label) used for the marker icon."""
    place = tags.get("place")
    natural = tags.get("natural")
    historic = tags.get("historic")
    man_made = tags.get("man_made")
    tourism = tags.get("tourism")
    aeroway = tags.get("aeroway")
    building = tags.get("building")
    waterway = tags.get("waterway")
    amenity = tags.get("amenity")
    leisure = tags.get("leisure")

    if natural in ("peak",):
        return "mountain", "Montagna"
    if natural == "volcano":
        return "volcano", "Vulcano"
    if natural == "glacier":
        return "glacier", "Ghiacciaio"
    if natural == "water" or waterway == "river":
        return "water", "Acqua"
    if place in ("island", "islet"):
        return "island", "Isola"
    if place in ("city", "town"):
        return "city", "Città"
    if place in ("village", "suburb", "hamlet", "neighbourhood", "quarter"):
        return "town", "Località"
    if man_made == "lighthouse":
        return "lighthouse", "Faro"
    if man_made == "tower" or man_made == "obelisk":
        return "tower", "Torre"
    if man_made == "bridge" or tags.get("bridge"):
        return "bridge", "Ponte"
    if aeroway == "aerodrome":
        return "airport", "Aeroporto"
    if leisure == "stadium" or building == "stadium":
        return "stadium", "Stadio"
    if building in ("church", "cathedral") or amenity == "place_of_worship" or historic == "church":
        return "church", "Chiesa"
    if historic in ("castle", "fort"):
        return "castle", "Castello"
    if historic in ("monument", "memorial"):
        return "monument", "Monumento"
    if historic:
        return "historic", "Storico"
    if tourism in ("attraction", "viewpoint", "monument", "artwork", "museum"):
        return "landmark", "Punto d'interesse"
    return "place", "Luogo"


# Category prominence weight for ranking (higher = surfaced first).
_WEIGHT = {
    "volcano": 10, "mountain": 8, "city": 9, "lighthouse": 7, "castle": 7,
    "monument": 7, "tower": 6, "airport": 6, "island": 6, "town": 5,
    "church": 5, "stadium": 5, "bridge": 5, "water": 4, "landmark": 5,
    "historic": 4, "glacier": 6, "place": 3,
}


def _haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * 6371000.0 * math.asin(math.sqrt(a))


def _bearing(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def _q_points(lat, lon, r):
    # Node-only, few clauses → light enough that Overpass accepts it even under load
    # (heavier queries get 504'd). Notable, distance-observable feature types only.
    filt = (
        f'node(around:{r},{lat},{lon})["place"~"city|town|village|suburb|island|islet|hamlet"]["name"];'
        f'node(around:{r},{lat},{lon})["natural"~"peak|volcano|glacier"]["name"];'
        f'node(around:{r},{lat},{lon})["man_made"~"tower|lighthouse|obelisk"]["name"];'
        f'node(around:{r},{lat},{lon})["historic"~"castle|fort|monument|memorial|ruins|city_gate"]["name"];'
    )
    return f"[out:json][timeout:25];({filt});out 250;"


def _q_areas(lat, lon, r):
    # Areas (ways/relations) → heavier, fetched best-effort as an enhancement.
    filt = (
        f'way(around:{r},{lat},{lon})["natural"="water"]["name"];'
        f'nwr(around:{r},{lat},{lon})["aeroway"="aerodrome"]["name"];'
        f'nwr(around:{r},{lat},{lon})["leisure"="stadium"]["name"];'
        f'way(around:{r},{lat},{lon})["building"~"cathedral|stadium"]["name"];'
        f'nwr(around:{r},{lat},{lon})["historic"="castle"]["name"];'
    )
    return f"[out:json][timeout:25];({filt});out center 120;"


def _fetch(query, rounds, per_timeout=22, accept_empty=False):
    """Retry the main instance (transient 504s / server-timeout empties) then a
    single slow-fallback pass. When accept_empty is False, a 200 with no elements
    (usually a server-side query timeout) is treated as a miss and retried."""
    for _ in range(rounds):
        try:
            resp = requests.post(OVERPASS_ENDPOINTS[0], data={"data": query}, headers=UA, timeout=per_timeout)
            if resp.status_code == 200:
                els = resp.json().get("elements", [])
                if els or accept_empty:
                    return els
            elif resp.status_code == 429:
                time.sleep(4)  # rate limited → back off longer
        except Exception:  # noqa: BLE001
            pass
        time.sleep(1.0)
    for ep in OVERPASS_FALLBACK:
        try:
            resp = requests.post(ep, data={"data": query}, headers=UA, timeout=45)
            if resp.status_code == 200:
                els = resp.json().get("elements", [])
                if els or accept_empty:
                    return els
        except Exception:  # noqa: BLE001
            pass
    return None


@geo_router.get("/places")
async def geo_places(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(60.0, ge=1.0, le=250.0),
    ele: float = Query(0.0),  # observer elevation (m) from GPS altitude
):
    key = (round(lat, 2), round(lon, 2), round(radius_km))
    db_key = f"{key[0]},{key[1]},{key[2]}"
    now = time.time()

    elements = None
    mem = _CACHE.get(key)
    if mem and now - mem[0] < _TTL:
        elements = mem[1]

    if elements is None:  # L2: persistent MongoDB cache (survives restarts)
        doc = await db.geo_cache.find_one({"_id": db_key})
        if doc and now - doc.get("ts", 0) < _TTL_DB:
            elements = doc["elements"]
            _CACHE[key] = (now, elements)

    if elements is None:  # L3: live Overpass (blocking → run off the event loop)
        r_m = int(radius_km * 1000)
        elements = await asyncio.to_thread(_fetch, _q_points(lat, lon, r_m), 5)
        if elements is None:
            logger.warning("Overpass points query failed")
            doc = await db.geo_cache.find_one({"_id": db_key})  # stale fallback
            if doc:
                elements = doc["elements"]
            else:
                raise HTTPException(status_code=502, detail="Servizio dati geografici non disponibile")
        else:
            areas = await asyncio.to_thread(_fetch, _q_areas(lat, lon, r_m), 2, 25, True)
            if areas:
                elements = elements + areas
            if elements:  # never cache an empty/failed result
                _CACHE[key] = (now, elements)
                await db.geo_cache.replace_one(
                    {"_id": db_key}, {"_id": db_key, "ts": now, "elements": elements}, upsert=True)

    out = []
    seen = set()
    for el in elements:
        tags = el.get("tags") or {}
        name = tags.get("name")
        if not name:
            continue
        if "lat" in el and "lon" in el:
            plat, plon = el["lat"], el["lon"]
        elif "center" in el:
            plat, plon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        dist_m = _haversine_m(lat, lon, plat, plon)
        if dist_m < 40:  # skip the user's own spot
            continue
        dedup = (name, round(plat, 3), round(plon, 3))
        if dedup in seen:
            continue
        seen.add(dedup)
        category, label = _classify(tags)
        # Real elevation angle with Earth curvature + refraction. Unknown ground
        # height → assume observer level (feature sits near the true horizon).
        try:
            h_tgt = float(tags.get("ele")) if tags.get("ele") is not None else float(ele)
        except (TypeError, ValueError):
            h_tgt = float(ele)
        drop = (dist_m * dist_m) / (2 * R_EFF)
        alt = math.degrees(math.atan2(h_tgt - float(ele) - drop, dist_m))
        az = _bearing(lat, lon, plat, plon)
        w = _WEIGHT.get(category, 3)
        # Score: prominence + proximity (closer & more notable first).
        score = w * 3 - (dist_m / 1000.0) * 0.05
        out.append({
            "name": name,
            "category": category,
            "categoryLabel": label,
            "lat": plat, "lon": plon,
            "distanceKm": round(dist_m / 1000.0, 2),
            "az": round(az, 2),
            "alt": round(alt, 3),
            "ele": round(h_tgt, 1) if tags.get("ele") is not None else None,
            "score": round(score, 2),
        })

    out.sort(key=lambda p: p["score"], reverse=True)
    return {"available": True, "count": len(out[:90]), "places": out[:90]}
