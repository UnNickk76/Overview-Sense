"""Quick functional smoke of Sense Vision 2.0 Phase A endpoints (no pytest)."""
import asyncio, base64, os, requests
from database import db

BASE = "http://localhost:8001/api"
# 1x1 red JPEG
TINY = base64.b64encode(bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
    "07090908" + "0a" * 100)).decode()  # not a valid full jpeg; use a known tiny valid one below

# A minimal valid 1x1 JPEG
TINY = ("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof"
        "Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB"
        "AAAAAAAAAAAAAAAAAAAAC//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==")


async def main():
    ex = await db.users.find_one({"nickname": "explorer"}, {"_id": 0, "id": 1})
    obs = await db.observations.find_one({"user_id": ex["id"], "has_image": True}, {"_id": 0, "id": 1})
    print("explorer:", ex["id"], "obs:", obs and obs["id"])

    email = "explorer" + "@overview.app"
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "overview123"}, timeout=30)
    print("login:", r.status_code)
    tok = r.json()["access_token"]
    H = {"Authorization": f"Bearer {tok}"}

    # analyze (no lat/lon → skip Overpass)
    r = requests.post(f"{BASE}/sv/analyze", headers=H, timeout=90,
                      json={"image_base64": TINY, "context": {"heading": 90, "cameraAlt": 0, "fovH": 62, "aspect": 1.25}, "mode": "capture"})
    print("analyze:", r.status_code)
    data = r.json()
    print("  scene:", data.get("scene"))
    print("  #subjects:", len(data.get("subjects", [])), "#elements:", len(data.get("elements", [])), "needs_zoom:", data.get("needs_zoom"))
    print("  version:", data.get("version"), "geo_available:", data.get("geo_available"))

    if obs:
        rec = {"version": 1, "scene": data.get("scene"), "subjects": data.get("subjects", []),
               "elements": data.get("elements", [])}
        r = requests.post(f"{BASE}/sv/observations/{obs['id']}/recognition", headers=H, timeout=30,
                          json={"recognition": rec, "overlay_default": "off"})
        print("save recognition:", r.status_code, r.json())
        r = requests.get(f"{BASE}/sv/observations/{obs['id']}/recognition", headers=H, timeout=30)
        print("get recognition:", r.status_code, "version:", r.json().get("recognition_version"),
              "overlay_default:", (r.json().get("recognition") or {}).get("overlay_default"))
        r = requests.get(f"{BASE}/observations/{obs['id']}", headers=H, timeout=30)
        print("obs passthrough recognition_version:", r.json().get("recognition_version"),
              "has recognition:", r.json().get("recognition") is not None)

    # non-owner cannot save
    ap = requests.post(f"{BASE}/auth/login", json={"email": "apple" + "@overview.app", "password": "Overview.Apple2026"}, timeout=30)
    if ap.status_code == 200 and obs:
        H2 = {"Authorization": f"Bearer {ap.json()['access_token']}"}
        r = requests.post(f"{BASE}/sv/observations/{obs['id']}/recognition", headers=H2, timeout=30,
                          json={"recognition": {}, "overlay_default": "on"})
        print("non-owner save (expect 403):", r.status_code)


if __name__ == "__main__":
    asyncio.run(main())
