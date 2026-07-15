"""Community growth & consent — Discover People™, invites, Presence Match™.

Philosophy: OverView observes the world, it does not identify people. The only
person who can be auto-recognized is the account owner (opt-in). Anyone else is
only ever named if BOTH sides agree, via a consent-based mention request.
Face detection/embeddings (the camera engine) live in the native layer; this
module owns the consent, the mention workflow, Match History and discovery.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from auth import get_current_user, get_optional_user

community_router = APIRouter(prefix="/api/community", tags=["community"])


async def ensure_community_indexes():
    await db.mention_requests.create_index("id", unique=True)
    await db.mention_requests.create_index([("target_id", 1), ("status", 1)])
    await db.mention_requests.create_index("author_id")
    await db.mention_requests.create_index([("obs_id", 1), ("target_id", 1)], unique=True)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Presence Match™ consent & privacy levels
# ---------------------------------------------------------------------------
# Level 1: no Presence Match — never appear as an OverView user.
# Level 2: allow mention requests; if refused, photo stays normal, no ID.
# Level 3: allow requests; if refused, OverView blurs my face (native, C2).
# Level 4: auto-accept mentions using my chosen identity.
VALID_LEVELS = {1, 2, 3, 4}
VALID_IDENTITY = {"name", "nickname", "none"}


def _privacy_public(u: dict) -> dict:
    return {
        "presence_level": int(u.get("presence_level", 1)),
        "face_scanned": bool(u.get("face_scanned", False)),
        "identity_pref": u.get("identity_pref", "nickname"),
    }


@community_router.get("/privacy")
async def get_privacy(user: dict = Depends(get_current_user)):
    return _privacy_public(user)


class PrivacyUpdate(BaseModel):
    presence_level: Optional[int] = None
    face_scanned: Optional[bool] = None
    identity_pref: Optional[str] = None


@community_router.patch("/privacy")
async def update_privacy(req: PrivacyUpdate, user: dict = Depends(get_current_user)):
    updates: dict = {}
    if req.presence_level is not None:
        if req.presence_level not in VALID_LEVELS:
            raise HTTPException(status_code=400, detail="Livello privacy non valido")
        updates["presence_level"] = req.presence_level
    if req.face_scanned is not None:
        updates["face_scanned"] = bool(req.face_scanned)
    if req.identity_pref is not None:
        if req.identity_pref not in VALID_IDENTITY:
            raise HTTPException(status_code=400, detail="Preferenza identità non valida")
        updates["identity_pref"] = req.identity_pref
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]})
    return _privacy_public(u)


# ---------------------------------------------------------------------------
# Mention requests (consent-based) + Match History™
# ---------------------------------------------------------------------------
def _display_for(u: dict, decision: str) -> Optional[str]:
    if decision == "name":
        return (u.get("display_name") or u.get("nickname") or "").strip() or u.get("nickname")
    if decision == "nickname":
        return u.get("nickname")
    return None  # "none" → visible but not identified


async def _apply_mention(obs_id: str, target_id: str, display: Optional[str]):
    """Attach an accepted mention to the observation (only after consent)."""
    o = await db.observations.find_one({"id": obs_id}, {"_id": 0, "data": 1})
    if not o:
        return
    data = dict(o.get("data") or {})
    mentions = [m for m in (data.get("mentions") or []) if m.get("user_id") != target_id]
    if display:
        mentions.append({"user_id": target_id, "display": display})
    data["mentions"] = mentions
    await db.observations.update_one({"id": obs_id}, {"$set": {"data": data}})


class MentionReq(BaseModel):
    obs_id: str
    target_id: str


@community_router.post("/mentions")
async def create_mention(req: MentionReq, user: dict = Depends(get_current_user)):
    """Author asks to mention a detected OverView user. The author NEVER learns
    the target's identity unless the target voluntarily accepts."""
    if req.target_id == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi menzionare te stesso")
    obs = await db.observations.find_one({"id": req.obs_id}, {"_id": 0, "user_id": 1})
    if not obs:
        raise HTTPException(status_code=404, detail="Senshot non trovato")
    if obs["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non sei l'autore di questo Senshot")
    target = await db.users.find_one({"id": req.target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    level = int(target.get("presence_level", 1))
    if level < 2:
        # Level 1 → never appears as an OverView user. Silently no-op (privacy).
        return {"status": "unavailable"}

    now = _now_iso()
    # Level 4 → auto-accept with the target's chosen identity.
    if level >= 4:
        decision = target.get("identity_pref", "nickname")
        if decision == "none":
            display = None
        else:
            display = _display_for(target, decision)
        await _apply_mention(req.obs_id, req.target_id, display)
        status = f"accepted_{decision}"
        doc = {
            "id": str(uuid.uuid4()), "obs_id": req.obs_id, "author_id": user["id"],
            "author_nick": user.get("nickname"), "target_id": req.target_id,
            "status": status, "created_at": now, "responded_at": now, "auto": True,
        }
        try:
            await db.mention_requests.insert_one(doc)
        except Exception:
            await db.mention_requests.update_one(
                {"obs_id": req.obs_id, "target_id": req.target_id},
                {"$set": {"status": status, "responded_at": now}})
        return {"status": status}

    # Levels 2/3 → create a pending request the target reviews.
    doc = {
        "id": str(uuid.uuid4()), "obs_id": req.obs_id, "author_id": user["id"],
        "author_nick": user.get("nickname"), "target_id": req.target_id,
        "status": "pending", "created_at": now, "responded_at": None,
    }
    try:
        await db.mention_requests.insert_one(doc)
    except Exception:
        raise HTTPException(status_code=409, detail="Richiesta già inviata per questo Senshot")
    return {"status": "pending"}


def _request_public(r: dict, obs: Optional[dict]) -> dict:
    return {
        "id": r["id"],
        "obs_id": r["obs_id"],
        "author_nick": r.get("author_nick"),
        "status": r.get("status"),
        "created_at": r.get("created_at"),
        "image_url": f"/api/media/{r['obs_id']}" if obs and obs.get("has_image") else None,
        "caption": obs.get("caption") if obs else None,
    }


@community_router.get("/mentions/incoming")
async def incoming_mentions(user: dict = Depends(get_current_user)):
    """Match History™ — every Senshot where I was (or could be) mentioned."""
    rows = await db.mention_requests.find(
        {"target_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    out = []
    for r in rows:
        obs = await db.observations.find_one({"id": r["obs_id"]}, {"_id": 0, "has_image": 1, "caption": 1})
        out.append(_request_public(r, obs))
    appeared = sum(1 for r in rows if str(r.get("status", "")).startswith("accepted"))
    return {"items": out, "appeared": appeared, "count": len(rows)}


@community_router.get("/mentions/summary")
async def mentions_summary(user: dict = Depends(get_current_user)):
    pending = await db.mention_requests.count_documents({"target_id": user["id"], "status": "pending"})
    appeared = await db.mention_requests.count_documents(
        {"target_id": user["id"], "status": {"$regex": "^accepted"}})
    return {"pending": pending, "appeared": appeared}


class RespondReq(BaseModel):
    decision: str  # "name" | "nickname" | "none" | "reject"


@community_router.post("/mentions/{req_id}/respond")
async def respond_mention(req_id: str, req: RespondReq, user: dict = Depends(get_current_user)):
    r = await db.mention_requests.find_one({"id": req_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Richiesta non trovata")
    if r["target_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non sei il destinatario di questa richiesta")
    dec = req.decision
    if dec not in {"name", "nickname", "none", "reject"}:
        raise HTTPException(status_code=400, detail="Decisione non valida")
    now = _now_iso()
    if dec == "reject":
        await db.mention_requests.update_one({"id": req_id}, {"$set": {"status": "rejected", "responded_at": now}})
        await _apply_mention(r["obs_id"], user["id"], None)  # ensure not mentioned
        return {"status": "rejected"}
    display = _display_for(user, dec)
    await _apply_mention(r["obs_id"], user["id"], display)
    status = f"accepted_{dec}"
    await db.mention_requests.update_one({"id": req_id}, {"$set": {"status": status, "responded_at": now}})
    return {"status": status}


# ---------------------------------------------------------------------------
# Discover People™ — grow your network from REAL, shared signals
# ---------------------------------------------------------------------------
def _user_card(u: dict, reason: str, score: int) -> dict:
    return {
        "id": u["id"], "nickname": u.get("nickname"),
        "display_name": u.get("display_name", ""), "avatar": u.get("avatar"),
        "bio": u.get("bio", ""), "reason": reason, "score": score,
    }


@community_router.get("/discover")
async def discover_people(limit: int = 24, user: dict = Depends(get_current_user)):
    me = user["id"]
    # Who I already follow (exclude from suggestions).
    following = {f["following_id"] async for f in db.follows.find({"follower_id": me}, {"following_id": 1, "_id": 0})}
    exclude = following | {me}

    # My real signals: Pulse™ completed + places observed.
    my_obs = await db.observations.find(
        {"user_id": me}, {"_id": 0, "pulse_task": 1, "lat": 1, "lon": 1}).to_list(500)
    my_pulses = {o["pulse_task"]["id"] for o in my_obs if o.get("pulse_task", {}) and o.get("pulse_task", {}).get("id")}
    my_places = [(o["lat"], o["lon"]) for o in my_obs if o.get("lat") is not None and o.get("lon") is not None]

    # Friends-of-friends (accounts my follows follow).
    fof: dict = {}
    if following:
        async for f in db.follows.find({"follower_id": {"$in": list(following)}}, {"following_id": 1, "_id": 0}).limit(3000):
            t = f["following_id"]
            if t not in exclude:
                fof[t] = fof.get(t, 0) + 1

    # Candidate pool: friends-of-friends + recent + active authors.
    candidates: dict = {c: {"score": 0, "reasons": []} for c in fof}
    for c, n in fof.items():
        candidates[c]["score"] += min(n, 5) * 6
        candidates[c]["reasons"].append(("mutual", n))

    # Others' observations → shared Pulse & nearby places.
    others = await db.observations.find(
        {"user_id": {"$nin": list(exclude)}},
        {"_id": 0, "user_id": 1, "pulse_task": 1, "lat": 1, "lon": 1},
    ).sort("created_at", -1).limit(4000).to_list(4000)
    for o in others:
        uid = o["user_id"]
        if uid in exclude:
            continue
        entry = candidates.setdefault(uid, {"score": 0, "reasons": []})
        pid = (o.get("pulse_task") or {}).get("id")
        if pid and pid in my_pulses and not any(r[0] == "pulse" for r in entry["reasons"]):
            entry["score"] += 12
            entry["reasons"].append(("pulse", pid))
        if o.get("lat") is not None and my_places and not any(r[0] == "place" for r in entry["reasons"]):
            for (la, lo) in my_places:
                if abs(o["lat"] - la) < 0.15 and abs(o["lon"] - lo) < 0.15:  # ~15 km
                    entry["score"] += 9
                    entry["reasons"].append(("place", None))
                    break

    # Recently joined boost.
    recent_cut = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()

    if not candidates:
        # Cold start: surface recent active users.
        async for o in db.observations.find({"user_id": {"$nin": list(exclude)}}, {"_id": 0, "user_id": 1}).sort("created_at", -1).limit(200):
            candidates.setdefault(o["user_id"], {"score": 1, "reasons": [("active", None)]})

    ids = list(candidates.keys())[:400]
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}})}
    cards = []
    for uid, info in candidates.items():
        u = users.get(uid)
        if not u:
            continue
        score = info["score"]
        reason = "Attivo su OverView™"
        rset = {r[0] for r in info["reasons"]}
        if u.get("created_at", "") > recent_cut:
            score += 5
            reason = "Si è iscritto da poco"
        if "pulse" in rset:
            reason = "Ha completato i tuoi stessi Pulse™"
        elif "place" in rset:
            reason = "Ha osservato i tuoi stessi luoghi"
        elif "mutual" in rset:
            n = next((r[1] for r in info["reasons"] if r[0] == "mutual"), 1)
            reason = f"{n} amici in comune" if n > 1 else "1 amico in comune"
        cards.append(_user_card(u, reason, score))

    cards.sort(key=lambda c: c["score"], reverse=True)
    return {"items": cards[:max(1, min(limit, 50))]}


@community_router.get("/invite")
async def invite(user: dict = Depends(get_current_user)):
    """A personal invite payload — the QR is rendered client-side from `url`."""
    nick = user.get("nickname", "")
    code = user["id"][:8]
    url = f"https://overview.app/i/{nick}?ref={code}"
    return {
        "url": url,
        "code": code,
        "nickname": nick,
        "message": f"Osserva la realtà invisibile con me su OverView™ 🔭 {url}",
    }
