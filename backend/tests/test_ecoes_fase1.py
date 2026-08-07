"""
Ecoes™ Fase 1 backend tests:
- POST /api/observations with media_type=text, kind=thought (Pensiero)
- GET /api/feed returns thoughts alongside image Senses
- POST /api/ai/translate: returns {source_lang, target, translation}, cached on repeat, same-lang unchanged
- GET /api/media/{id}?size=... variants still return image bytes
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://invisible-sense.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

APPLE_EMAIL = "apple@overview.app"
APPLE_PASS = "Overview.Apple2026"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": APPLE_EMAIL, "password": APPLE_PASS}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    tk = body.get("access_token") or body.get("token")
    assert tk, f"No access_token in login response: {body}"
    return tk


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Pensiero (thought) creation ----------------
class TestThoughtCreation:
    def test_create_thought_success(self, headers):
        caption = f"TEST_PENSIERO {uuid.uuid4().hex[:8]}: la mente è una realtà invisibile."
        payload = {"media_type": "text", "kind": "thought", "caption": caption, "source": "reality", "data": {}}
        r = requests.post(f"{API}/observations", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text[:300]}"
        obs = r.json()
        assert obs.get("kind") == "thought", f"kind not thought: {obs.get('kind')}"
        assert obs.get("caption") == caption
        assert obs.get("media_type") == "text"
        assert not obs.get("image_url"), f"thought must have no image_url; got {obs.get('image_url')}"
        assert not obs.get("has_image"), "thought must have has_image=false"
        # store id for later
        TestThoughtCreation.created_id = obs["id"]

    def test_thought_up_to_3000_chars_accepted(self, headers):
        cap = ("A" * 3000)
        payload = {"media_type": "text", "kind": "thought", "caption": cap, "source": "reality", "data": {}}
        r = requests.post(f"{API}/observations", json=payload, headers=headers, timeout=30)
        assert r.status_code == 200, f"expected 200 for 3000 chars, got {r.status_code} {r.text[:200]}"
        assert len(r.json().get("caption", "")) == 3000

    def test_thought_over_3000_chars_truncated(self, headers):
        cap = "B" * 3500
        payload = {"media_type": "text", "kind": "thought", "caption": cap, "source": "reality", "data": {}}
        r = requests.post(f"{API}/observations", json=payload, headers=headers, timeout=30)
        # server truncates to 3000, not rejects
        assert r.status_code == 200
        assert len(r.json().get("caption", "")) == 3000

    def test_empty_thought_rejected_400(self, headers):
        payload = {"media_type": "text", "kind": "thought", "caption": "   ", "source": "reality", "data": {}}
        r = requests.post(f"{API}/observations", json=payload, headers=headers, timeout=20)
        assert r.status_code == 400, f"expected 400 for empty thought, got {r.status_code} {r.text[:200]}"


# ---------------- Feed includes thoughts ----------------
class TestFeedIncludesThoughts:
    def test_feed_contains_new_thought(self, headers):
        marker = f"TEST_FEED_PENSIERO_{uuid.uuid4().hex[:10]}"
        cap = f"{marker}: pensiero che deve apparire nel feed."
        pr = requests.post(f"{API}/observations",
                           json={"media_type": "text", "kind": "thought", "caption": cap, "source": "reality", "data": {}},
                           headers=headers, timeout=30)
        assert pr.status_code == 200
        new_id = pr.json()["id"]

        r = requests.get(f"{API}/feed", headers=headers, timeout=20)
        assert r.status_code == 200, f"feed status {r.status_code} {r.text[:200]}"
        body = r.json()
        items = body if isinstance(body, list) else body.get("items", [])
        assert isinstance(items, list) and len(items) > 0, "feed returned no items"
        # our thought is in there
        found = next((it for it in items if it.get("id") == new_id), None)
        assert found is not None, f"new thought id {new_id} not present in feed (first {len(items)} items)"
        assert found.get("kind") == "thought"
        assert marker in (found.get("caption") or "")
        # coexistence: at least one image sense in the feed too
        has_image_sense = any((it.get("kind") != "thought") and (it.get("media_type") == "image" or it.get("image_url")) for it in items)
        assert has_image_sense, "feed contains no image Senses — thoughts must COEXIST with Senses"


# ---------------- Translate ----------------
class TestTranslate:
    def test_translate_it_to_en_and_cache(self):
        text = f"Ciao mondo, questa è una prova {uuid.uuid4().hex[:6]}."
        r1 = requests.post(f"{API}/ai/translate", json={"text": text, "target": "en"}, timeout=45)
        assert r1.status_code == 200, f"translate status {r1.status_code} {r1.text[:200]}"
        d1 = r1.json()
        assert "source_lang" in d1 and "target" in d1 and "translation" in d1
        assert d1["target"] == "en"
        assert isinstance(d1["translation"], str) and len(d1["translation"]) > 0
        assert d1.get("cached") in (False, None), f"first call must not be cached, got {d1.get('cached')}"
        # Sanity: source detected as italian OR translation differs from source
        assert d1["source_lang"].startswith("it") or d1["translation"].strip().lower() != text.strip().lower(), \
            f"Italian source not detected AND translation identical: {d1}"

        # Second identical call → cached True
        r2 = requests.post(f"{API}/ai/translate", json={"text": text, "target": "en"}, timeout=20)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("cached") is True, f"second call must be cached=True, got {d2}"
        assert d2["translation"] == d1["translation"]

    def test_translate_same_language_returns_unchanged(self):
        text = f"Questa è una frase in italiano. {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/ai/translate", json={"text": text, "target": "it"}, timeout=45)
        assert r.status_code == 200
        d = r.json()
        # server contract: source==target OR translation.strip()==text
        assert d["target"] == "it"
        assert d["source_lang"] == "it" or d["translation"].strip() == text.strip(), \
            f"same-lang translate should return unchanged text, got {d}"

    def test_translate_empty_text(self):
        r = requests.post(f"{API}/ai/translate", json={"text": "", "target": "en"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("translation") == "" or d.get("translation") is None or d.get("translation") == ""


# ---------------- Media multi-size variants ----------------
# We create a fresh image observation to guarantee an R2-backed media row,
# because some legacy seeds may have observations without a media doc.
# A small (24x24) valid JPEG is uploaded via image_base64.
_TINY_JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwc"
    "KDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjIyMjIyMjIyMjIyMjIyMjL/wAARCAAYABgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAA"
    "AAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+A/9k="
)


@pytest.fixture(scope="module")
def fresh_image_obs_id(headers):
    payload = {
        "media_type": "image",
        "kind": "sense",
        "caption": f"TEST_IMG_{uuid.uuid4().hex[:8]}",
        "source": "reality",
        "data": {},
        "image_base64": _TINY_JPEG_B64,
    }
    r = requests.post(f"{API}/observations", json=payload, headers=headers, timeout=60)
    assert r.status_code == 200, f"failed to create test image obs: {r.status_code} {r.text[:300]}"
    obs = r.json()
    assert obs.get("image_url"), f"image obs missing image_url: {obs}"
    return obs["id"]


class TestMediaVariants:
    @pytest.mark.parametrize("size", ["thumb", "feed", "detail", "master", "original"])
    def test_media_size_variant(self, fresh_image_obs_id, size):
        r = requests.get(f"{API}/media/{fresh_image_obs_id}", params={"size": size}, timeout=30)
        assert r.status_code == 200, f"size={size} → {r.status_code} {r.text[:200]}"
        ctype = r.headers.get("content-type", "")
        assert ctype.startswith("image/"), f"size={size} unexpected content-type: {ctype}"
        assert len(r.content) > 100, f"size={size} body too small ({len(r.content)} bytes)"
