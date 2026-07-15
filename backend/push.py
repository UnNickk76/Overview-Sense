"""Emergent-managed push notifications (SuprSend relay).

The backend is the ONLY caller of the Emergent push relay. Device tokens are
resolved upstream by user_id — we never store them. Push failures must never
block the primary operation.
"""
import os
import logging
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db

logger = logging.getLogger("push")

# Notification categories the user can toggle (all default ON).
NOTIF_KINDS = ("reactions", "comments", "follows", "reposts", "mentions", "pulse", "opportunities")

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

push_router = APIRouter(prefix="/api")


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str  # "android" | "ios"
    device_token: str


@push_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    resp = await _client.post("/api/v1/push/users/register", json=body.model_dump())
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


async def send_push(recipients: list, data: dict, idempotency_key: str = None) -> None:
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def notify(user_id: str, kind: str, title: str, message: str,
                 action_url: str = None, idempotency_key: str = None) -> None:
    """High-level, preference-aware notification for a single user.

    Respects the recipient's `notif_prefs` toggle for `kind` (default ON) and
    never raises — a failed/unavailable push must not affect the caller.
    """
    if not user_id:
        return
    try:
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "notif_prefs": 1})
        prefs = (u or {}).get("notif_prefs") or {}
        if prefs.get(kind) is False:  # opt-out; default is enabled
            return
        data = {"title": title, "message": message, "kind": kind}
        if action_url:
            data["action_url"] = action_url
        await send_push([user_id], data, idempotency_key=idempotency_key)
    except Exception:
        pass
