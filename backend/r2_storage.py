"""Cloudflare R2 (S3-compatible) media storage.

All binary media lives in R2; MongoDB `db.media` keeps ONLY metadata (key(s),
bucket, prefix, content_type, size, storage, variants...) — never the payload.

`db.media.id` stays equal to the owning entity id (observation / snapsense /
`avatar_{uid}` / audio uuid) so every existing `/api/media/{id}` URL keeps
working. The serve route accepts an optional `?size=` for observation images.

Bucket organisation (logical prefixes — R2 has no real folders):
    users/avatars/          avatar images
    observe/originals/      untouched uploaded observation image
    observe/master/         high-res (2048px)
    observe/detail/         detail view (1440px)
    observe/feed/           feed cards (800px)
    observe/thumbnails/     grids / Explore (320px)
    pulse/                  Pulse images
    snapsense/              SnapSense images
    chat/                   DM images
    system/                 audio & misc
    temp/                   scratch uploads (auto-purged)
"""
import os
import io
import base64
import uuid
import asyncio
import mimetypes
from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.config import Config
from PIL import Image, ImageOps

from database import db

# Whitelisted logical prefixes (full object-key prefixes).
PREFIXES = {
    "users/avatars",
    "observe/originals", "observe/master", "observe/detail", "observe/feed", "observe/thumbnails",
    "pulse", "snapsense", "chat", "system", "temp",
}

# Observation image size tiers → (prefix, max_edge_px, jpeg_quality). "original"
# is stored untouched. Order matters for default resolution (first available).
OBSERVE_TIERS = [
    ("master", "observe/master", 2048, 90),
    ("detail", "observe/detail", 1440, 86),
    ("feed", "observe/feed", 800, 82),
    ("thumb", "observe/thumbnails", 320, 74),
]
OBSERVE_ORIGINAL_PREFIX = "observe/originals"
SIZE_ALIASES = {
    "original": "original", "originals": "original", "orig": "original",
    "master": "master", "full": "master",
    "detail": "detail",
    "feed": "feed",
    "thumb": "thumb", "thumbnail": "thumb", "thumbnails": "thumb", "small": "thumb",
}
DEFAULT_SIZE_ORDER = ["detail", "master", "feed", "thumb", "original"]

_EXT = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/gif": ".gif", "image/heic": ".heic",
    "audio/m4a": ".m4a", "audio/mp4": ".m4a", "audio/mpeg": ".mp3",
    "audio/wav": ".wav", "audio/aac": ".aac", "audio/webm": ".webm",
}

_client = None


def _r2():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
    return _client


def _bucket() -> str:
    return os.environ["R2_BUCKET"]


def enabled() -> bool:
    return bool(os.environ.get("R2_ENDPOINT") and os.environ.get("R2_BUCKET")
                and os.environ.get("R2_ACCESS_KEY_ID") and os.environ.get("R2_SECRET_ACCESS_KEY"))


def _ext(content_type: str, original_name: Optional[str] = None) -> str:
    ct = (content_type or "").lower().split(";")[0].strip()
    if ct in _EXT:
        return _EXT[ct]
    guess = mimetypes.guess_extension(ct) if ct else None
    if guess:
        return guess
    if original_name and "." in original_name:
        return "." + original_name.rsplit(".", 1)[-1]
    return ".bin"


def _strip_data_uri(raw: str) -> str:
    if "," in raw and raw.strip().startswith("data:"):
        return raw.split(",", 1)[1]
    return raw


def _decode(raw_base64: str) -> bytes:
    return base64.b64decode(_strip_data_uri(raw_base64))


def _make_key(prefix: str, content_type: str, original_name: Optional[str] = None) -> str:
    prefix = prefix if prefix in PREFIXES else "system"
    return f"{prefix}/{uuid.uuid4().hex}{_ext(content_type, original_name)}"


# --------------------------------------------------------------------------- #
# Low-level R2 helpers (blocking calls wrapped off the event loop)
# --------------------------------------------------------------------------- #
async def _put(key: str, body: bytes, content_type: str):
    await asyncio.to_thread(_r2().put_object, Bucket=_bucket(), Key=key, Body=body, ContentType=content_type)


async def _del(key: str, bucket: Optional[str] = None):
    try:
        await asyncio.to_thread(_r2().delete_object, Bucket=bucket or _bucket(), Key=key)
    except Exception:
        pass


async def _del_doc_objects(doc: dict):
    """Delete every R2 object referenced by a media doc (single key or variants)."""
    bucket = doc.get("bucket") or _bucket()
    if doc.get("key"):
        await _del(doc["key"], bucket)
    for v in (doc.get("variants") or {}).values():
        if isinstance(v, dict) and v.get("key"):
            await _del(v["key"], bucket)


# --------------------------------------------------------------------------- #
# Image resizing (Pillow, off-thread)
# --------------------------------------------------------------------------- #
def _resize_variants(body: bytes) -> dict:
    """Return {tier: (jpeg_bytes, w, h)} for each OBSERVE tier, downscale only."""
    out: dict = {}
    with Image.open(io.BytesIO(body)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        base_w, base_h = im.size
        for tier, _prefix, max_edge, quality in OBSERVE_TIERS:
            copy = im.copy()
            if max(base_w, base_h) > max_edge:
                copy.thumbnail((max_edge, max_edge), Image.LANCZOS)
            buf = io.BytesIO()
            copy.save(buf, format="JPEG", quality=quality, optimize=True)
            out[tier] = (buf.getvalue(), copy.size[0], copy.size[1])
    return out


# --------------------------------------------------------------------------- #
# Write — single object (avatars / pulse / snapsense / audio / chat / temp)
# --------------------------------------------------------------------------- #
async def put_base64(media_id: str, prefix: str, raw_base64: str,
                     content_type: str = "image/jpeg",
                     owner: Optional[str] = None, kind: Optional[str] = None,
                     original_name: Optional[str] = None) -> str:
    body = _decode(raw_base64)
    key = _make_key(prefix, content_type, original_name)
    await _put(key, body, content_type)
    old = await db.media.find_one({"id": media_id}, {"_id": 0, "key": 1, "variants": 1, "bucket": 1})
    doc = {
        "id": media_id, "key": key, "bucket": _bucket(),
        "prefix": prefix if prefix in PREFIXES else "system",
        "content_type": content_type, "size": len(body),
        "storage": "r2", "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if owner:
        doc["owner"] = owner
    if kind:
        doc["kind"] = kind
    if original_name:
        doc["original_name"] = original_name
    await db.media.update_one({"id": media_id}, {"$set": doc, "$unset": {"data": "", "variants": ""}}, upsert=True)
    if old and (old.get("key") != key):
        await _del_doc_objects(old)
    return key


# --------------------------------------------------------------------------- #
# Write — observation image with multi-size variants
# --------------------------------------------------------------------------- #
async def put_observation_image(media_id: str, raw_base64: str,
                                content_type: str = "image/jpeg",
                                owner: Optional[str] = None) -> dict:
    """Store an observation image as originals + master/detail/feed/thumbnails.

    Falls back to a single-object store under observe/master if the bytes cannot
    be decoded as an image (keeps the pipeline crash-proof).
    """
    body = _decode(raw_base64)
    old = await db.media.find_one({"id": media_id}, {"_id": 0, "key": 1, "variants": 1, "bucket": 1})
    variants: dict = {}

    # Original (untouched)
    okey = _make_key(OBSERVE_ORIGINAL_PREFIX, content_type)
    await _put(okey, body, content_type)
    variants["original"] = {"key": okey, "size": len(body)}

    try:
        sized = await asyncio.to_thread(_resize_variants, body)
        for tier, prefix, _max_edge, _q in OBSERVE_TIERS:
            data, w, h = sized[tier]
            key = _make_key(prefix, "image/jpeg")
            await _put(key, data, "image/jpeg")
            variants[tier] = {"key": key, "size": len(data), "w": w, "h": h}
    except Exception:
        # Not a decodable image → reuse the original under "master" so serving works.
        variants["master"] = variants["original"]

    doc = {
        "id": media_id, "bucket": _bucket(), "prefix": "observe",
        "content_type": "image/jpeg", "storage": "r2", "status": "active",
        "variants": variants,
        "size": sum(v.get("size", 0) for v in variants.values()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if owner:
        doc["owner"] = owner
    await db.media.update_one({"id": media_id}, {"$set": doc, "$unset": {"data": "", "key": ""}}, upsert=True)
    if old:
        await _del_doc_objects(old)
    return doc


# --------------------------------------------------------------------------- #
# Read
# --------------------------------------------------------------------------- #
def _resolve_variant_key(doc: dict, size: Optional[str]) -> Optional[str]:
    variants = doc.get("variants") or {}
    if not variants:
        return doc.get("key")
    if size:
        tier = SIZE_ALIASES.get(size.lower())
        if tier and variants.get(tier, {}).get("key"):
            return variants[tier]["key"]
    for tier in DEFAULT_SIZE_ORDER:
        v = variants.get(tier)
        if isinstance(v, dict) and v.get("key"):
            return v["key"]
    return doc.get("key")


async def fetch_bytes(media_id: str, size: Optional[str] = None):
    """Return (bytes, content_type) for a media id (+optional size), else None.
    Serves R2 objects or, for not-yet-migrated docs, the legacy base64 field."""
    doc = await db.media.find_one({"id": media_id}, {"_id": 0})
    if not doc:
        return None
    ct = doc.get("content_type", "image/jpeg")
    key = _resolve_variant_key(doc, size)
    if key:
        try:
            obj = await asyncio.to_thread(_r2().get_object, Bucket=doc.get("bucket") or _bucket(), Key=key)
            data = await asyncio.to_thread(obj["Body"].read)
            # Variant objects are always JPEG; single objects keep their type.
            vct = "image/jpeg" if (doc.get("variants") and size != "original") else ct
            return data, vct
        except Exception:
            return None
    if doc.get("data"):
        return base64.b64decode(doc["data"]), ct
    return None


async def fetch_base64(media_id: str, size: Optional[str] = None) -> Optional[str]:
    res = await fetch_bytes(media_id, size)
    if not res:
        return None
    return base64.b64encode(res[0]).decode("ascii")


# --------------------------------------------------------------------------- #
# Delete
# --------------------------------------------------------------------------- #
async def delete(media_id: str) -> None:
    doc = await db.media.find_one({"id": media_id}, {"_id": 0})
    if not doc:
        return
    await _del_doc_objects(doc)
    await db.media.delete_one({"id": media_id})


# --------------------------------------------------------------------------- #
# Housekeeping
# --------------------------------------------------------------------------- #
async def cleanup_temp(max_age_hours: int = 24) -> int:
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=max_age_hours)).isoformat()
    removed = 0
    async for doc in db.media.find({"prefix": "temp", "created_at": {"$lt": cutoff}}, {"_id": 0}):
        await _del_doc_objects(doc)
        await db.media.delete_one({"id": doc["id"]})
        removed += 1
    return removed


async def ensure_folders() -> None:
    """Create `.keep` placeholders for every logical prefix (idempotent)."""
    if not enabled():
        return
    bucket = _bucket()
    for p in sorted(PREFIXES):
        key = f"{p}/.keep"
        try:
            await asyncio.to_thread(_r2().head_object, Bucket=bucket, Key=key)
        except Exception:
            try:
                await asyncio.to_thread(_r2().put_object, Bucket=bucket, Key=key, Body=b"", ContentType="text/plain")
            except Exception:
                pass
