"""In-app Feedback + Creator Console (hidden, developer-only)."""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth import get_current_user

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
