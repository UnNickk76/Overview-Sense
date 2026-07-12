"""Overview backend API tests.
Covers: health, weather, space-weather, iss, ai/chat streaming, ai/history.
"""
import os
import json
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://invisible-sense.preview.emergentagent.com').rstrip('/')


# --- Health ---
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "online"
        assert data.get("app") == "Overview"


# --- Weather (Open-Meteo) ---
class TestWeather:
    def test_weather_rome(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/weather?lat=41.9&lon=12.5", timeout=25)
        assert r.status_code == 200
        data = r.json()
        assert data.get("available") is True, f"weather not available: {data}"
        assert isinstance(data.get("temperature_c"), (int, float))
        assert isinstance(data.get("pressure_hpa"), (int, float))
        assert isinstance(data.get("humidity_pct"), (int, float))
        assert "air_quality" in data


# --- Space Weather (NOAA) ---
class TestSpaceWeather:
    def test_space_weather(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/space-weather", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("source") == "NOAA SWPC"
        assert "kp_index" in data
        assert "solar_wind" in data
        assert "imf" in data
        assert "solar_flare" in data
        assert "sunspots" in data

    def test_space_weather_kp(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/space-weather", timeout=30)
        data = r.json()
        kp = data["kp_index"]
        # kp should exist and normally be available
        assert "available" in kp
        if kp["available"]:
            assert isinstance(kp["value"], (int, float))
            assert kp["level"] is not None
            assert kp["aurora_chance"] is not None


# --- ISS ---
class TestISS:
    def test_iss_position(self, api_client):
        # backend has 3x10s retry + fallback, allow generous timeout + client retry
        r = None
        last_err = None
        for _ in range(3):
            try:
                r = api_client.get(f"{BASE_URL}/api/iss", timeout=60)
                break
            except requests.exceptions.ReadTimeout as e:
                last_err = e
                continue
        assert r is not None, f"ISS endpoint timed out repeatedly: {last_err}"
        assert r.status_code == 200
        data = r.json()
        assert data.get("available") is True, f"iss unavailable: {data}"
        assert -90 <= data["latitude"] <= 90
        assert -180 <= data["longitude"] <= 180
        assert data["altitude_km"] is not None
        assert data["velocity_kmh"] is not None


# --- AI Chat (SSE streaming) ---
class TestAIChat:
    def test_chat_stream_and_history(self):
        session_id = f"TEST_sess_{uuid.uuid4().hex[:10]}"
        payload = {"session_id": session_id, "message": "Ciao, dimmi una frase brevissima sulla Luna."}

        with requests.post(f"{BASE_URL}/api/ai/chat", json=payload, stream=True, timeout=60) as r:
            assert r.status_code == 200
            assert "text/event-stream" in r.headers.get("content-type", "")
            got_delta = False
            got_done = False
            full = ""
            for raw in r.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                if raw.startswith("data: "):
                    body = raw[6:].strip()
                    if body == "[DONE]":
                        got_done = True
                        break
                    try:
                        evt = json.loads(body)
                    except Exception:
                        continue
                    if "delta" in evt:
                        got_delta = True
                        full += evt["delta"]
                    elif "error" in evt:
                        pytest.fail(f"AI stream error: {evt['error']}")
            assert got_delta, "No delta events received from AI stream"
            assert got_done, "Stream did not end with [DONE]"
            assert len(full) > 0

        # Allow persistence flush
        time.sleep(1.0)

        # History check
        h = requests.get(f"{BASE_URL}/api/ai/history/{session_id}", timeout=15)
        assert h.status_code == 200
        msgs = h.json().get("messages", [])
        roles = [m["role"] for m in msgs]
        assert "user" in roles, f"user message not persisted: {msgs}"
        assert "assistant" in roles, f"assistant message not persisted: {msgs}"
