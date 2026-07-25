"""Iteration 7 backend tests — nickname availability, author_code
(uniqueness, immutability, backfill), and the /api/search endpoint.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def explorer_token(s):
    r = s.post(f"{API}/auth/login", json={"email": "explorer@overview.app", "password": "overview123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


# ------------------------- nickname-available -------------------------
class TestNicknameAvailable:
    def test_taken_nickname_returns_false(self, s):
        r = s.get(f"{API}/auth/nickname-available", params={"nickname": "explorer"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("available") is False

    def test_random_unused_returns_true(self, s):
        nick = f"TEST_new_{uuid.uuid4().hex[:8]}"
        r = s.get(f"{API}/auth/nickname-available", params={"nickname": nick})
        assert r.status_code == 200
        body = r.json()
        assert body.get("available") is True

    def test_too_short_returns_false_with_reason(self, s):
        r = s.get(f"{API}/auth/nickname-available", params={"nickname": "ab"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("available") is False
        assert body.get("reason") in ("length", "chars")

    def test_invalid_chars_returns_false_with_reason(self, s):
        r = s.get(f"{API}/auth/nickname-available", params={"nickname": "bad nick!"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("available") is False
        assert body.get("reason") == "chars"


# ---------------------- author_code generation -----------------------
class TestAuthorCodeOnRegister:
    _codes = {}

    def test_register_returns_3char_author_code(self, s):
        stamp = uuid.uuid4().hex[:8]
        payload = {
            "email": f"test_{stamp}@overview.app",
            "nickname": f"TEST{stamp[:6]}",  # starts with TES
            "password": "abcdef123",
        }
        r = s.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        code = user.get("author_code")
        assert isinstance(code, str) and len(code) == 3, f"author_code invalid: {code!r}"
        TestAuthorCodeOnRegister._codes["first"] = code
        TestAuthorCodeOnRegister._codes["first_email"] = payload["email"]

    def test_uniqueness_similar_nickname_yields_different_code(self, s):
        # Second user whose nickname starts with the SAME 3 letters ("TES...")
        stamp = uuid.uuid4().hex[:8]
        payload = {
            "email": f"test_{stamp}@overview.app",
            "nickname": f"TESter{stamp[:5]}",
            "password": "abcdef123",
        }
        r = s.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        code2 = r.json()["user"].get("author_code")
        assert isinstance(code2, str) and len(code2) == 3
        first = TestAuthorCodeOnRegister._codes.get("first")
        assert code2 != first, f"author_code collision — expected different: {first} vs {code2}"


# ------------------------ backfill on seeded --------------------------
class TestBackfillAuthorCode:
    def test_explorer_has_author_code(self, s, explorer_token):
        r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {explorer_token}"})
        assert r.status_code == 200, r.text
        me = r.json()
        code = me.get("author_code")
        assert isinstance(code, str) and len(code) == 3, f"missing/invalid author_code: {code!r}"
        # Prefix should derive from 'explorer' → 'EXP'
        assert code.upper().startswith("EXP") or code == "EXP", f"unexpected explorer code: {code}"


# ----------------------- PATCH /users/me nickname ----------------------
class TestUpdateMeNickname:
    _sess = None
    _token = None
    _original = None
    _author_code = None

    @classmethod
    def setup_class(cls):
        # Register a fresh user for this class so we can rename freely
        s = requests.Session()
        stamp = uuid.uuid4().hex[:8]
        cls._original = f"TEST_upd_{stamp[:6]}"
        payload = {
            "email": f"test_upd_{stamp}@overview.app",
            "nickname": cls._original,
            "password": "abcdef123",
        }
        r = s.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        cls._token = j["access_token"]
        cls._author_code = j["user"]["author_code"]
        cls._sess = s

    def _hdr(self):
        return {"Authorization": f"Bearer {self._token}"}

    def test_rename_valid_available_keeps_author_code(self):
        new_nick = f"TEST_ren_{uuid.uuid4().hex[:6]}"
        r = self._sess.patch(f"{API}/users/me", json={"nickname": new_nick}, headers=self._hdr())
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["nickname"] == new_nick
        assert body["author_code"] == self._author_code, (
            f"author_code MUST be immutable across nickname change: was {self._author_code}, got {body['author_code']}"
        )

    def test_rename_to_taken_returns_409(self):
        r = self._sess.patch(f"{API}/users/me", json={"nickname": "explorer"}, headers=self._hdr())
        assert r.status_code == 409, r.text

    def test_rename_invalid_chars_returns_400(self):
        r = self._sess.patch(f"{API}/users/me", json={"nickname": "bad nick!"}, headers=self._hdr())
        assert r.status_code == 400, r.text

    def test_rename_too_short_returns_400(self):
        r = self._sess.patch(f"{API}/users/me", json={"nickname": "ab"}, headers=self._hdr())
        assert r.status_code == 400, r.text


# -------------------------- /api/search --------------------------------
class TestSearch:
    def test_search_keyword_luna(self, s):
        r = s.get(f"{API}/search", params={"q": "Luna"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)
        assert "offset" in body and "has_more" in body

    def test_search_empty_returns_default_list(self, s):
        r = s.get(f"{API}/search", params={"q": ""})
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("items"), list)
        assert "offset" in body and "has_more" in body

    def test_search_nlp_hint_does_not_error(self, s):
        r = s.get(f"{API}/search", params={"q": "osservazioni vicino Roma questa settimana"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("items"), list)
        assert "offset" in body and "has_more" in body
