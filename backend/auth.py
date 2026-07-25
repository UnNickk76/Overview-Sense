"""Authentication — modular JWT (email + password) designed for future OAuth providers.

Identity is anchored to an internal uuid `id` (independent of login method). Each user
holds an `auth_providers` array so Apple / Google can be appended later with no migration.
"""
import re
import os
import uuid
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from database import db, JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_DAYS

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
NICK_RE = re.compile(r"^[a-zA-Z0-9_.]+$")

# ---------------------------------------------------------------------------
# Author code — permanent, immutable, globally-unique 3-char identity (e.g. NEO,
# NE1). Derived from the nickname, made unique via a deterministic sequence + a
# unique index safety net. Assigned once; NEVER changed even if nickname changes.
# ---------------------------------------------------------------------------
AUTHOR_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
_ABASE = len(AUTHOR_ALPHABET)
_AMAX = _ABASE ** 3


def _norm_seed(nickname: str) -> str:
    s = re.sub(r"[^A-Z0-9]", "", (nickname or "").upper())
    return (s[:3] or "AAA").ljust(3, "A")


def _code_to_num(code: str) -> int:
    n = 0
    for ch in code:
        n = n * _ABASE + AUTHOR_ALPHABET.index(ch)
    return n


def _num_to_code(n: int) -> str:
    out = []
    for _ in range(3):
        out.append(AUTHOR_ALPHABET[n % _ABASE])
        n //= _ABASE
    return "".join(reversed(out))


def author_candidate(nickname: str, attempt: int) -> str:
    start = _code_to_num(_norm_seed(nickname))
    return _num_to_code((start + attempt) % _AMAX)


# ---------------------------------------------------------------------------
# Password / token helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": sub, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "email": doc.get("email"),
        "nickname": doc.get("nickname"),
        "display_name": doc.get("display_name", ""),
        "bio": doc.get("bio", ""),
        "avatar": doc.get("avatar"),
        "author_code": doc.get("author_code"),
        "links": doc.get("links", []),
        "role": doc.get("role", "user"),
        "protected": doc.get("protected", False),
        "created_at": doc.get("created_at"),
    }


# ---------------------------------------------------------------------------
# Protected developer/founder account — flagged server-side only
# ---------------------------------------------------------------------------
DEVELOPER_EMAIL = os.environ.get("DEVELOPER_EMAIL", "fandrex1@gmail.com")
DEVELOPER_NICK = os.environ.get("DEVELOPER_NICK", "NeoMorpheus")
DEVELOPER_PASSWORD = os.environ.get("DEVELOPER_PASSWORD", "")  # seed only; owner-changeable afterwards
DEVELOPER_BADGE = None  # Creator identity is hidden — no public badge.

# Brute-force protection
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

# role=developer + protected are kept SERVER-SIDE ONLY (Creator Console access &
# immutable identity). No visible badge: NeoMorpheus appears as a normal user.
DEVELOPER_FLAGS = {"role": "developer", "protected": True, "verified": False, "verified_badge": None}

# Apple App Store review account (normal user) — must exist in production for review.
REVIEW_EMAIL = os.environ.get("REVIEW_EMAIL", "apple@overview.app")
REVIEW_NICK = os.environ.get("REVIEW_NICK", "Apple")
REVIEW_PASSWORD = os.environ.get("REVIEW_PASSWORD", "")


async def _seed_password_user(email: str, nick: str, password: str, flags: dict):
    """Create the account with the seed password if missing; if it already exists,
    only (re)apply flags. The password is NEVER overwritten (owner-changeable).
    If no seed password is configured (env var absent), only flags are applied to an
    existing account — a new account is never created with an empty password."""
    existing = await db.users.find_one({"email_lower": email})
    if existing:
        if flags:
            await db.users.update_one({"email_lower": email}, {"$set": flags})
        return
    if not password:
        return  # no seed password configured for this environment → skip creation
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "email": email, "email_lower": email,
        "nickname": nick, "nickname_lower": nick.lower(),
        "bio": "", "avatar": None,
        "auth_providers": [
            {"provider": "password", "password_hash": hash_password(password),
             "created_at": now, "last_login_at": now},
        ],
        "created_at": now, "updated_at": now,
        **flags,
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError:
        if flags:
            await db.users.update_one({"email_lower": email}, {"$set": flags})


async def ensure_developer_account():
    """Seed + blind the founder account AND the Apple review account in EVERY
    environment (preview + production). Runs at startup; idempotent; never
    overwrites an existing password."""
    await _seed_password_user(DEVELOPER_EMAIL, DEVELOPER_NICK, DEVELOPER_PASSWORD, DEVELOPER_FLAGS)
    await _seed_password_user(REVIEW_EMAIL, REVIEW_NICK, REVIEW_PASSWORD, {})


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterReq(BaseModel):
    email: str
    nickname: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=6, max_length=128)


class LoginReq(BaseModel):
    email: str
    password: str


# ---------------------------------------------------------------------------
# Indexes
# ---------------------------------------------------------------------------
async def ensure_auth_indexes():
    await db.users.create_index("id", unique=True)
    await db.users.create_index("email_lower", unique=True)
    await db.users.create_index("nickname_lower", unique=True)
    await db.users.create_index("author_code", unique=True, sparse=True)
    await backfill_author_codes()


async def backfill_author_codes():
    """Idempotent: assign a unique author_code to any user missing one."""
    cursor = db.users.find({"author_code": {"$exists": False}}, {"id": 1, "nickname": 1})
    async for u in cursor:
        for attempt in range(_AMAX):
            code = author_candidate(u.get("nickname", ""), attempt)
            try:
                res = await db.users.update_one(
                    {"id": u["id"], "author_code": {"$exists": False}},
                    {"$set": {"author_code": code}},
                )
                if res.modified_count == 1:
                    break
            except DuplicateKeyError:
                continue


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@auth_router.post("/register")
async def register(req: RegisterReq):
    email = req.email.strip().lower()
    nickname = req.nickname.strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Email non valida")
    if not NICK_RE.match(nickname):
        raise HTTPException(status_code=400, detail="Il nickname può contenere solo lettere, numeri, . e _")

    now = datetime.now(timezone.utc).isoformat()
    base_doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "email_lower": email,
        "nickname": nickname,
        "nickname_lower": nickname.lower(),
        "bio": "",
        "avatar": None,
        "auth_providers": [
            {"provider": "password", "password_hash": hash_password(req.password),
             "created_at": now, "last_login_at": now},
        ],
        "created_at": now,
        "updated_at": now,
    }
    # Assign a globally-unique, immutable author_code. The unique index is the
    # arbiter: on collision we advance to the next code and retry.
    doc = None
    for attempt in range(_AMAX):
        candidate = dict(base_doc, author_code=author_candidate(nickname, attempt))
        try:
            await db.users.insert_one(candidate)
            doc = candidate
            break
        except DuplicateKeyError as e:
            key = str(getattr(e, "details", {}) or {})
            if "author_code" in key or "author_code" in str(e):
                continue  # code taken → next candidate
            field = "email" if "email" in str(e) else "nickname"
            raise HTTPException(status_code=409,
                                detail=f"{'Email' if field == 'email' else 'Nickname'} già in uso")
    if doc is None:
        raise HTTPException(status_code=500, detail="Impossibile assegnare il codice autore")
    token = create_access_token(doc["id"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(doc)}


@auth_router.get("/nickname-available")
async def nickname_available(nickname: str):
    nick = (nickname or "").strip()
    if len(nick) < 3 or len(nick) > 24:
        return {"available": False, "reason": "length"}
    if not NICK_RE.match(nick):
        return {"available": False, "reason": "chars"}
    exists = await db.users.find_one({"nickname_lower": nick.lower()}, {"_id": 1})
    return {"available": exists is None}


@auth_router.post("/login")
async def login(req: LoginReq):
    email = req.email.strip().lower()
    doc = await db.users.find_one({"email_lower": email})
    if not doc:
        raise HTTPException(status_code=401, detail="Email o password non corretti")

    # Account lockout (brute-force protection)
    now = datetime.now(timezone.utc)
    lock = doc.get("lockout_until")
    if lock:
        try:
            lock_dt = datetime.fromisoformat(lock)
            if lock_dt > now:
                mins = max(1, int((lock_dt - now).total_seconds() // 60) + 1)
                raise HTTPException(status_code=429,
                                    detail=f"Account temporaneamente bloccato. Riprova tra {mins} min.")
        except HTTPException:
            raise
        except Exception:
            pass

    pw_provider = next((p for p in doc.get("auth_providers", []) if p.get("provider") == "password"), None)
    if not pw_provider or not verify_password(req.password, pw_provider.get("password_hash", "")):
        attempts = int(doc.get("failed_login_attempts", 0)) + 1
        upd: dict = {"failed_login_attempts": attempts}
        if attempts >= MAX_FAILED_ATTEMPTS:
            upd["lockout_until"] = (now + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            upd["failed_login_attempts"] = 0
        await db.users.update_one({"id": doc["id"]}, {"$set": upd})
        if "lockout_until" in upd:
            raise HTTPException(status_code=429,
                                detail=f"Troppi tentativi. Account bloccato per {LOCKOUT_MINUTES} min.")
        raise HTTPException(status_code=401, detail="Email o password non corretti")

    now_iso = now.isoformat()
    await db.users.update_one(
        {"id": doc["id"], "auth_providers.provider": "password"},
        {"$set": {"auth_providers.$.last_login_at": now_iso, "updated_at": now_iso,
                  "failed_login_attempts": 0, "lockout_until": None}},
    )
    token = create_access_token(doc["id"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(doc)}


class ChangePasswordReq(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non autenticato",
                        headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise exc
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            raise exc
    except JWTError:
        raise exc
    user = await db.users.find_one({"id": uid})
    if not user:
        raise exc
    return user


async def get_optional_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> Optional[dict]:
    if creds is None:
        return None
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
    except JWTError:
        return None
    return await db.users.find_one({"id": uid}) if uid else None


@auth_router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@auth_router.post("/change-password")
async def change_password(req: ChangePasswordReq, user: dict = Depends(get_current_user)):
    pw_provider = next((p for p in user.get("auth_providers", []) if p.get("provider") == "password"), None)
    if not pw_provider:
        raise HTTPException(status_code=400, detail="Account senza password")
    if not verify_password(req.current_password, pw_provider.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Password attuale non corretta")
    if verify_password(req.new_password, pw_provider.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="La nuova password deve essere diversa da quella attuale")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user["id"], "auth_providers.provider": "password"},
        {"$set": {"auth_providers.$.password_hash": hash_password(req.new_password),
                  "auth_providers.$.password_changed_at": now_iso, "updated_at": now_iso}},
    )
    return {"ok": True}
