"""Authentication — modular JWT (email + password) designed for future OAuth providers.

Identity is anchored to an internal uuid `id` (independent of login method). Each user
holds an `auth_providers` array so Apple / Google can be appended later with no migration.
"""
import re
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
        "bio": doc.get("bio", ""),
        "avatar": doc.get("avatar"),
        "created_at": doc.get("created_at"),
    }


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
    doc = {
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
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError as e:
        field = "email" if "email" in str(e) else "nickname"
        raise HTTPException(status_code=409,
                            detail=f"{'Email' if field == 'email' else 'Nickname'} già in uso")
    token = create_access_token(doc["id"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(doc)}


@auth_router.post("/login")
async def login(req: LoginReq):
    email = req.email.strip().lower()
    doc = await db.users.find_one({"email_lower": email})
    if not doc:
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    pw_provider = next((p for p in doc.get("auth_providers", []) if p.get("provider") == "password"), None)
    if not pw_provider or not verify_password(req.password, pw_provider.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o password non corretti")
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": doc["id"], "auth_providers.provider": "password"},
        {"$set": {"auth_providers.$.last_login_at": now, "updated_at": now}},
    )
    token = create_access_token(doc["id"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(doc)}


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
