"""Ecoes™ — the second pillar of OverView.

Ecoes does NOT create connections: it detects invisible resonances between what
people express (Pensieri, Sense captions, comments) and makes them perceivable.

MVP (Fase 2):
- Periodic batch resonance analysis (GPT-5.4) — no manual trigger. A resonance is
  a DEEP relation (meaning, perspective, mood, complementarity), never mere topic
  overlap. Better ZERO connections than a forced one. Max 3 distinct proposals per
  content/cycle, only if genuinely significant.
- A candidate Connection is PROPOSED individually to the involved users (anonymous).
  A real Ecoes Connection Room is born only when >=2 accept; others may join later.
- Each Connection has a real geographic origin (from the content that sparked it)
  shown on the Globe with deterministic spatial obfuscation — never a city/coords.
- Intensity is the LIFE of a Connection (quality/continuity), never numbers/popularity.
  Inactive connections go dormant but stay on the Globe; deleted only when the last
  member leaves.
"""
import os
import math
import uuid
import json
import hashlib
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db, EMERGENT_LLM_KEY
from auth import get_current_user, get_active_user
from push import notify

logger = logging.getLogger("ecoes")
ecoes_router = APIRouter(prefix="/api/ecoes")

MAX_GROUPS_PER_CYCLE = 3
SCAN_BATCH = 40
DORMANT_AFTER_HOURS = 72
DISPLAY_RADIUS_M = 90000.0  # ~90km obfuscation so no city can be identified


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse(iso: Optional[str]) -> Optional[datetime]:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Geographic obfuscation — real origin kept internal, display point stable.
# --------------------------------------------------------------------------- #
def _display_coords(cid: str, lat, lon):
    if lat is None or lon is None:
        # No origin: derive a stable pseudo-point from the id so it still lives
        # somewhere on Earth without revealing anything.
        seed = int(hashlib.md5(f"{cid}:nogeo".encode()).hexdigest()[:12], 16)
        plat = (seed % 12000) / 100.0 - 60.0      # -60..60
        plon = ((seed >> 12) % 36000) / 100.0 - 180.0
        return round(plat, 3), round(plon, 3)
    seed = int(hashlib.md5(f"{cid}:ecoes".encode()).hexdigest()[:8], 16)
    angle = ((seed % 3600) / 10.0) * math.pi / 180.0
    jr = DISPLAY_RADIUS_M * (0.55 + (seed % 1000) / 2000.0)
    dlat = (jr * math.cos(angle)) / 111320.0
    dlon = (jr * math.sin(angle)) / (111320.0 * max(0.2, math.cos(math.radians(lat))))
    return round(lat + dlat, 3), round(lon + dlon, 3)


# --------------------------------------------------------------------------- #
# Intensity — the living pulsation (quality + continuity, never numbers)
# --------------------------------------------------------------------------- #
async def _intensity(conn: dict) -> float:
    last = _parse(conn.get("last_activity_at") or conn.get("created_at"))
    if not last:
        return 0.15
    hours = max(0.0, (datetime.now(timezone.utc) - last).total_seconds() / 3600.0)
    recency = math.exp(-hours / 48.0)  # decays over ~2 days
    since = (datetime.now(timezone.utc) - timedelta(hours=DORMANT_AFTER_HOURS)).isoformat()
    recent_posts = await db.ecoes_posts.count_documents({"connection_id": conn["id"], "created_at": {"$gte": since}})
    # Distinct recent authors → continuity signal (not raw count on the surface)
    authors = await db.ecoes_posts.distinct("user_id", {"connection_id": conn["id"], "created_at": {"$gte": since}})
    activity = 1.0 - math.exp(-(recent_posts * 0.35 + len(authors) * 0.5))
    val = 0.15 + 0.85 * (0.45 * recency + 0.55 * activity)
    return round(min(1.0, max(0.08, val)), 3)


async def _active_members(cid: str) -> List[dict]:
    return await db.ecoes_members.find({"connection_id": cid, "active": True}, {"_id": 0}).to_list(500)


# --------------------------------------------------------------------------- #
# Resonance engine (periodic batch)
# --------------------------------------------------------------------------- #
async def _gather_candidates(limit: int) -> List[dict]:
    scanned = set(await db.ecoes_scanned.distinct("content_id"))
    since = (datetime.now(timezone.utc) - timedelta(days=21)).isoformat()
    out: List[dict] = []
    # Sense + Pensieri
    async for o in db.observations.find(
        {"created_at": {"$gte": since}, "is_pulse": {"$ne": True}},
        {"_id": 0, "id": 1, "user_id": 1, "nickname": 1, "kind": 1, "caption": 1, "title": 1, "lat": 1, "lon": 1, "created_at": 1},
    ).sort("created_at", -1).limit(400):
        text = (o.get("caption") or o.get("title") or "").strip()
        if o["id"] in scanned or len(text) < 12:
            continue
        out.append({"content_id": o["id"], "user_id": o["user_id"], "nickname": o.get("nickname"),
                    "kind": o.get("kind") or ("thought" if o.get("caption") and not o.get("lat") else "sense"),
                    "text": text[:600], "lat": o.get("lat"), "lon": o.get("lon"), "created_at": o.get("created_at")})
    # Comments
    async for c in db.comments.find({"created_at": {"$gte": since}}, {"_id": 0}).sort("created_at", -1).limit(300):
        cid = c.get("id") or f"cmt:{c.get('obs_id')}:{c.get('created_at')}"
        text = (c.get("text") or "").strip()
        if cid in scanned or len(text) < 12:
            continue
        out.append({"content_id": cid, "user_id": c.get("user_id"), "nickname": c.get("nickname"),
                    "kind": "comment", "text": text[:600], "lat": None, "lon": None, "created_at": c.get("created_at")})
    out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return out[:limit]


RESONANCE_SYSTEM = (
    "You are Ecoes, the resonance engine of OverView. You receive a numbered list of short human "
    "contents (thoughts, observation captions, comments) from DIFFERENT users. Your task is to detect "
    "DEEP, AUTHENTIC RESONANCES between contents of DIFFERENT users.\n\n"
    "A resonance is NOT topic overlap. Two people talking about the sky, music or loneliness are NOT "
    "automatically connected. Look for deeper relations: shared meaning, perspective, way of interpreting "
    "something, expressed mood, experience, intuition, implicit question, sensibility, conceptual "
    "association, or COMPLEMENTARITY between two different thoughts. Contents on the exact same topic may "
    "have NO resonance; very different contents MAY resonate.\n\n"
    "Rules:\n"
    "- Group only contents from at least 2 DISTINCT users.\n"
    "- Return at most 3 groups, each a genuinely DIFFERENT resonance (not variations of the same one).\n"
    "- Quality over quantity. If nothing is genuinely significant, return an empty list. Better zero than forced.\n"
    "- For each group produce: a short evocative title (max ~6 words, no hashtags), a short description "
    "(1-2 sentences) describing the NATURE of the resonance, and a 'reason' (1 sentence, why these voices "
    "resonate). Write title/description/reason in the language most represented in the group.\n"
    'Respond ONLY with compact JSON: {"groups":[{"title":"","description":"","reason":"","members":[<indices>]}]}'
)


async def _llm_resonance(items: List[dict]) -> List[dict]:
    if not EMERGENT_LLM_KEY:
        return []
    lines = []
    for i, it in enumerate(items):
        lines.append(f'[{i}] (user {it["user_id"][:6]}, {it["kind"]}) {it["text"]}')
    prompt = "CONTENTS:\n" + "\n".join(lines)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                       system_message=RESONANCE_SYSTEM).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(text=prompt))
        raw = resp if isinstance(resp, str) else (getattr(resp, "text", None) or str(resp))
        s, e = raw.find("{"), raw.rfind("}")
        data = json.loads(raw[s:e + 1]) if s != -1 else {}
        return data.get("groups", []) or []
    except Exception as ex:
        logger.warning(f"resonance LLM failed: {ex}")
        return []


async def run_resonance_cycle(limit: int = SCAN_BATCH) -> dict:
    items = await _gather_candidates(limit)
    result = {"scanned": len(items), "connections_created": 0, "proposals": 0}
    if len({it["user_id"] for it in items}) < 2:
        # still mark scanned to avoid rescanning tiny pools forever
        for it in items:
            await db.ecoes_scanned.update_one({"content_id": it["content_id"]}, {"$set": {"content_id": it["content_id"], "at": _now()}}, upsert=True)
        return result

    groups = await _llm_resonance(items)
    created = 0
    for g in groups[:MAX_GROUPS_PER_CYCLE]:
        idxs = [i for i in (g.get("members") or []) if isinstance(i, int) and 0 <= i < len(items)]
        members = [items[i] for i in idxs]
        users = list(dict.fromkeys(m["user_id"] for m in members))  # distinct, ordered
        if len(users) < 2:
            continue
        title = (g.get("title") or "Connection").strip()[:80]
        desc = (g.get("description") or "").strip()[:300]
        reason = (g.get("reason") or "").strip()[:300]
        # Origin = first member content that has real coordinates.
        origin = next((m for m in members if m.get("lat") is not None and m.get("lon") is not None), members[0])
        cid = str(uuid.uuid4())
        dlat, dlon = _display_coords(cid, origin.get("lat"), origin.get("lon"))
        conn = {
            "id": cid, "title": title, "description": desc, "status": "proposed",
            "title_history": [{"title": title, "reason": "Titolo iniziale generato dalla risonanza", "at": _now()}],
            "origin": {"lat": origin.get("lat"), "lon": origin.get("lon")},  # internal only
            "display": {"lat": dlat, "lon": dlon},
            "source_content_id": origin["content_id"],
            "created_at": _now(), "last_activity_at": _now(),
        }
        await db.ecoes_connections.insert_one(conn)
        for uid in users:
            await db.ecoes_proposals.insert_one({
                "id": str(uuid.uuid4()), "connection_id": cid, "user_id": uid,
                "status": "pending", "reason": reason, "created_at": _now(),
            })
            await notify(uid, "ecoes", "Ecoes™",
                         "È stata rilevata una possibile Connection Ecoes.",
                         action_url=f"/ecoes-world?proposal={cid}")
            result["proposals"] += 1
        created += 1
    result["connections_created"] = created
    for it in items:
        await db.ecoes_scanned.update_one({"content_id": it["content_id"]}, {"$set": {"content_id": it["content_id"], "at": _now()}}, upsert=True)
    return result


async def resonance_loop():
    # Periodic automatic detection. MVP cadence; later → near real-time with
    # semantic pre-selection before the expensive model.
    await asyncio.sleep(90)
    while True:
        try:
            r = await run_resonance_cycle()
            if r.get("connections_created"):
                logger.info(f"Ecoes resonance cycle: {r}")
        except Exception as ex:
            logger.warning(f"resonance loop error: {ex}")
        await asyncio.sleep(3600)  # every hour


# --------------------------------------------------------------------------- #
# Public serialisers
# --------------------------------------------------------------------------- #
async def _conn_public(conn: dict, intensity: Optional[float] = None) -> dict:
    if intensity is None:
        intensity = await _intensity(conn)
    return {
        "id": conn["id"], "title": conn["title"], "description": conn.get("description", ""),
        "status": conn.get("status"), "lat": conn["display"]["lat"], "lon": conn["display"]["lon"],
        "intensity": intensity, "dormant": intensity < 0.28,
    }


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@ecoes_router.get("/globe")
async def globe():
    """All living Connections on the Globe — title + short description + pulsation.
    Never participants, contents or numbers."""
    out = []
    async for conn in db.ecoes_connections.find({"status": {"$in": ["active", "dormant"]}}, {"_id": 0}).limit(1000):
        out.append(await _conn_public(conn))
    return {"items": out}


@ecoes_router.get("/proposals")
async def my_proposals(user: dict = Depends(get_current_user)):
    out = []
    async for p in db.ecoes_proposals.find({"user_id": user["id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).limit(50):
        conn = await db.ecoes_connections.find_one({"id": p["connection_id"], "status": {"$ne": "deleted"}}, {"_id": 0})
        if not conn:
            continue
        out.append({"proposal_id": p["id"], "connection_id": conn["id"],
                    "title": conn["title"], "description": conn.get("description", ""), "reason": p.get("reason", "")})
    return {"items": out}


@ecoes_router.post("/proposals/{proposal_id}/decline")
async def decline_proposal(proposal_id: str, user: dict = Depends(get_current_user)):
    await db.ecoes_proposals.update_one({"id": proposal_id, "user_id": user["id"]}, {"$set": {"status": "declined"}})
    return {"ok": True}


@ecoes_router.post("/proposals/{proposal_id}/accept")
async def accept_proposal(proposal_id: str, user: dict = Depends(get_active_user)):
    p = await db.ecoes_proposals.find_one({"id": proposal_id, "user_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Proposta non trovata")
    conn = await db.ecoes_connections.find_one({"id": p["connection_id"], "status": {"$ne": "deleted"}}, {"_id": 0})
    if not conn:
        raise HTTPException(status_code=410, detail="Questa Connection non è più disponibile")
    await db.ecoes_proposals.update_one({"id": proposal_id}, {"$set": {"status": "accepted"}})
    await db.ecoes_members.update_one(
        {"connection_id": conn["id"], "user_id": user["id"]},
        {"$set": {"connection_id": conn["id"], "user_id": user["id"], "nickname": user.get("nickname"),
                  "active": True, "joined_at": _now(), "left_at": None}}, upsert=True)
    active = await _active_members(conn["id"])
    born = False
    if conn.get("status") == "proposed" and len(active) >= 2:
        await db.ecoes_connections.update_one({"id": conn["id"]}, {"$set": {"status": "active", "last_activity_at": _now()}})
        born = True
        for m in active:
            await notify(m["user_id"], "ecoes", "Ecoes™", f"La Connection «{conn['title']}» è nata.", action_url=f"/ecoes-room?id={conn['id']}")
    # If still the only one who accepted, the proposal simply waits for others.
    room_ready = born or conn.get("status") == "active"
    return {"ok": True, "room_ready": room_ready, "connection_id": conn["id"], "born": born}


@ecoes_router.get("/my")
async def my_ecoes(user: dict = Depends(get_current_user)):
    out = []
    async for m in db.ecoes_members.find({"user_id": user["id"], "active": True}, {"_id": 0}):
        conn = await db.ecoes_connections.find_one({"id": m["connection_id"], "status": {"$in": ["active", "dormant"]}}, {"_id": 0})
        if conn:
            out.append(await _conn_public(conn))
    out.sort(key=lambda c: c["intensity"], reverse=True)
    return {"items": out}


@ecoes_router.get("/rooms/{cid}")
async def room_detail(cid: str, user: dict = Depends(get_current_user)):
    m = await db.ecoes_members.find_one({"connection_id": cid, "user_id": user["id"], "active": True}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=403, detail="Non fai parte di questa Connection")
    conn = await db.ecoes_connections.find_one({"id": cid, "status": {"$in": ["active", "dormant"]}}, {"_id": 0})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection non trovata")
    members = await _active_members(cid)
    posts = await db.ecoes_posts.find({"connection_id": cid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {
        "connection": await _conn_public(conn),
        "title_history": conn.get("title_history", []),
        "participants": [{"user_id": x["user_id"], "nickname": x.get("nickname")} for x in members],
        "posts": posts,
    }


class RoomPost(BaseModel):
    text: str
    kind: str = "thought"  # "thought" | "comment"


@ecoes_router.post("/rooms/{cid}/posts")
async def room_post(cid: str, req: RoomPost, user: dict = Depends(get_active_user)):
    m = await db.ecoes_members.find_one({"connection_id": cid, "user_id": user["id"], "active": True}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=403, detail="Non fai parte di questa Connection")
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Il contenuto non può essere vuoto")
    doc = {"id": str(uuid.uuid4()), "connection_id": cid, "user_id": user["id"], "nickname": user.get("nickname"),
           "kind": req.kind if req.kind in ("thought", "comment") else "thought", "text": text[:3000], "created_at": _now()}
    await db.ecoes_posts.insert_one(doc)
    await db.ecoes_connections.update_one({"id": cid}, {"$set": {"last_activity_at": _now(), "status": "active"}})
    doc.pop("_id", None)
    return doc


@ecoes_router.post("/rooms/{cid}/leave")
async def leave_room(cid: str, user: dict = Depends(get_current_user)):
    await db.ecoes_members.update_one({"connection_id": cid, "user_id": user["id"]},
                                      {"$set": {"active": False, "left_at": _now()}})
    remaining = await _active_members(cid)
    if len(remaining) == 0:
        # Only when the LAST participant leaves, the Connection is deleted forever.
        await db.ecoes_connections.update_one({"id": cid}, {"$set": {"status": "deleted"}})
        await db.ecoes_posts.delete_many({"connection_id": cid})
        await db.ecoes_proposals.delete_many({"connection_id": cid})
        return {"ok": True, "deleted": True}
    return {"ok": True, "deleted": False}


# Developer-only manual cycle (NOT user-facing; used for testing/seed).
@ecoes_router.post("/admin/run-cycle")
async def admin_run_cycle(user: dict = Depends(get_current_user)):
    if user.get("role") != "developer":
        raise HTTPException(status_code=403, detail="Solo il Creator")
    return await run_resonance_cycle()


async def ensure_ecoes_indexes():
    await db.ecoes_connections.create_index("id", unique=True)
    await db.ecoes_connections.create_index("status")
    await db.ecoes_proposals.create_index([("user_id", 1), ("status", 1)])
    await db.ecoes_proposals.create_index("connection_id")
    await db.ecoes_members.create_index([("connection_id", 1), ("active", 1)])
    await db.ecoes_members.create_index([("user_id", 1), ("active", 1)])
    await db.ecoes_posts.create_index([("connection_id", 1), ("created_at", 1)])
    await db.ecoes_scanned.create_index("content_id", unique=True)
