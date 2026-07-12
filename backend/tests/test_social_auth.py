"""Overview social network + auth + AI narration backend tests.

Covers:
- POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- POST /api/observations, GET /api/media/{id}
- GET /api/feed (filters: sort, category, media_type, source, window, nearby, following)
- GET /api/observations/{id} (views), POST /api/observations/{id}/interact (toggle)
- POST/GET /api/observations/{id}/comments
- POST/DELETE /api/users/{id}/follow, GET /api/users/{id}, GET /api/users/{id}/observations, PATCH /api/users/me
- POST /api/ai/explain-opportunity, /api/ai/curiosity, /api/ai/explain-visualization
"""
import os
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://invisible-sense.preview.emergentagent.com",
).rstrip("/")

# 1x1 transparent PNG (valid image, small)
PNG_1PX = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000d49444154789c626001000000ffff03000006000557bfabd4000000"
        "0049454e44ae426082"
    )
).decode()


def _unique(prefix: str = "TEST"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
class TestAuth:
    def test_register_login_me_flow(self, api_client):
        nick = _unique("u")
        email = f"{nick}@overview.test"
        pw = "overview123"

        # register
        r = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "nickname": nick, "password": pw},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("token_type") == "bearer"
        assert data.get("access_token")
        assert data["user"]["email"] == email
        assert data["user"]["nickname"] == nick
        assert data["user"]["id"]

        # login
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": pw},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]

        # me
        r = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["email"] == email

    def test_register_duplicate_email(self, api_client):
        nick = _unique("dup")
        email = f"{nick}@overview.test"
        payload = {"email": email, "nickname": nick, "password": "overview123"}
        r1 = api_client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r1.status_code == 200
        # different nickname, same email -> should 409
        r2 = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "nickname": _unique("dup2"), "password": "overview123"},
            timeout=20,
        )
        assert r2.status_code == 409

    def test_login_invalid_password(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "explorer@overview.app", "password": "WRONG"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_me_requires_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 401


# --------------------------------------------------------------------------
# Fixtures for authenticated flows
# --------------------------------------------------------------------------
@pytest.fixture(scope="module")
def user_a():
    nick = _unique("A")
    email = f"{nick}@overview.test"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "nickname": nick, "password": "overview123"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return {"token": j["access_token"], "user": j["user"], "email": email}


@pytest.fixture(scope="module")
def user_b():
    nick = _unique("B")
    email = f"{nick}@overview.test"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "nickname": nick, "password": "overview123"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return {"token": j["access_token"], "user": j["user"], "email": email}


def _auth(u):
    return {"Authorization": f"Bearer {u['token']}"}


# --------------------------------------------------------------------------
# Observations + Media + Feed
# --------------------------------------------------------------------------
class TestObservations:
    def test_create_observation_with_image(self, user_a):
        payload = {
            "media_type": "image",
            "source": "reality",
            "caption": "TEST observation from A",
            "image_base64": PNG_1PX,
            "data": {
                "lat": 41.9, "lon": 12.5, "altitude": 30, "cameraAz": 180,
                "sun": {"alt": 10}, "moon": {"phase": 0.5},
                "weather": {"temp": 20}, "spaceWeather": {"kp": 3.5},
                "planets": [{"name": "Jupiter"}], "constellations": ["Orion"],
                "iss": {"visible": True},
            },
        }
        r = requests.post(
            f"{BASE_URL}/api/observations", json=payload, headers=_auth(user_a), timeout=25
        )
        assert r.status_code == 200, r.text
        obs = r.json()
        assert obs["id"]
        assert obs["user_id"] == user_a["user"]["id"]
        assert obs["nickname"] == user_a["user"]["nickname"]
        assert obs["scientific_value"] > 0
        assert obs["image_url"] == f"/api/media/{obs['id']}"
        assert obs["category"] in ("ISS", "Pianeti", "Luna", "Costellazioni", "Astronomia", "Aurore", "Via Lattea")
        # Should have derived multiple categories
        assert "ISS" in obs["categories"]
        user_a["obs_id"] = obs["id"]

    def test_media_endpoint_returns_image(self, user_a):
        oid = user_a.get("obs_id")
        assert oid
        r = requests.get(f"{BASE_URL}/api/media/{oid}", timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 0

    def test_media_not_found(self):
        r = requests.get(f"{BASE_URL}/api/media/does-not-exist", timeout=10)
        assert r.status_code == 404

    def test_create_listening_observation(self, user_b):
        r = requests.post(
            f"{BASE_URL}/api/observations",
            json={
                "media_type": "audio",
                "source": "listening",
                "caption": "TEST listening B",
                "data": {"noiseDb": 42.0},
            },
            headers=_auth(user_b),
            timeout=20,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["category"] == "Listening Layer"
        assert j["source"] == "listening"
        assert j["media_type"] == "audio"
        user_b["obs_id"] = j["id"]

    def test_create_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/observations", json={"caption": "nope"}, timeout=10)
        assert r.status_code == 401


class TestFeed:
    def test_feed_smart_default(self):
        r = requests.get(f"{BASE_URL}/api/feed", timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "items" in j
        assert isinstance(j["items"], list)

    def test_feed_sort_recent(self):
        r = requests.get(f"{BASE_URL}/api/feed?sort=recent&limit=20", timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        # verify sorted desc by created_at
        cs = [i["created_at"] for i in items]
        assert cs == sorted(cs, reverse=True)

    def test_feed_filters_category_and_source(self):
        r = requests.get(f"{BASE_URL}/api/feed?category=ISS&source=reality", timeout=20)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert "ISS" in it.get("categories", [])
            assert it["source"] == "reality"

    def test_feed_filter_media_type_audio(self):
        r = requests.get(f"{BASE_URL}/api/feed?media_type=audio", timeout=20)
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["media_type"] == "audio"

    def test_feed_window_today(self):
        r = requests.get(f"{BASE_URL}/api/feed?window=today", timeout=20)
        assert r.status_code == 200

    def test_feed_nearby(self):
        r = requests.get(f"{BASE_URL}/api/feed?lat=41.9&lon=12.5&radius_km=500", timeout=20)
        assert r.status_code == 200

    def test_feed_following_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/feed?following=true", timeout=15)
        assert r.status_code == 200
        assert r.json()["items"] == []


# --------------------------------------------------------------------------
# Observation detail + interactions
# --------------------------------------------------------------------------
class TestInteractions:
    def test_get_observation_increments_views(self, user_a, user_b):
        oid = user_a["obs_id"]
        # first view by user_b
        r = requests.get(
            f"{BASE_URL}/api/observations/{oid}", headers=_auth(user_b), timeout=15
        )
        assert r.status_code == 200
        v1 = r.json()["views"]
        assert v1 >= 1
        assert r.json().get("author", {}).get("nickname") == user_a["user"]["nickname"]

        # second view by same user should NOT increment (unique constraint on interactions)
        r2 = requests.get(
            f"{BASE_URL}/api/observations/{oid}", headers=_auth(user_b), timeout=15
        )
        assert r2.status_code == 200
        assert r2.json()["views"] == v1

    def test_interact_toggle(self, user_a, user_b):
        oid = user_a["obs_id"]
        # observed on
        r = requests.post(
            f"{BASE_URL}/api/observations/{oid}/interact",
            json={"type": "observed"}, headers=_auth(user_b), timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["active"] is True
        assert r.json()["count"] >= 1

        # observed off
        r2 = requests.post(
            f"{BASE_URL}/api/observations/{oid}/interact",
            json={"type": "observed"}, headers=_auth(user_b), timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["active"] is False

        # discovery
        r3 = requests.post(
            f"{BASE_URL}/api/observations/{oid}/interact",
            json={"type": "discovery"}, headers=_auth(user_b), timeout=15,
        )
        assert r3.status_code == 200
        assert r3.json()["active"] is True

    def test_interact_invalid_type(self, user_a, user_b):
        oid = user_a["obs_id"]
        r = requests.post(
            f"{BASE_URL}/api/observations/{oid}/interact",
            json={"type": "like"}, headers=_auth(user_b), timeout=15,
        )
        assert r.status_code == 400

    def test_get_observation_404(self):
        r = requests.get(f"{BASE_URL}/api/observations/does-not-exist", timeout=10)
        assert r.status_code == 404


# --------------------------------------------------------------------------
# Comments
# --------------------------------------------------------------------------
class TestComments:
    def test_add_and_list_comments(self, user_a, user_b):
        oid = user_a["obs_id"]
        r = requests.post(
            f"{BASE_URL}/api/observations/{oid}/comments",
            json={"text": "TEST commento da B"}, headers=_auth(user_b), timeout=15,
        )
        assert r.status_code == 200
        c = r.json()
        assert c["text"] == "TEST commento da B"
        assert c["nickname"] == user_b["user"]["nickname"]

        r2 = requests.get(f"{BASE_URL}/api/observations/{oid}/comments", timeout=15)
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert any(it["text"] == "TEST commento da B" for it in items)

    def test_empty_comment_rejected(self, user_a, user_b):
        oid = user_a["obs_id"]
        r = requests.post(
            f"{BASE_URL}/api/observations/{oid}/comments",
            json={"text": "   "}, headers=_auth(user_b), timeout=15,
        )
        assert r.status_code == 400


# --------------------------------------------------------------------------
# Follows + Profile + PATCH me
# --------------------------------------------------------------------------
class TestFollowAndProfile:
    def test_follow_unfollow(self, user_a, user_b):
        target = user_a["user"]["id"]
        r = requests.post(
            f"{BASE_URL}/api/users/{target}/follow", headers=_auth(user_b), timeout=15
        )
        assert r.status_code == 200
        assert r.json()["following"] is True

        # profile from viewer B should show is_following=True
        r2 = requests.get(
            f"{BASE_URL}/api/users/{target}", headers=_auth(user_b), timeout=15
        )
        assert r2.status_code == 200
        assert r2.json()["is_following"] is True
        assert r2.json()["stats"]["followers"] >= 1

        # feed with following=true (as user_b) should include user_a observations
        r3 = requests.get(
            f"{BASE_URL}/api/feed?following=true", headers=_auth(user_b), timeout=15
        )
        assert r3.status_code == 200
        assert any(it["user_id"] == target for it in r3.json()["items"])

        # unfollow
        r4 = requests.delete(
            f"{BASE_URL}/api/users/{target}/follow", headers=_auth(user_b), timeout=15
        )
        assert r4.status_code == 200
        assert r4.json()["following"] is False

    def test_cannot_follow_self(self, user_a):
        r = requests.post(
            f"{BASE_URL}/api/users/{user_a['user']['id']}/follow",
            headers=_auth(user_a), timeout=15,
        )
        assert r.status_code == 400

    def test_user_observations_endpoint(self, user_a):
        r = requests.get(
            f"{BASE_URL}/api/users/{user_a['user']['id']}/observations", timeout=15
        )
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(it["id"] == user_a["obs_id"] for it in items)

    def test_patch_me_bio(self, user_a):
        new_bio = "TEST bio " + uuid.uuid4().hex[:6]
        r = requests.patch(
            f"{BASE_URL}/api/users/me",
            json={"bio": new_bio}, headers=_auth(user_a), timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["bio"] == new_bio

    def test_patch_me_nickname_conflict(self, user_a, user_b):
        # user_a tries to take user_b's nickname
        r = requests.patch(
            f"{BASE_URL}/api/users/me",
            json={"nickname": user_b["user"]["nickname"]},
            headers=_auth(user_a), timeout=15,
        )
        assert r.status_code == 409

    def test_get_profile_404(self):
        r = requests.get(f"{BASE_URL}/api/users/does-not-exist", timeout=10)
        assert r.status_code == 404


# --------------------------------------------------------------------------
# AI narration endpoints
# --------------------------------------------------------------------------
class TestAINarration:
    def test_explain_opportunity(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/explain-opportunity",
            json={
                "title": "Luna piena questa notte",
                "facts": [
                    "Fase lunare: 0.98 (quasi piena)",
                    "Altezza Luna sull'orizzonte: 45°",
                    "Cielo sereno, nuvolosità 10%",
                ],
                "kind": "moon",
            },
            timeout=60,
        )
        assert r.status_code == 200, r.text
        txt = r.json().get("text", "")
        assert isinstance(txt, str) and len(txt) > 20

    def test_curiosity(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/curiosity",
            json={"facts": [
                "Kp index: 3.5 (Unsettled)",
                "Vento solare: 486 km/s",
                "Posizione: Roma, 41.9N 12.5E",
            ]},
            timeout=60,
        )
        assert r.status_code == 200
        assert len(r.json().get("text", "")) > 20

    def test_explain_visualization(self):
        r = requests.post(
            f"{BASE_URL}/api/ai/explain-visualization",
            json={"fields": [
                {"label": "Campo magnetico", "value": "48.2 uT"},
                {"label": "Bussola", "value": "215° SW"},
                {"label": "Luce ambientale", "value": "220 lux"},
                {"label": "Rumore ambientale", "value": "42 dB"},
            ]},
            timeout=60,
        )
        assert r.status_code == 200
        assert len(r.json().get("text", "")) > 20
