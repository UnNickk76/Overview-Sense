"""SnapSense™ — Overview's ephemeral "stories". Live for 24 hours.

A SnapSense can carry a photo/Sense/Satellite/Universe/Timeline capture (image)
or a short text note. They are grouped by author into rings shown above the feed.
Images reuse the shared `db.media` store and the existing `/api/media/{id}` route.
"""
import uuid
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth import get_current_user, get_optional_user
from push import notify

SNAP_REACTIONS = {"observed", "discovery", "learned"}

snapsense_router = APIRouter(prefix="/api", tags=["snapsense"])

TTL_HOURS = 24
VALID_KINDS = {"photo", "sense", "satellite", "universe", "timeline", "invisible", "spaceweather", "audio", "text"}


async def ensure_snapsense_indexes():
    await db.snapsenses.create_index("id", unique=True)
    await db.snapsenses.create_index("user_id")
    await db.snapsenses.create_index("expires_at")


class CreateSnap(BaseModel):
    kind: str = "photo"
    image_base64: Optional[str] = None
    caption: Optional[str] = None
    bg_color: Optional[str] = None
    source: Optional[str] = None


def _now():
    return datetime.now(timezone.utc)


def _item_public(s: dict) -> dict:
    return {
        "id": s["id"],
        "kind": s.get("kind", "photo"),
        "media_type": s.get("media_type", "image"),
        "image_url": f"/api/media/{s['id']}" if s.get("has_image") else None,
        "caption": s.get("caption"),
        "bg_color": s.get("bg_color"),
        "source": s.get("source"),
        "created_at": s.get("created_at"),
    }


@snapsense_router.post("/snapsenses")
async def create_snapsense(req: CreateSnap, user: dict = Depends(get_current_user)):
    kind = req.kind if req.kind in VALID_KINDS else "photo"
    sid = str(uuid.uuid4())
    has_image = False
    media_type = "text"

    if req.image_base64:
        raw = req.image_base64
        if "," in raw and raw.strip().startswith("data:"):
            raw = raw.split(",", 1)[1]
        try:
            base64.b64decode(raw)
        except Exception:
            raise HTTPException(status_code=400, detail="Immagine non valida")
        if req.source != "satellite" and kind not in {"satellite", "universe", "timeline", "spaceweather", "invisible"}:
            from ai_features import moderate_image_safe
            verdict = await moderate_image_safe(raw)
            if not verdict["safe"]:
                raise HTTPException(status_code=422, detail="Contenuti di nudità o sessualmente espliciti non sono ammessi su Overview.")
        await db.media.insert_one({"id": sid, "content_type": "image/jpeg", "data": raw})
        has_image = True
        media_type = "image"

    if not has_image and not (req.caption and req.caption.strip()):
        raise HTTPException(status_code=400, detail="Uno SnapSense deve contenere un'immagine o un testo.")

    now = _now()
    doc = {
        "id": sid,
        "user_id": user["id"],
        "nickname": user["nickname"],
        "kind": kind,
        "media_type": media_type,
        "has_image": has_image,
        "caption": (req.caption or "").strip()[:280] or None,
        "bg_color": req.bg_color,
        "source": req.source,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=TTL_HOURS)).isoformat(),
    }
    await db.snapsenses.insert_one(doc)
    return _item_public(doc)


@snapsense_router.get("/snapsenses")
async def list_snapsenses(viewer: Optional[dict] = Depends(get_optional_user)):
    now_iso = _now().isoformat()
    docs = await db.snapsenses.find(
        {"expires_at": {"$gt": now_iso}}, {"_id": 0}
    ).sort("created_at", 1).limit(500).to_list(500)

    groups: dict = {}
    for s in docs:
        uid = s["user_id"]
        g = groups.setdefault(uid, {"user_id": uid, "nickname": s.get("nickname"), "items": [], "latest_at": ""})
        g["items"].append(_item_public(s))
        if s.get("created_at", "") > g["latest_at"]:
            g["latest_at"] = s["created_at"]

    # Attach avatars in one pass.
    uids = list(groups.keys())
    if uids:
        async for u in db.users.find({"id": {"$in": uids}}, {"_id": 0, "id": 1, "avatar": 1, "nickname": 1}):
            if u["id"] in groups:
                groups[u["id"]]["avatar_url"] = u.get("avatar")
                groups[u["id"]]["nickname"] = u.get("nickname") or groups[u["id"]]["nickname"]

    # Seen/unseen state for the current viewer.
    if viewer:
        seen_ids = set()
        async for v in db.snapsense_views.find({"user_id": viewer["id"]}, {"snap_id": 1, "_id": 0}):
            seen_ids.add(v["snap_id"])
        for g in groups.values():
            has_unseen = False
            for it in g["items"]:
                it["seen"] = it["id"] in seen_ids or g["user_id"] == viewer["id"]
                if not it["seen"]:
                    has_unseen = True
            g["has_unseen"] = has_unseen
    else:
        for g in groups.values():
            for it in g["items"]:
                it["seen"] = False
            g["has_unseen"] = True

    out = list(groups.values())
    out.sort(key=lambda g: g["latest_at"], reverse=True)
    # The viewer's own ring first, so they can add/see their SnapSense quickly.
    if viewer:
        out.sort(key=lambda g: 0 if g["user_id"] == viewer["id"] else 1)
    return {"groups": out}


@snapsense_router.post("/snapsenses/{snap_id}/seen")
async def mark_seen(snap_id: str, user: dict = Depends(get_current_user)):
    await db.snapsense_views.update_one(
        {"user_id": user["id"], "snap_id": snap_id},
        {"$set": {"user_id": user["id"], "snap_id": snap_id, "seen_at": _now().isoformat()}},
        upsert=True,
    )
    return {"ok": True}


class SnapReact(BaseModel):
    type: str


@snapsense_router.post("/snapsenses/{snap_id}/react")
async def react_snapsense(snap_id: str, req: SnapReact, user: dict = Depends(get_current_user)):
    """Same apprezzamenti as Observe (observed/discovery/learned). Toggles + notifies the author."""
    if req.type not in SNAP_REACTIONS:
        raise HTTPException(status_code=400, detail="Tipo non valido")
    snap = await db.snapsenses.find_one({"id": snap_id}, {"_id": 0, "id": 1, "user_id": 1, "kind": 1})
    if not snap:
        raise HTTPException(status_code=404, detail="SnapSense non trovato")
    existing = await db.snapsense_reactions.find_one({"user_id": user["id"], "snap_id": snap_id, "type": req.type})
    if existing:
        await db.snapsense_reactions.delete_one({"_id": existing["_id"]})
        return {"active": False, "type": req.type}
    await db.snapsense_reactions.insert_one({
        "user_id": user["id"], "snap_id": snap_id, "type": req.type, "created_at": _now().isoformat(),
    })
    if snap["user_id"] != user["id"]:
        fmt = "Pulse™" if snap.get("kind") == "pulse" else "SnapSense™"
        verb = {"observed": "ha osservato", "discovery": "ha segnato come Scoperta", "learned": "ha imparato da"}.get(req.type, "ha apprezzato")
        await notify(snap["user_id"], "reactions", "OverView™",
                     f"@{user['nickname']} {verb} il tuo {fmt}.", action_url="/feed")
    return {"active": True, "type": req.type}


@snapsense_router.delete("/snapsenses/{snap_id}")
async def delete_snapsense(snap_id: str, user: dict = Depends(get_current_user)):
    s = await db.snapsenses.find_one({"id": snap_id}, {"_id": 0, "user_id": 1})
    if not s:
        raise HTTPException(status_code=404, detail="SnapSense non trovato")
    if s["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    await db.snapsenses.delete_one({"id": snap_id})
    await db.media.delete_one({"id": snap_id})
    return {"ok": True}
