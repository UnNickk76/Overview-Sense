from fastapi import FastAPI, APIRouter, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone
import requests

from database import db, client, EMERGENT_LLM_KEY
from auth import auth_router, ensure_auth_indexes, ensure_developer_account
from social import social_router, ensure_social_indexes
from ai_features import ai_router
from events import events_router
from universe_live import universe_router
from snapsense import snapsense_router, ensure_snapsense_indexes

ROOT_DIR = Path(__file__).parent

app = FastAPI(title="Overview API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("overview")

UA = {"User-Agent": "OverviewApp/1.0 (scientific instrument)"}


def _get_json(url: str, timeout: float = 8.0):
    r = requests.get(url, headers=UA, timeout=timeout)
    r.raise_for_status()
    return r.json()


async def fetch_json(url: str, timeout: float = 8.0):
    try:
        return await asyncio.to_thread(_get_json, url, timeout)
    except Exception as e:
        logger.warning(f"fetch failed {url}: {e}")
        return None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"app": "Overview", "status": "online"}


# ---------------------------------------------------------------------------
# ISS live position  (wheretheiss.at - free, no key)
# ---------------------------------------------------------------------------
@api_router.get("/iss")
async def iss_position():
    data = None
    for _ in range(3):
        data = await fetch_json("https://api.wheretheiss.at/v1/satellites/25544", timeout=10)
        if data:
            break
    if not data:
        alt = await fetch_json("http://api.open-notify.org/iss-now.json", timeout=10)
        if alt and alt.get("iss_position"):
            p = alt["iss_position"]
            return {"available": True, "source": "open-notify.org",
                    "latitude": float(p["latitude"]), "longitude": float(p["longitude"]),
                    "altitude_km": 420, "velocity_kmh": 27600, "visibility": None}
        return {"available": False, "source": "wheretheiss.at"}
    return {
        "available": True,
        "source": "wheretheiss.at",
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "altitude_km": data.get("altitude"),
        "velocity_kmh": data.get("velocity"),
        "visibility": data.get("visibility"),
        "timestamp": data.get("timestamp"),
    }


# ---------------------------------------------------------------------------
# Weather + air quality  (Open-Meteo - free, no key)
# ---------------------------------------------------------------------------
@api_router.get("/weather")
async def weather(lat: float = Query(...), lon: float = Query(...)):
    w_url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,surface_pressure,"
        "wind_speed_10m,cloud_cover,weather_code&timezone=auto"
    )
    aq_url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}&current=us_aqi,pm2_5,pm10"
    )
    wj, aqj = await asyncio.gather(fetch_json(w_url), fetch_json(aq_url))

    out = {"available": False, "source": "open-meteo.com"}
    if wj and wj.get("current"):
        c = wj["current"]
        out.update({
            "available": True,
            "temperature_c": c.get("temperature_2m"),
            "humidity_pct": c.get("relative_humidity_2m"),
            "pressure_hpa": c.get("surface_pressure"),
            "wind_kmh": c.get("wind_speed_10m"),
            "cloud_cover_pct": c.get("cloud_cover"),
            "weather_code": c.get("weather_code"),
        })
    if aqj and aqj.get("current"):
        a = aqj["current"]
        out["air_quality"] = {
            "us_aqi": a.get("us_aqi"),
            "pm2_5": a.get("pm2_5"),
            "pm10": a.get("pm10"),
        }
    return out


# ---------------------------------------------------------------------------
# Space weather  (NOAA SWPC - free, no key)
# ---------------------------------------------------------------------------
@api_router.get("/space-weather")
async def space_weather():
    kp_url = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
    plasma_url = "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json"
    mag_url = "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json"
    flare_url = "https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json"
    ssn_url = "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json"

    kp, plasma, mag, flare, ssn = await asyncio.gather(
        fetch_json(kp_url), fetch_json(plasma_url), fetch_json(mag_url),
        fetch_json(flare_url), fetch_json(ssn_url),
    )

    result = {"source": "NOAA SWPC", "updated": datetime.now(timezone.utc).isoformat()}

    kp_val = None
    if kp and isinstance(kp, list) and len(kp) > 0:
        try:
            last = kp[-1]
            if isinstance(last, dict):
                kp_val = float(last.get("Kp") or last.get("kp_index"))
            else:  # array-of-arrays fallback
                kp_val = float(last[1])
        except Exception:
            kp_val = None
    result["kp_index"] = {
        "available": kp_val is not None,
        "value": round(kp_val, 2) if kp_val is not None else None,
        "level": _kp_level(kp_val),
        "aurora_chance": _aurora_chance(kp_val),
    }

    sw = {"available": False}
    if plasma and isinstance(plasma, list) and plasma:
        try:
            sw = {"available": True, "speed_kms": float(plasma[0]["proton_speed"]),
                  "density_pcm3": float(plasma[0].get("proton_density") or 0)}
        except Exception:
            sw = {"available": False}
    result["solar_wind"] = sw

    mf = {"available": False}
    if mag and isinstance(mag, list) and mag:
        try:
            mf = {"available": True, "bz_nt": float(mag[0]["bz_gsm"]), "bt_nt": float(mag[0]["bt"])}
        except Exception:
            mf = {"available": False}
    result["imf"] = mf

    fl = {"available": False}
    if isinstance(flare, dict) and flare.get("max_class"):
        fl = {"available": True, "class": flare.get("max_class"),
              "time": flare.get("max_time"), "begin": flare.get("begin_time")}
    elif isinstance(flare, list) and flare:
        f0 = flare[0]
        fl = {"available": True, "class": f0.get("max_class"), "time": f0.get("max_time")}
    result["solar_flare"] = fl

    sn = {"available": False}
    if ssn and isinstance(ssn, list):
        try:
            last = ssn[-1]
            sn = {"available": True, "sunspot_number": last.get("ssn"),
                  "month": last.get("time-tag")}
        except Exception:
            sn = {"available": False}
    result["sunspots"] = sn

    return result


def _kp_level(kp):
    if kp is None:
        return None
    if kp < 4:
        return "Quiet"
    if kp < 5:
        return "Unsettled"
    if kp < 6:
        return "Minor storm (G1)"
    if kp < 7:
        return "Moderate storm (G2)"
    if kp < 8:
        return "Strong storm (G3)"
    if kp < 9:
        return "Severe storm (G4)"
    return "Extreme storm (G5)"


def _aurora_chance(kp):
    if kp is None:
        return None
    if kp < 3:
        return "Low - only high latitudes"
    if kp < 5:
        return "Moderate at high latitudes"
    if kp < 7:
        return "High - visible at mid latitudes"
    return "Very high - possible at low latitudes"


# ---------------------------------------------------------------------------
# AI Assistant  (GPT-5.5 via Emergent universal key, streaming SSE)
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: str
    message: str
    context: Optional[str] = None


SYSTEM_MESSAGE = (
    "You are the Overview assistant, a calm, precise scientific instrument that helps a "
    "person perceive the invisible physical reality around them. You explain real, "
    "scientifically-accurate phenomena: astronomy, orbital mechanics, geomagnetism, "
    "solar activity, sensors, light travel time. RULES: Never invent data. If a value is "
    "unknown, say so. If a figure is an estimate or a calculated approximation, say so. "
    "No pseudoscience, no paranormal, no fiction. Be concise, evocative but rigorous, like "
    "a brilliant science communicator. Answer in the user's language. Keep answers under "
    "~150 words unless asked for more."
)


@api_router.post("/ai/chat")
async def ai_chat(req: ChatRequest):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

    text = req.message
    if req.context:
        text = f"[Current observation context: {req.context}]\n\n{req.message}"

    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": req.session_id, "role": "user",
        "text": req.message, "ts": datetime.now(timezone.utc).isoformat(),
    })

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.session_id,
        system_message=SYSTEM_MESSAGE,
    ).with_model("openai", "gpt-5.5")

    async def event_generator():
        full = ""
        try:
            async for event in chat.stream_message(UserMessage(text=text)):
                if isinstance(event, TextDelta):
                    full += event.content
                    yield f"data: {json.dumps({'delta': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    break
        except Exception as e:
            logger.error(f"AI stream error: {e}")
            yield f"data: {json.dumps({'error': 'assistant unavailable'})}\n\n"
        else:
            await db.chat_messages.insert_one({
                "id": str(uuid.uuid4()), "session_id": req.session_id,
                "role": "assistant", "text": full,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api_router.get("/ai/history/{session_id}")
async def ai_history(session_id: str):
    msgs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("ts", 1).to_list(200)
    return {"messages": msgs}


# ---------------------------------------------------------------------------
# Satellites — real TLEs (SGP4 done client-side with satellite.js)
# ---------------------------------------------------------------------------
_TLE_CACHE: dict = {"ts": 0, "data": None}
TLE_TTL = 6 * 3600  # 6 hours

BRIGHT_IDS = [25544, 48274, 20580, 25338, 33591, 39084, 25994, 27424, 43013]  # ISS, Tiangong, Hubble, NOAA/EOS


def _fetch_tle_id(sid: int):
    url = f"https://tle.ivanstanojevic.me/api/tle/{sid}"
    r = requests.get(url, headers=UA, timeout=8, allow_redirects=True)
    r.raise_for_status()
    return r.json()


def _fetch_tle_search(q: str, size: int):
    url = f"https://tle.ivanstanojevic.me/api/tle/?search={q}&page-size={size}"
    r = requests.get(url, headers=UA, timeout=10, allow_redirects=True)
    r.raise_for_status()
    return r.json().get("member", [])


def _build_tle_list():
    out = []
    seen = set()

    def add(item):
        try:
            sid = item["satelliteId"]
            if sid in seen:
                return
            seen.add(sid)
            out.append({"name": item["name"], "satelliteId": sid,
                        "line1": item["line1"], "line2": item["line2"]})
        except Exception:
            pass

    for sid in BRIGHT_IDS:
        try:
            add(_fetch_tle_id(sid))
        except Exception as e:
            logger.warning(f"tle {sid} failed: {e}")
    try:
        for m in _fetch_tle_search("starlink", 25):
            add(m)
    except Exception as e:
        logger.warning(f"tle starlink search failed: {e}")
    return out


@api_router.get("/satellites")
async def satellites():
    import time
    now_ts = time.time()
    if _TLE_CACHE["data"] and now_ts - _TLE_CACHE["ts"] < TLE_TTL:
        return {"available": True, "source": "tle.ivanstanojevic.me",
                "cached": True, "satellites": _TLE_CACHE["data"]}
    data = await asyncio.to_thread(_build_tle_list)
    if data:
        _TLE_CACHE["data"] = data
        _TLE_CACHE["ts"] = now_ts
        return {"available": True, "source": "tle.ivanstanojevic.me",
                "cached": False, "satellites": data}
    if _TLE_CACHE["data"]:
        return {"available": True, "source": "tle.ivanstanojevic.me",
                "cached": True, "satellites": _TLE_CACHE["data"]}
    return {"available": False, "satellites": []}


app.include_router(api_router)
app.include_router(auth_router)
app.include_router(social_router)
app.include_router(ai_router)
app.include_router(events_router)
app.include_router(universe_router)
app.include_router(snapsense_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup_indexes():
    try:
        await ensure_auth_indexes()
        await ensure_social_indexes()
        await ensure_snapsense_indexes()
        await ensure_developer_account()
    except Exception as e:
        logger.warning(f"index creation failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
