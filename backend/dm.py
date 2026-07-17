"""Direct Messages (Instagram-style) + "Senshot condiviso" comparison.
Polling-based (no websockets yet)."""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth import get_current_user
from push import notify

dm_router = APIRouter(prefix="/api")

SHARE_KINDS = {"text", "image", "observation", "profile", "location", "link", "snapsense", "compare"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _key(a: str, b: str) -> str:
    return "|".join(sorted([a, b]))


async def _obs_snapshot(obs: dict) -> dict:
    """Compact, self-contained snapshot of an Observation for a shared comparison."""
    data = obs.get("data") or {}
    return {
        "obs_id": obs["id"],
        "user_id": obs["user_id"],
        "nickname": obs.get("nickname"),
        "image_url": f"/api/media/{obs['id']}" if obs.get("has_image") else None,
        "subject": data.get("subject") or obs.get("caption") or "",
        "caption": obs.get("caption", ""),
        "ts": data.get("ts"),
        "lat": data.get("lat") if data.get("lat") is not None else obs.get("lat"),
        "lon": data.get("lon") if data.get("lon") is not None else obs.get("lon"),
        "sun": data.get("sun"),
        "moon": data.get("moon"),
        "cameraAz": data.get("cameraAz"),
        "cameraAlt": data.get("cameraAlt"),
        "weather": data.get("weather"),
        "created_at": obs.get("created_at"),
    }


def _preview(kind: str, text: str, share: Optional[dict]) -> str:
    if kind == "text":
        return (text or "")[:80]
    if kind == "image":
        return "📷 Foto"
    if kind == "observation":
        return "🔭 Ha condiviso un Senshot"
    if kind == "profile":
        return "👤 Ha condiviso un profilo"
    if kind == "location":
        return "📍 Posizione"
    if kind == "link":
        return "🔗 Link"
    if kind == "snapsense":
        return "⚡ SnapSense"
    if kind == "compare":
        subj = (share or {}).get("subject") or "un oggetto"
        return f"🌗 Senshot condiviso · {subj}"
    return text[:80] if text else "Messaggio"


async def _user_public(uid: str) -> dict:
    u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "nickname": 1, "display_name": 1, "avatar": 1})
    return u or {"id": uid, "nickname": "utente", "avatar": None}


# ---------------------------------------------------------------------------
class StartConv(BaseModel):
    user_id: str


@dm_router.post("/conversations")
async def start_conversation(req: StartConv, user: dict = Depends(get_current_user)):
    other = req.user_id
    if other == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi scrivere a te stesso")
    if not await db.users.find_one({"id": other}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Utente non trovato")
    key = _key(user["id"], other)
    conv = await db.conversations.find_one({"key": key}, {"_id": 0})
    if not conv:
        conv = {
            "id": str(uuid.uuid4()), "key": key,
            "participants": sorted([user["id"], other]),
            "created_at": _now(), "last_at": _now(),
            "last_message": "", "last_sender": None,
        }
        await db.conversations.insert_one(conv)
        conv.pop("_id", None)
    other_u = await _user_public(other)
    return {**conv, "other": other_u, "unread": 0}


@dm_router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    out: List[dict] = []
    async for c in db.conversations.find({"participants": user["id"]}, {"_id": 0}).sort("last_at", -1).limit(100):
        other_id = next((p for p in c["participants"] if p != user["id"]), user["id"])
        other_u = await _user_public(other_id)
        unread = await db.dm_messages.count_documents(
            {"conv_id": c["id"], "sender_id": {"$ne": user["id"]}, "read_by": {"$ne": user["id"]}})
        out.append({**c, "other": other_u, "unread": unread})
    return {"items": out, "count": len(out)}


@dm_router.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: str, user: dict = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not c or user["id"] not in c["participants"]:
        raise HTTPException(status_code=404, detail="Conversazione non trovata")
    msgs = [m async for m in db.dm_messages.find({"conv_id": conv_id}, {"_id": 0}).sort("created_at", 1).limit(500)]
    return {"items": msgs}


class SendMsg(BaseModel):
    kind: str = "text"
    text: Optional[str] = None
    share: Optional[dict] = None


@dm_router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, req: SendMsg, user: dict = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not c or user["id"] not in c["participants"]:
        raise HTTPException(status_code=404, detail="Conversazione non trovata")
    kind = req.kind if req.kind in SHARE_KINDS else "text"
    share = req.share or {}

    # Enrich shared content server-side so previews are self-contained.
    if kind == "observation":
        obs = await db.observations.find_one({"id": share.get("obs_id")}, {"_id": 0})
        if not obs:
            raise HTTPException(status_code=404, detail="Senshot non trovato")
        share = {"obs_id": obs["id"], "nickname": obs.get("nickname"),
                 "image_url": f"/api/media/{obs['id']}" if obs.get("has_image") else None,
                 "caption": obs.get("caption", "")}
    elif kind == "snapsense":
        snap = await db.snapsenses.find_one({"id": share.get("snap_id")}, {"_id": 0})
        expired = snap is None
        author = None
        if snap:
            author = await db.users.find_one({"id": snap["user_id"]}, {"_id": 0, "nickname": 1})
        share = {
            "snap_id": share.get("snap_id"),
            "format": (snap or {}).get("kind") == "pulse" and "Pulse™" or "SnapSense™",
            "nickname": (author or {}).get("nickname") or share.get("nickname"),
            "image_url": f"/api/media/{snap['id']}" if snap and snap.get("has_image") else None,
            "caption": (snap or {}).get("caption", ""),
            "expired": expired,
        }
    elif kind == "profile":
        share = await _user_public(share.get("user_id"))
    elif kind == "compare":
        obs = await db.observations.find_one({"id": share.get("obs_id")}, {"_id": 0})
        if not obs:
            raise HTTPException(status_code=404, detail="Senshot non trovato")
        snap = await _obs_snapshot(obs)
        share = {"subject": share.get("subject") or snap["subject"], "a": snap, "b": None}

    msg = {
        "id": str(uuid.uuid4()), "conv_id": conv_id, "sender_id": user["id"],
        "kind": kind, "text": (req.text or "").strip()[:2000] if kind == "text" else (req.text or "").strip()[:500],
        "share": share if kind != "text" else None,
        "read_by": [user["id"]], "created_at": _now(),
    }
    await db.dm_messages.insert_one(msg)
    msg.pop("_id", None)
    await db.conversations.update_one({"id": conv_id}, {"$set": {
        "last_at": msg["created_at"], "last_message": _preview(kind, msg["text"], share), "last_sender": user["id"]}})
    if kind == "snapsense":
        conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0, "participants": 1})
        others = [p for p in (conv or {}).get("participants", []) if p != user["id"]]
        fmt = (share or {}).get("format", "SnapSense™")
        for uid in others:
            await notify(uid, "snapsense", "OverView™",
                         f"@{user['nickname']} ha risposto al tuo {fmt}.", action_url=f"/dm?conv={conv_id}")
    return msg


@dm_router.post("/conversations/{conv_id}/read")
async def mark_read(conv_id: str, user: dict = Depends(get_current_user)):
    await db.dm_messages.update_many(
        {"conv_id": conv_id, "read_by": {"$ne": user["id"]}},
        {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}


class CompareAdd(BaseModel):
    obs_id: str


@dm_router.post("/messages/{mid}/compare")
async def add_to_compare(mid: str, req: CompareAdd, user: dict = Depends(get_current_user)):
    """The other participant attaches their own Senshot of the same object → side-by-side."""
    m = await db.dm_messages.find_one({"id": mid}, {"_id": 0})
    if not m or m.get("kind") != "compare":
        raise HTTPException(status_code=404, detail="Confronto non trovato")
    c = await db.conversations.find_one({"id": m["conv_id"]}, {"_id": 0})
    if not c or user["id"] not in c["participants"]:
        raise HTTPException(status_code=404, detail="Non autorizzato")
    obs = await db.observations.find_one({"id": req.obs_id, "user_id": user["id"]}, {"_id": 0})
    if not obs:
        raise HTTPException(status_code=404, detail="Senshot non trovato")
    snap = await _obs_snapshot(obs)
    share = m.get("share") or {}
    share["b"] = snap
    await db.dm_messages.update_one({"id": mid}, {"$set": {"share": share}})
    return {"ok": True, "share": share}


async def ensure_dm_indexes():
    await db.conversations.create_index("key", unique=True)
    await db.conversations.create_index("participants")
    await db.conversations.create_index("last_at")
    await db.dm_messages.create_index([("conv_id", 1), ("created_at", 1)])
