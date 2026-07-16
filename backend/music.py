"""Music catalog — modular provider architecture.

The frontend only ever sees a normalized Track schema, so new providers (Pixabay,
or future commercial catalogs like Apple Music / Spotify under proper licensing)
can be added by implementing MusicProvider WITHOUT changing the API or the client.

Only the backend calls the provider (Jamendo has no CORS + keeps the credential
server-side). The Client Secret is NEVER used here nor exposed; catalogue reads
use only the public client_id. Jamendo tracks are Creative Commons — attribution
(title + artist + license) travels with every track for compliant display.
"""
import os
import time
import logging
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("music")

music_router = APIRouter(prefix="/api/music", tags=["music"])


class MusicProvider:
    name = "base"

    async def search(self, q: str, artist: str, genre: str, mood: str, limit: int) -> List[dict]:
        raise NotImplementedError

    async def track(self, track_id: str) -> Optional[dict]:
        raise NotImplementedError


class JamendoProvider(MusicProvider):
    name = "jamendo"
    BASE = "https://api.jamendo.com/v3.0"

    def __init__(self):
        self.client_id = os.environ.get("JAMENDO_CLIENT_ID", "")

    def _normalize(self, item: dict) -> dict:
        return {
            "id": f"jamendo:{item.get('id')}",
            "provider": "jamendo",
            "provider_track_id": str(item.get("id")),
            "title": item.get("name") or "Senza titolo",
            "artist": item.get("artist_name") or "",
            "album": item.get("album_name") or "",
            "duration": int(item.get("duration") or 0),
            "cover_url": item.get("image") or item.get("album_image") or None,
            "audio_url": item.get("audio") or None,          # streamable/previewable MP3
            "license_url": item.get("license_ccurl") or item.get("licenseccurl") or None,
            "share_url": item.get("shareurl") or None,
        }

    async def _get(self, path: str, params: dict) -> dict:
        if not self.client_id:
            raise HTTPException(503, "Catalogo musicale non configurato")
        params = {"client_id": self.client_id, "format": "json", **params}
        async with httpx.AsyncClient(timeout=12.0) as c:
            r = await c.get(f"{self.BASE}{path}", params=params)
            if r.status_code == 401:
                raise HTTPException(502, "Credenziale musicale non valida")
            r.raise_for_status()
            return r.json()

    async def search(self, q: str, artist: str, genre: str, mood: str, limit: int) -> List[dict]:
        params: dict = {"limit": str(max(1, min(limit, 40))), "audioformat": "mp32",
                        "include": "musicinfo", "order": "popularity_total"}
        # Free-text search matches title/artist; tags cover genre + mood/atmosphere.
        if q:
            params["namesearch"] = q
        if artist:
            params["artist_name"] = artist
        tags = " ".join(t for t in [genre, mood] if t).strip()
        if tags:
            params["fuzzytags"] = tags
        data = await self._get("/tracks/", params)
        return [self._normalize(it) for it in (data.get("results") or []) if it.get("audio")]

    async def track(self, track_id: str) -> Optional[dict]:
        data = await self._get("/tracks/", {"id": track_id})
        rows = data.get("results") or []
        return self._normalize(rows[0]) if rows and rows[0].get("audio") else None


# Provider registry — swap/add providers here without touching the API or client.
PROVIDERS = {"jamendo": JamendoProvider()}
DEFAULT_PROVIDER = "jamendo"

_cache: dict = {}
_CACHE_TTL = 6 * 3600


@music_router.get("/search")
async def search_music(
    q: str = Query("", description="titolo o parola chiave"),
    artist: str = Query(""),
    genre: str = Query(""),
    mood: str = Query(""),
    provider: str = Query(DEFAULT_PROVIDER),
    limit: int = Query(24, ge=1, le=40),
):
    prov = PROVIDERS.get(provider)
    if not prov:
        raise HTTPException(400, "Provider non supportato")
    if not (q or artist or genre or mood):
        q = ""  # empty → provider returns popular tracks
    key = f"{provider}|{q}|{artist}|{genre}|{mood}|{limit}"
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < _CACHE_TTL:
        return {"items": hit[1], "provider": provider}
    try:
        items = await prov.search(q, artist, genre, mood, limit)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("music search failed: %s", e)
        # Graceful: never break the composer if the catalog is momentarily down.
        return {"items": [], "provider": provider, "error": "unavailable"}
    _cache[key] = (time.time(), items)
    return {"items": items, "provider": provider}


@music_router.get("/track/{provider}/{track_id}")
async def get_track(provider: str, track_id: str):
    """Re-resolve a single track — used to check a saved track is still available."""
    prov = PROVIDERS.get(provider)
    if not prov:
        raise HTTPException(400, "Provider non supportato")
    try:
        t = await prov.track(track_id)
    except HTTPException:
        raise
    except Exception:
        return {"available": False, "track": None}
    return {"available": bool(t), "track": t}
