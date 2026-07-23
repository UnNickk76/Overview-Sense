"""Backend regression for the 'Pubblicazione non riuscita' bug on Observe publish.

Focus:
- POST /api/auth/login with the seeded user must yield an access_token
- POST /api/observations with the exact frontend payload (image_base64 + data.places)
  MUST return 200 with an 'id' — this is the exact call that used to fail.
- Persistence: the created Observe must be retrievable via GET /api/observations/{id}
  AND appear in GET /api/feed, and data.places must be preserved.
- Auth enforcement: POST without Authorization returns 401 (NOT 500).
- Validation: POST with an invalid body returns 4xx (400/422), NOT 500.
- Repeated publish (x3) is consistent — no intermittent 500s.
"""
import base64
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://invisible-sense.preview.emergentagent.com",
).rstrip("/")

SEED_EMAIL = "explorer@overview.app"
SEED_PASSWORD = "overview123"

# Tiny valid JPEG (1x1 pixel white). base64.b64decode(...) succeeds and the
# server-side moderator "fails open" on the emergent LLM call, so this is
# accepted by the observation create endpoint.
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


def _publish_payload(desc_suffix: str = "") -> dict:
    return {
        "media_type": "image",
        "source": "reality",
        "description": f"TEST publish observation {desc_suffix}".strip(),
        "hashtags": ["test", "senseshot"],
        "image_base64": JPEG_1PX_B64,
        "data": {
            "lat": 41.9,
            "lon": 12.5,
            "planets": [],
            "stars": [],
            "places": [{
                "name": "Roma",
                "category": "city",
                "categoryLabel": "Citta",
                "lat": 41.9,
                "lon": 12.5,
                "distanceKm": 1.5,
                "az": 226,
                "alt": 0.1,
                "ele": 21,
                "score": 27,
            }],
        },
    }


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def seed_token(api_client):
    r = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"seed login failed: {r.status_code} {r.text}"
    j = r.json()
    tok = j.get("access_token")
    assert tok and j.get("token_type") == "bearer", j
    assert j.get("user", {}).get("email") == SEED_EMAIL
    return tok


# --------------------------------------------------------------------------
# AUTH
# --------------------------------------------------------------------------
class TestSeedLogin:
    def test_login_returns_bearer_token(self, seed_token):
        assert isinstance(seed_token, str) and len(seed_token) > 20


# --------------------------------------------------------------------------
# PUBLISH (core bug: POST /api/observations with places must return 200)
# --------------------------------------------------------------------------
class TestPublishObservation:
    def test_publish_with_places_returns_200_and_id(self, api_client, seed_token):
        r = api_client.post(
            f"{BASE_URL}/api/observations",
            json=_publish_payload("A"),
            headers={"Authorization": f"Bearer {seed_token}"},
            timeout=45,
        )
        assert r.status_code == 200, f"publish failed: {r.status_code} {r.text}"
        obs = r.json()
        assert obs.get("id"), obs
        assert obs.get("media_type") == "image"
        assert obs.get("source") == "reality"
        # description is stored as caption on the server
        assert "TEST publish observation A" in (obs.get("caption") or "")
        # image was accepted (has_image → media url present)
        assert obs.get("image_url") == f"/api/media/{obs['id']}"
        # Location + hashtags round-trip
        assert obs.get("lat") == 41.9
        assert obs.get("lon") == 12.5
        assert "test" in (obs.get("hashtags") or [])
        # places is inside data — server returns fuzzed data on public payload;
        # but the places array is passed through unchanged.
        places = ((obs.get("data") or {}).get("places") or [])
        assert len(places) == 1
        assert places[0]["name"] == "Roma"
        assert places[0]["category"] == "city"
        # remember for the persistence test below
        pytest.publish_obs_id = obs["id"]

    def test_publish_persisted_via_get(self, api_client, seed_token):
        oid = getattr(pytest, "publish_obs_id", None)
        assert oid, "previous publish must have set the id"
        r = api_client.get(
            f"{BASE_URL}/api/observations/{oid}",
            headers={"Authorization": f"Bearer {seed_token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        obs = r.json()
        assert obs["id"] == oid
        # data.places preserved on read-back
        places = ((obs.get("data") or {}).get("places") or [])
        assert places and places[0]["name"] == "Roma"
        assert obs.get("author", {}).get("nickname")  # author denorm present

    def test_publish_persisted_in_feed(self, api_client, seed_token):
        oid = getattr(pytest, "publish_obs_id", None)
        assert oid
        r = api_client.get(
            f"{BASE_URL}/api/feed?sort=recent&limit=100",
            headers={"Authorization": f"Bearer {seed_token}"},
            timeout=20,
        )
        assert r.status_code == 200
        ids = [it["id"] for it in r.json().get("items", [])]
        assert oid in ids, f"published obs {oid} not present in recent feed (top {len(ids)})"

    def test_publish_repeated_three_times_no_500(self, api_client, seed_token):
        """3 consecutive publishes must all succeed — no intermittent 500s."""
        statuses, ids = [], []
        for i in range(3):
            r = api_client.post(
                f"{BASE_URL}/api/observations",
                json=_publish_payload(f"repeat-{i}-{uuid.uuid4().hex[:6]}"),
                headers={"Authorization": f"Bearer {seed_token}"},
                timeout=45,
            )
            statuses.append(r.status_code)
            if r.status_code == 200:
                ids.append(r.json().get("id"))
        assert statuses == [200, 200, 200], f"unstable publish: {statuses}"
        assert all(ids) and len(set(ids)) == 3, f"duplicate/empty ids: {ids}"


# --------------------------------------------------------------------------
# AUTH ENFORCEMENT
# --------------------------------------------------------------------------
class TestPublishAuthEnforcement:
    def test_publish_without_authorization_is_401(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/observations",
            json=_publish_payload("no-auth"),
            timeout=20,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text}"
        assert r.status_code != 500

    def test_publish_with_bogus_token_is_401(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/observations",
            json=_publish_payload("bad-tok"),
            headers={"Authorization": "Bearer not.a.real.token"},
            timeout=20,
        )
        assert r.status_code == 401, r.text


# --------------------------------------------------------------------------
# VALIDATION / ERROR HANDLING
# --------------------------------------------------------------------------
class TestPublishValidation:
    def test_publish_with_invalid_body_returns_4xx(self, api_client, seed_token):
        # 'hashtags' expected List[str], we send an int — pydantic must reject with 422
        bad = {"media_type": "image", "source": "reality", "hashtags": 12345}
        r = api_client.post(
            f"{BASE_URL}/api/observations",
            json=bad,
            headers={"Authorization": f"Bearer {seed_token}"},
            timeout=20,
        )
        assert 400 <= r.status_code < 500, f"expected 4xx, got {r.status_code}: {r.text}"
        assert r.status_code != 500

    def test_publish_with_invalid_image_base64_returns_400(self, api_client, seed_token):
        payload = _publish_payload("bad-img")
        payload["image_base64"] = "!!! definitely not base64 !!!"
        r = api_client.post(
            f"{BASE_URL}/api/observations",
            json=payload,
            headers={"Authorization": f"Bearer {seed_token}"},
            timeout=25,
        )
        assert r.status_code in (400, 422), r.text

    def test_publish_with_empty_json_body_is_accepted_or_4xx(self, api_client, seed_token):
        """All fields on CreateObs are optional (media_type/source have defaults),
        so an empty body is technically valid; must NOT 500."""
        r = api_client.post(
            f"{BASE_URL}/api/observations",
            json={},
            headers={"Authorization": f"Bearer {seed_token}"},
            timeout=20,
        )
        assert r.status_code != 500, r.text
        assert r.status_code in (200, 400, 422)


# --------------------------------------------------------------------------
# Sanity check: base64 helper is truly decodable JPEG bytes
# --------------------------------------------------------------------------
def test_jpeg_base64_is_decodable():
    raw = base64.b64decode(JPEG_1PX_B64)
    assert raw.startswith(b"\xff\xd8"), "not a JPEG start-of-image marker"
    assert raw.endswith(b"\xff\xd9"), "not a JPEG end-of-image marker"
