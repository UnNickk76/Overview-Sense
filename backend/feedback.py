"""In-app Feedback + Creator Console (hidden, developer-only)."""
import uuid
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth import get_current_user, active_suspension

feedback_router = APIRouter(prefix="/api")

FEEDBACK_TYPES = {"suggestion", "feature", "bug", "general"}
FEEDBACK_STATUSES = {"open", "in_progress", "resolved", "dismissed"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_creator(user: dict = Depends(get_current_user)) -> dict:
    """Guard: only the Creator (role=developer) may access the console."""
    if user.get("role") != "developer":
        raise HTTPException(status_code=404, detail="Not found")
    return user


class FeedbackCreate(BaseModel):
    type: str
    text: str


@feedback_router.post("/feedback")
async def create_feedback(req: FeedbackCreate, user: dict = Depends(get_current_user)):
    ftype = req.type if req.type in FEEDBACK_TYPES else "general"
    text = (req.text or "").strip()
    if len(text) < 3:
        raise HTTPException(status_code=422, detail="Il messaggio è troppo corto")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "nickname": user.get("nickname", ""),
        "type": ftype,
        "text": text[:2000],
        "status": "open",
        "priority": 0,
        "creator_note": "",
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.feedback.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@feedback_router.get("/feedback/mine")
async def my_feedback(user: dict = Depends(get_current_user)):
    items = [
        {k: v for k, v in f.items() if k != "_id"}
        async for f in db.feedback.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    ]
    return {"items": items, "count": len(items)}


# --------------------------------------------------------------------------
# Creator Console (developer-only, hidden from everyone else)
# --------------------------------------------------------------------------
@feedback_router.get("/creator/feedback")
async def creator_feedback(
    type: Optional[str] = None,
    status: Optional[str] = None,
    creator: dict = Depends(get_creator),
):
    q: dict = {}
    if type in FEEDBACK_TYPES:
        q["type"] = type
    if status in FEEDBACK_STATUSES:
        q["status"] = status
    items = [
        {k: v for k, v in f.items() if k != "_id"}
        async for f in db.feedback.find(q, {"_id": 0}).sort([("priority", -1), ("created_at", -1)]).limit(300)
    ]
    return {"items": items, "count": len(items)}


class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = None
    creator_note: Optional[str] = None


@feedback_router.patch("/creator/feedback/{fid}")
async def update_feedback(fid: str, req: FeedbackUpdate, creator: dict = Depends(get_creator)):
    updates: dict = {"updated_at": _now()}
    if req.status in FEEDBACK_STATUSES:
        updates["status"] = req.status
    if req.priority is not None:
        updates["priority"] = max(0, min(3, int(req.priority)))
    if req.creator_note is not None:
        updates["creator_note"] = req.creator_note.strip()[:1000]
    res = await db.feedback.update_one({"id": fid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@feedback_router.get("/creator/stats")
async def creator_stats(creator: dict = Depends(get_creator)):
    users = await db.users.count_documents({})
    observations = await db.observations.count_documents({})
    snapsenses = await db.snapsenses.count_documents({}) if "snapsenses" in await db.list_collection_names() else 0
    fb_total = await db.feedback.count_documents({})
    fb_open = await db.feedback.count_documents({"status": "open"})
    bugs_open = await db.feedback.count_documents({"type": "bug", "status": {"$in": ["open", "in_progress"]}})

    by_type = {}
    for t in FEEDBACK_TYPES:
        by_type[t] = await db.feedback.count_documents({"type": t})

    # recent signups (last 7 days, ISO string compare)
    week_ago = datetime.now(timezone.utc).isoformat()[:10]
    new_users = await db.users.count_documents({"created_at": {"$gte": week_ago[:8] + "01"}})

    return {
        "users": users,
        "observations": observations,
        "snapsenses": snapsenses,
        "feedback": {"total": fb_total, "open": fb_open, "bugs_open": bugs_open, "by_type": by_type},
        "new_users_month": new_users,
    }


# --------------------------------------------------------------------------
# Creator Console — operational center (Users / Signups / Content / Health)
# --------------------------------------------------------------------------
def _last_login(u: dict):
    times = [p.get("last_login_at") for p in u.get("auth_providers", []) if p.get("last_login_at")]
    return max(times) if times else None


async def _user_summary(u: dict) -> dict:
    uid = u["id"]
    observations = await db.observations.count_documents({"user_id": uid})
    pulses = await db.observations.count_documents({"user_id": uid, "is_pulse": True})
    senseshots = await db.observations.count_documents({"user_id": uid, "is_pulse": {"$ne": True}})
    fb = await db.feedback.count_documents({"user_id": uid})
    return {
        "id": uid,
        "nickname": u.get("nickname"),
        "email": u.get("email"),
        "author_code": u.get("author_code"),
        "role": u.get("role", "user"),
        "protected": u.get("protected", False),
        "platform": u.get("platform"),
        "created_at": u.get("created_at"),
        "last_login": _last_login(u),
        "suspension": active_suspension(u),
        "counts": {"observe": observations, "senseshot": senseshots, "pulse": pulses, "feedback": fb},
    }


@feedback_router.get("/creator/users")
async def creator_users(query: str = "", limit: int = 50, creator: dict = Depends(get_creator)):
    q: dict = {}
    s = (query or "").strip()
    if s:
        rx = {"$regex": _re_escape(s), "$options": "i"}
        q = {"$or": [{"nickname": rx}, {"email": rx}, {"author_code": rx}, {"id": s}]}
    docs = [u async for u in db.users.find(q, {"_id": 0}).sort("created_at", -1).limit(min(max(limit, 1), 200))]
    items = [await _user_summary(u) for u in docs]
    total = await db.users.count_documents({})
    return {"items": items, "count": len(items), "total": total}


@feedback_router.get("/creator/users/{uid}")
async def creator_user_detail(uid: str, creator: dict = Depends(get_creator)):
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return await _user_summary(u)


class SuspendReq(BaseModel):
    reason: str
    days: Optional[int] = None  # None = indefinite


@feedback_router.post("/creator/users/{uid}/suspend")
async def creator_suspend(uid: str, req: SuspendReq, creator: dict = Depends(get_creator)):
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if u.get("protected"):
        raise HTTPException(status_code=403, detail="Account protetto: non sospendibile")
    reason = (req.reason or "").strip()
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="Indica una motivazione")
    until = None
    if req.days and req.days > 0:
        until = (datetime.now(timezone.utc) + timedelta(days=req.days)).isoformat()
    await db.users.update_one({"id": uid}, {"$set": {"suspension": {
        "reason": reason[:500], "until": until, "created_at": _now(), "by": creator["id"],
    }}})
    return {"ok": True}


@feedback_router.post("/creator/users/{uid}/unsuspend")
async def creator_unsuspend(uid: str, creator: dict = Depends(get_creator)):
    await db.users.update_one({"id": uid}, {"$unset": {"suspension": ""}})
    return {"ok": True}


@feedback_router.get("/creator/signups")
async def creator_signups(limit: int = 50, creator: dict = Depends(get_creator)):
    docs = [u async for u in db.users.find({}, {"_id": 0}).sort("created_at", -1).limit(min(max(limit, 1), 200))]
    items = [{
        "id": u["id"], "nickname": u.get("nickname"), "author_code": u.get("author_code"),
        "created_at": u.get("created_at"), "platform": u.get("platform"), "last_login": _last_login(u),
        "suspended": bool(active_suspension(u)),
    } for u in docs]
    return {"items": items, "count": len(items)}


@feedback_router.get("/creator/observations")
async def creator_observations(query: str = "", type: str = "", limit: int = 60, creator: dict = Depends(get_creator)):
    q: dict = {}
    if type == "pulse":
        q["is_pulse"] = True
    elif type == "senseshot":
        q["is_pulse"] = {"$ne": True}
    s = (query or "").strip()
    if s:
        rx = {"$regex": _re_escape(s), "$options": "i"}
        q["$or"] = [{"title": rx}, {"caption": rx}, {"nickname": rx}, {"author_code": rx},
                    {"category": rx}, {"data.senseCode": rx}, {"id": s}]
    docs = [o async for o in db.observations.find(q, {"_id": 0}).sort("created_at", -1).limit(min(max(limit, 1), 120))]
    items = [{
        "id": o["id"], "title": o.get("title"), "nickname": o.get("nickname"),
        "author_code": o.get("author_code"), "code": (o.get("data") or {}).get("senseCode"),
        "created_at": o.get("created_at"), "is_pulse": o.get("is_pulse", False),
        "has_image": o.get("has_image", False), "image_url": o.get("image_url"),
        "scientific_value": o.get("scientific_value", 0), "category": o.get("category"),
    } for o in docs]
    return {"items": items, "count": len(items)}


@feedback_router.get("/creator/system-health")
async def creator_system_health(creator: dict = Depends(get_creator)):
    health = {"backend": "online", "database": "unknown", "build_version": os.environ.get("APP_BUILD", "dev")}
    try:
        await db.command("ping")
        health["database"] = "online"
    except Exception:
        health["database"] = "offline"
    media_count = 0
    media_bytes = 0
    db_bytes = 0
    try:
        cs = await db.command({"collStats": "media"})
        media_count = cs.get("count", 0)
        media_bytes = cs.get("size", 0)
    except Exception:
        media_count = await db.media.count_documents({})
    try:
        ds = await db.command("dbStats")
        db_bytes = ds.get("dataSize", 0)
    except Exception:
        pass
    users = await db.users.count_documents({})
    observations = await db.observations.count_documents({})
    suspended = await db.users.count_documents({"suspension": {"$exists": True}})
    # Empty/invalid records that should never surface (defensive metrics)
    empty_images = await db.observations.count_documents({"media_type": "image", "has_image": {"$ne": True}})
    empty_pulses = await db.observations.count_documents({"is_pulse": True, "has_image": {"$ne": True}})
    fb_open = await db.feedback.count_documents({"status": "open"})
    bugs_open = await db.feedback.count_documents({"type": "bug", "status": {"$in": ["open", "in_progress"]}})
    return {
        **health,
        "storage": {"images": media_count, "media_bytes": media_bytes, "db_data_bytes": db_bytes},
        "users": users, "observations": observations, "suspended": suspended,
        "failed_publications": empty_images, "empty_pulses": empty_pulses,
        "feedback_open": fb_open, "bugs_open": bugs_open,
    }


def _re_escape(s: str) -> str:
    import re
    return re.escape(s)
