"""Backend tests for the Observe/publish unification review.

Scope (aligned with the review_request):
1. Safety net on POST /api/observations:
   - media_type=image WITHOUT image_base64 → 400 (never persist empty image post).
   - media_type=image WITH a valid tiny JPEG image_base64 → 200 with id + image_url.
   - is_pulse=true WITHOUT image → 400 (no Pulse without media).
   - is_pulse=true WITH a valid image → 200.
2. PATCH /api/observations/{id}:
   - Author can persist sense_layers / legend_on / legend_hidden; GET reflects them
     under data.senseLayers / data.legendOn / data.legendHidden.
   - Non-author gets 403.
3. GET /api/pulse/feed returns only is_pulse observations (used by the frontend
   SnapSense/Pulse story bar).
"""
import base64
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set (see /app/frontend/.env)"

# Seeded users
SEED_EMAIL = "explorer@overview.app"
SEED_PASSWORD = "overview123"

# Tiny valid JPEG (1x1). Server validates via base64.b64decode + moderator
# fails open on LLM outage → this payload is accepted.
JPEG_1PX_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
    "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA"
    "AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA"
    "AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3"
    "ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm"
    "p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMB"
    "AAIRAxEAPwD3+iiigD//2Q=="
)


# ---------------------------------------------------------------------------
# helpers / fixtures
# ---------------------------------------------------------------------------
def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def author_token():
    return _login(SEED_EMAIL, SEED_PASSWORD)


@pytest.fixture(scope="module")
def other_token():
    """Second, ephemeral user used to prove the non-author PATCH → 403 rule."""
    email = f"TEST_other_{uuid.uuid4().hex[:10]}@overview.app"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "TestPass123!", "nickname": f"tester_{uuid.uuid4().hex[:6]}"},
        timeout=30,
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or _login(email, "TestPass123!")
    assert tok
    return tok


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# 1) Safety net on POST /api/observations
# ---------------------------------------------------------------------------
class TestPublishSafetyNet:
    def test_image_without_base64_returns_400(self, author_token):
        payload = {
            "media_type": "image",
            "source": "reality",
            "description": "TEST safety net no image",
            "hashtags": ["test"],
            "data": {"lat": 41.9, "lon": 12.5},
        }
        r = requests.post(f"{BASE_URL}/api/observations", json=payload, headers=_auth(author_token), timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"
        detail = (r.json() or {}).get("detail", "")
        assert "Immagine" in detail or "immagine" in detail, f"unexpected detail: {detail}"

    def test_image_with_valid_base64_returns_200(self, author_token):
        payload = {
            "media_type": "image",
            "source": "reality",
            "description": "TEST unified publish OK",
            "hashtags": ["test", "unify"],
            "image_base64": JPEG_1PX_B64,
            "data": {"lat": 41.9, "lon": 12.5, "planets": [], "stars": [], "places": []},
        }
        r = requests.post(f"{BASE_URL}/api/observations", json=payload, headers=_auth(author_token), timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        j = r.json()
        assert j.get("id")
        assert j.get("image_url") and j["image_url"].startswith("/api/media/")

    def test_pulse_without_image_returns_400(self, author_token):
        payload = {
            "media_type": "image",
            "source": "reality",
            "description": "TEST pulse without image",
            "is_pulse": True,
            "pulse_task": {"id": "test-task", "title": "TEST"},
            "data": {"lat": 41.9, "lon": 12.5},
        }
        r = requests.post(f"{BASE_URL}/api/observations", json=payload, headers=_auth(author_token), timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_pulse_with_image_returns_200(self, author_token):
        payload = {
            "media_type": "image",
            "source": "reality",
            "description": "TEST pulse with image",
            "is_pulse": True,
            "pulse_task": {"id": "test-task", "title": "TEST"},
            "image_base64": JPEG_1PX_B64,
            "data": {"lat": 41.9, "lon": 12.5},
        }
        r = requests.post(f"{BASE_URL}/api/observations", json=payload, headers=_auth(author_token), timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        j = r.json()
        assert j.get("id") and j.get("is_pulse") is True


# ---------------------------------------------------------------------------
# 2) PATCH /api/observations/{id} — sense_layers / legend_on / legend_hidden
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def created_obs_id(author_token):
    payload = {
        "media_type": "image",
        "source": "reality",
        "description": "TEST unify PATCH target",
        "image_base64": JPEG_1PX_B64,
        "data": {"lat": 41.9, "lon": 12.5},
    }
    r = requests.post(f"{BASE_URL}/api/observations", json=payload, headers=_auth(author_token), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["id"]


class TestPatchObservation:
    def test_author_can_persist_sense_layers_and_legend(self, author_token, created_obs_id):
        body = {
            "sense_layers": ["planets", "places", "invisible"],
            "legend_on": True,
            "legend_hidden": ["stars"],
        }
        r = requests.patch(
            f"{BASE_URL}/api/observations/{created_obs_id}",
            json=body,
            headers=_auth(author_token),
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        # verify PATCH response echoes changes under data
        data = r.json().get("data") or {}
        assert data.get("senseLayers") == ["planets", "places", "invisible"]
        assert data.get("legendOn") is True
        assert data.get("legendHidden") == ["stars"]

        # verify persistence via public GET
        g = requests.get(f"{BASE_URL}/api/observations/{created_obs_id}", timeout=30)
        assert g.status_code == 200, g.text
        gdata = (g.json() or {}).get("data") or {}
        assert gdata.get("senseLayers") == ["planets", "places", "invisible"], gdata
        assert gdata.get("legendOn") is True
        assert gdata.get("legendHidden") == ["stars"]

    def test_non_author_patch_returns_403(self, other_token, created_obs_id):
        body = {"sense_layers": ["hacked"]}
        r = requests.patch(
            f"{BASE_URL}/api/observations/{created_obs_id}",
            json=body,
            headers=_auth(other_token),
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"


# ---------------------------------------------------------------------------
# 3) GET /api/pulse/feed
# ---------------------------------------------------------------------------
class TestPulseFeed:
    def test_pulse_feed_returns_only_pulses(self, author_token):
        # Ensure at least one is_pulse observation exists (created in Safety Net class,
        # but tests may run individually — create one here for isolation).
        payload = {
            "media_type": "image",
            "source": "reality",
            "description": "TEST pulse feed sanity",
            "is_pulse": True,
            "pulse_task": {"id": "test-task", "title": "TEST"},
            "image_base64": JPEG_1PX_B64,
            "data": {"lat": 41.9, "lon": 12.5},
        }
        r = requests.post(f"{BASE_URL}/api/observations", json=payload, headers=_auth(author_token), timeout=30)
        assert r.status_code == 200, r.text

        f = requests.get(f"{BASE_URL}/api/pulse/feed?limit=50", timeout=30)
        assert f.status_code == 200, f.text
        items = (f.json() or {}).get("items", [])
        assert isinstance(items, list) and len(items) >= 1
        for it in items:
            assert it.get("is_pulse") is True, f"non-pulse in pulse feed: {it.get('id')}"


# Sanity: JPEG helper is actual decodable JPEG bytes
def test_jpeg_helper_is_decodable():
    raw = base64.b64decode(JPEG_1PX_B64)
    assert raw[:2] == b"\xff\xd8", "not a JPEG SOI"
    assert raw[-2:] == b"\xff\xd9", "not a JPEG EOI"
