"""Live cosmic catalog for the Universe Explorer (real data, no invented values).

LIVE source (proxied + cached to respect rate limits):
  - Asteroids: NASA NeoWs feed — near-Earth objects with a close approach today.
    Uses NASA_API_KEY from the environment (free key from https://api.nasa.gov);
    falls back to DEMO_KEY, and to a small curated set of real famous asteroids
    if the API is unreachable/rate-limited, so the feature always shows real data.

Comets, pulsars, quasars and probes are shipped as real curated catalogs on the
client (no reliable free live API reachable). Positions in 3D are always a
data-visualisation; the numbers are the real measured values.
"""
import os
import time
import asyncio
import logging
from datetime import datetime, timezone

import requests
from fastapi import APIRouter

logger = logging.getLogger("overview.universe")
universe_router = APIRouter(prefix="/api/universe", tags=["universe"])

UA = {"User-Agent": "OverviewApp/1.0 (scientific instrument)"}
NASA_API_KEY = os.environ.get("NASA_API_KEY", "DEMO_KEY")

_CACHE: dict = {}
ASTEROID_TTL = 6 * 3600


def _num(v):
    try:
        return float(v)
    except Exception:
        return None


# Real famous near-Earth asteroids (fallback only; real measured values).
_CURATED_ASTEROIDS = [
    {"id": "neo-apophis", "name": "99942 Apophis", "kind": "asteroid", "scale": 1,
     "diameter_m_min": 340, "diameter_m_max": 340, "hazardous": True,
     "miss_km": 31600, "miss_lunar": 0.08, "velocity_kms": 7.4,
     "approach_date": "2029-04-13", "source": "NASA/JPL · catalogo reale"},
    {"id": "neo-bennu", "name": "101955 Bennu", "kind": "asteroid", "scale": 1,
     "diameter_m_min": 490, "diameter_m_max": 490, "hazardous": True,
     "miss_km": 750000, "miss_lunar": 1.95, "velocity_kms": 6.1,
     "approach_date": "2135-09-25", "source": "NASA OSIRIS-REx · catalogo reale"},
    {"id": "neo-ryugu", "name": "162173 Ryugu", "kind": "asteroid", "scale": 1,
     "diameter_m_min": 900, "diameter_m_max": 900, "hazardous": False,
     "miss_km": 95000000, "miss_lunar": 247.0, "velocity_kms": 5.9,
     "approach_date": "—", "source": "JAXA Hayabusa2 · catalogo reale"},
    {"id": "neo-eros", "name": "433 Eros", "kind": "asteroid", "scale": 1,
     "diameter_m_min": 16800, "diameter_m_max": 16800, "hazardous": False,
     "miss_km": 22000000, "miss_lunar": 57.0, "velocity_kms": 5.1,
     "approach_date": "—", "source": "NASA NEAR · catalogo reale"},
    {"id": "neo-1998or2", "name": "52768 (1998 OR2)", "kind": "asteroid", "scale": 1,
     "diameter_m_min": 2000, "diameter_m_max": 2000, "hazardous": True,
     "miss_km": 6300000, "miss_lunar": 16.4, "velocity_kms": 8.7,
     "approach_date": "2020-04-29", "source": "NASA/JPL · catalogo reale"},
]


def _fetch_asteroids():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    url = (f"https://api.nasa.gov/neo/rest/v1/feed?start_date={today}"
           f"&end_date={today}&api_key={NASA_API_KEY}")
    r = requests.get(url, headers=UA, timeout=12, allow_redirects=True)
    r.raise_for_status()
    data = r.json()
    by_day = (data or {}).get("near_earth_objects", {})
    items = []
    for _day, arr in by_day.items():
        for a in arr:
            ca = (a.get("close_approach_data") or [{}])[0]
            dia = (a.get("estimated_diameter") or {}).get("meters", {})
            miss = (ca.get("miss_distance") or {})
            vel = (ca.get("relative_velocity") or {})
            items.append({
                "id": f"neo-{a.get('id')}",
                "name": (a.get("name") or "").strip("() "),
                "kind": "asteroid",
                "scale": 1,
                "diameter_m_min": _num(dia.get("estimated_diameter_min")),
                "diameter_m_max": _num(dia.get("estimated_diameter_max")),
                "hazardous": bool(a.get("is_potentially_hazardous_asteroid")),
                "miss_km": _num(miss.get("kilometers")),
                "miss_lunar": _num(miss.get("lunar")),
                "velocity_kms": _num(vel.get("kilometers_per_second")),
                "approach_date": ca.get("close_approach_date_full") or ca.get("close_approach_date"),
                "source": "NASA NeoWs · dati reali (oggi)",
            })
    items.sort(key=lambda x: (x["miss_km"] if x["miss_km"] is not None else 9e18))
    return items[:24]


@universe_router.get("/asteroids")
async def asteroids():
    now = time.time()
    hit = _CACHE.get("asteroids")
    if hit and now - hit["ts"] < ASTEROID_TTL and hit["data"]:
        return {"available": True, "cached": True, "live": hit["live"],
                "source": "NASA NeoWs", "objects": hit["data"]}
    live = True
    try:
        data = await asyncio.to_thread(_fetch_asteroids)
    except Exception as e:
        logger.warning(f"NeoWs fetch failed ({e}); using curated asteroids")
        data = None
    if not data:
        data, live = _CURATED_ASTEROIDS, False
    _CACHE["asteroids"] = {"ts": now, "data": data, "live": live}
    return {"available": True, "cached": False, "live": live,
            "source": "NASA NeoWs" if live else "NASA/JPL (catalogo)", "objects": data}
