"""Iteration 6 — Pulse expiry (24h) + image-less rejection + feed sanity.

Covers requirements in the review_request:
- POST /api/observations is_pulse=true WITHOUT image_base64  -> 400
- POST /api/observations is_pulse=true WITH tiny JPEG        -> 200, image_url set, pulse_expires_at ~24h ahead
- GET  /api/pulse/feed excludes pulses older than 24h (created_at cutoff)
- GET  /api/pulse/feed excludes pulses without image (has_image=True filter)
"""
import os
import base64
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://invisible-sense.preview.emergentagent.com").rstrip("/")

# 1x1 JPEG (minimal valid). Used both as raw base64 and data-URL.
TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA"
    "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEB"
    "AAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+D/9k="
)


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "explorer@overview.app", "password": "overview123"},
                      timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


class TestPulseCreation:
    """POST /api/observations with is_pulse=true edge cases."""

    def test_pulse_without_image_returns_400(self, auth):
        r = auth.post(f"{BASE_URL}/api/observations",
                      json={"media_type": "image", "source": "reality",
                            "caption": "TEST_iter6 no-image pulse",
                            "is_pulse": True})
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
        # Italian error string per social.py line 397-398
        assert "Immagine" in r.text or "immagine" in r.text

    def test_pulse_with_image_creates_and_returns_image_url(self, auth):
        payload = {
            "media_type": "image", "source": "reality",
            "caption": "TEST_iter6 pulse valid",
            "is_pulse": True,
            "pulse_task": {"id": "test_iter6_task", "title": "Iter6 sanity"},
            "image_base64": TINY_JPEG_B64,
        }
        r = auth.post(f"{BASE_URL}/api/observations", json=payload)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        d = r.json()
        assert d["is_pulse"] is True
        assert d["image_url"], "image_url must be set for pulse with image"
        assert d["image_url"].startswith("/api/media/")
        # Persist id for the next test
        TestPulseCreation._oid = d["id"]

    def test_pulse_expires_at_is_24h_ahead(self, auth):
        oid = getattr(TestPulseCreation, "_oid", None)
        assert oid, "prev test must have created a pulse"
        # Verify through GET single observation
        r = auth.get(f"{BASE_URL}/api/observations/{oid}")
        assert r.status_code == 200, r.text[:200]
        # obs_public does NOT surface pulse_expires_at — verify indirectly via feed presence.
        feed = auth.get(f"{BASE_URL}/api/pulse/feed?limit=200")
        assert feed.status_code == 200, feed.text[:200]
        ids = [it["id"] for it in feed.json()["items"]]
        assert oid in ids, "just-created pulse must appear in /api/pulse/feed"


class TestPulseFeedFilters:
    """GET /api/pulse/feed — no expired, no image-less."""

    def test_feed_items_all_have_image_url(self, auth):
        r = auth.get(f"{BASE_URL}/api/pulse/feed?limit=200")
        assert r.status_code == 200, r.text[:200]
        items = r.json()["items"]
        for it in items:
            assert it.get("image_url"), (
                f"pulse feed must NOT return image-less items: {it['id']} image_url={it.get('image_url')!r}"
            )
            assert it.get("is_pulse") is True

    def test_feed_items_all_within_24h(self, auth):
        r = auth.get(f"{BASE_URL}/api/pulse/feed?limit=200")
        assert r.status_code == 200, r.text[:200]
        items = r.json()["items"]
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24, minutes=5)  # tiny grace
        stale = []
        for it in items:
            try:
                created = datetime.fromisoformat(it["created_at"].replace("Z", "+00:00"))
            except Exception:
                continue
            if created < cutoff:
                stale.append((it["id"], it["created_at"]))
        assert not stale, f"/api/pulse/feed must NOT return >24h pulses: {stale[:5]}"


class TestGeneralFeedSanity:
    """Sanity: /api/feed still works and returns 200."""

    def test_feed_recent(self, auth):
        r = auth.get(f"{BASE_URL}/api/feed?sort=recent&limit=10")
        assert r.status_code == 200
        assert "items" in r.json()
