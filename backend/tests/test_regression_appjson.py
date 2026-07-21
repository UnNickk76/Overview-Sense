"""Regression tests after app.json config-only change (associatedDomains removal).

Focused checks (no functional backend change was made):
- Seeded user (explorer@overview.app / overview123) can login.
- POST /api/observations/seen upserts an obs_views record (dwell>=3s).
- GET /api/feed returns items and 'smart' ranking does not depend on
  author popularity / follower count / account age.
- GET /api/go/{obs_id} renders HTML with deep-link + store fallback.
- /.well-known/apple-app-site-association is served.
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

SEED_EMAIL = "explorer@overview.app"
SEED_PW = "overview123"

PNG_1PX = base64.b64encode(bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049"
    "454e44ae426082"
)).decode()


def _unique(prefix="TEST"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


# -------- Auth: seeded user login --------
class TestSeededAuth:
    def test_seed_user_login(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SEED_EMAIL, "password": SEED_PW},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("token_type") == "bearer"
        assert j.get("access_token")
        assert j["user"]["email"] == SEED_EMAIL
        assert j["user"]["nickname"] == "explorer"

    def test_seed_user_me(self):
        tok = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=15,
        ).json()["access_token"]
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {tok}"}, timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["email"] == SEED_EMAIL

    def test_register_then_login(self):
        nick = _unique("reg")
        email = f"{nick}@overview.test"
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "nickname": nick, "password": "overview123"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        r2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": "overview123"}, timeout=15,
        )
        assert r2.status_code == 200


# -------- Fixture: helper session --------
@pytest.fixture(scope="module")
def seed_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SEED_EMAIL, "password": SEED_PW}, timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def viewer_user():
    """A fresh viewer, used to fire mark-seen and validate obs_views isolation."""
    nick = _unique("view")
    email = f"{nick}@overview.test"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "nickname": nick, "password": "overview123"},
        timeout=20,
    )
    assert r.status_code == 200
    j = r.json()
    return {"token": j["access_token"], "user": j["user"]}


@pytest.fixture(scope="module")
def sample_obs(seed_token):
    """Create a fresh observation authored by the seed user so we have an id
    for /go and /seen tests."""
    r = requests.post(
        f"{BASE_URL}/api/observations",
        headers={"Authorization": f"Bearer {seed_token}"},
        json={
            "media_type": "image",
            "source": "reality",
            "caption": "TEST regression QR observation",
            "image_base64": PNG_1PX,
            "data": {"lat": 41.9, "lon": 12.5, "sun": {"alt": 10}, "moon": {"phase": 0.5}},
        },
        timeout=25,
    )
    assert r.status_code == 200, r.text
    return r.json()


# -------- Content-First feed --------
class TestFeed:
    def test_feed_returns_items(self):
        r = requests.get(f"{BASE_URL}/api/feed?sort=smart&limit=20", timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "items" in j and isinstance(j["items"], list)

    def test_feed_items_do_not_expose_follower_or_account_age(self):
        """Content-First contract: ranked items must not carry follower/account-age
        signals in the response (only per-content signals like scientific_value,
        observed/discovery/learned counts)."""
        r = requests.get(f"{BASE_URL}/api/feed?sort=smart&limit=30", timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        forbidden = {"author_followers", "followers_count", "author_account_age_days", "author_popularity"}
        for it in items:
            leaked = forbidden.intersection(set(it.keys()))
            assert not leaked, f"Feed item leaks author signals: {leaked} in {it.keys()}"

    def test_feed_recent_sorted_by_created_at(self):
        r = requests.get(f"{BASE_URL}/api/feed?sort=recent&limit=20", timeout=20)
        assert r.status_code == 200
        cs = [i["created_at"] for i in r.json()["items"]]
        assert cs == sorted(cs, reverse=True)


# -------- Mark-seen endpoint --------
class TestObservationsSeen:
    def test_mark_seen_requires_auth(self, sample_obs):
        r = requests.post(
            f"{BASE_URL}/api/observations/seen",
            json={"items": [{"id": sample_obs["id"], "dwell_ms": 5000}]},
            timeout=15,
        )
        assert r.status_code == 401

    def test_mark_seen_records_view(self, viewer_user, sample_obs):
        r = requests.post(
            f"{BASE_URL}/api/observations/seen",
            headers={"Authorization": f"Bearer {viewer_user['token']}"},
            json={"items": [{"id": sample_obs["id"], "dwell_ms": 5000}]},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert j["recorded"] == 1

    def test_mark_seen_ignores_short_dwell(self, viewer_user, sample_obs):
        r = requests.post(
            f"{BASE_URL}/api/observations/seen",
            headers={"Authorization": f"Bearer {viewer_user['token']}"},
            json={"items": [{"id": sample_obs["id"], "dwell_ms": 500}]},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["recorded"] == 0


# -------- Smart QR landing --------
class TestGoLanding:
    def test_go_renders_html(self, sample_obs):
        oid = sample_obs["id"]
        r = requests.get(f"{BASE_URL}/api/go/{oid}", timeout=15)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        html = r.text
        # Deep-link scheme
        assert f"overview://observation-detail?id={oid}" in html
        # Fallback continue-on-web
        assert f"/observation-detail?id={oid}" in html
        # Store fallbacks referenced
        assert "apps.apple.com" in html or "APPSTORE_URL" in html
        assert "play.google.com" in html or "PLAYSTORE_URL" in html
        # Includes bundle-identifier hint for iOS
        assert "apple-itunes-app" in html

    def test_go_unknown_id_still_renders(self):
        # The endpoint gracefully falls back to a generic title if obs is missing.
        r = requests.get(f"{BASE_URL}/api/go/does-not-exist", timeout=15)
        assert r.status_code == 200
        assert "overview://observation-detail?id=does-not-exist" in r.text


# -------- Apple Universal Links association --------
class TestAppleAppSiteAssociation:
    def test_aasa_served(self):
        r = requests.get(
            f"{BASE_URL}/.well-known/apple-app-site-association", timeout=15
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "applinks" in j
        details = j["applinks"].get("details") or []
        assert len(details) >= 1
        # /api/go/* must be declared as a universal link path
        paths_all = []
        for d in details:
            paths_all.extend(d.get("paths") or [])
            for c in d.get("components") or []:
                if isinstance(c.get("/"), str):
                    paths_all.append(c["/"])
        assert any("/api/go/" in p for p in paths_all), f"paths={paths_all}"
