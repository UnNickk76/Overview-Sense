"""Sense Vision 2.0 — whole-scene understanding (Beyond View / No Invention).

Evolves recognition from a single subject to a hierarchical Scene Graph:
  scene → subjects → elements, each with an INDEPENDENT confidence and a
  reliability tier (confirmed | probable | generic | undetermined).

Three knowledge sources, kept internally separate:
  A) Astronomy (deterministic) — handled client-side, NOT here.
  B) Geography/context (deterministic) — real OSM features in view (geo_places),
     used to ELEVATE generic AI labels to a specific identity (Colosseo, Tevere…).
  C) AI Vision (GPT) — holistic multi-element understanding with regions.

Fusion turns image guesses + real context into reliable identities. When sources
don't agree, we stay generic (never invent). The ORIGINAL image is never modified;
recognition is a separate, optional, versioned layer persisted on the observation.

Element schema also carries `az`/`alt` (absolute bearing/elevation when
determinable) + `salience`/`notable` — the base for the LIVE Session Spatial
Memory (off-screen directional reminders for noteworthy elements). That memory is
a client-only, session-scoped aid and is NEVER persisted into a photo.
"""
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db, EMERGENT_LLM_KEY
from auth import get_current_user, get_active_user

logger = logging.getLogger("overview.sensevision")
sv_router = APIRouter(prefix="/api/sv")

RECOGNITION_SCHEMA_VERSION = 1

# Kinds the scene AI may use. Sky/celestial is intentionally excluded (handled by
# the deterministic astronomy engine).
KINDS = {
    "water", "vegetation", "tree", "plant", "rock", "mountain", "building",
    "monument", "city", "place", "bridge", "road", "path", "person", "vehicle",
    "animal", "nature", "object",
}

# Kinds worth a Session Spatial Memory reminder (noteworthy). Generic
# tree/car/road/person/sidewalk/object are deliberately NOT notable.
NOTABLE_KINDS = {"monument", "mountain", "water", "city", "place", "bridge", "animal", "plant"}

# Place-like kinds that geography (OSM) can confirm to a specific identity.
GEO_KINDS = {"monument", "mountain", "water", "city", "place", "bridge", "building"}

# Map OSM geo categories → our element kind (for fusion matching).
GEO_CAT_TO_KIND = {
    "city": "city", "town": "city", "village": "place", "peak": "mountain",
    "mountain": "mountain", "volcano": "mountain", "water": "water", "river": "water",
    "lake": "water", "sea": "water", "monument": "monument", "castle": "monument",
    "tower": "monument", "lighthouse": "monument", "attraction": "place",
    "bridge": "bridge", "church": "monument", "ruins": "monument",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


SCENE_SYSTEM = (
    "Sei il motore di comprensione della scena di Sense Vision (app OverView). Ricevi UNA foto reale. "
    "Comprendi l'INTERA scena, non un solo soggetto. Restituisci: una descrizione della SCENA/contesto e "
    "un elenco di ELEMENTI realmente presenti e riconoscibili, ciascuno con la sua regione e la sua "
    "affidabilità INDIPENDENTE.\n"
    "FILOSOFIA 'Oltre la Vista' (assoluta): non inventare MAI. Se non sei ragionevolmente sicuro di un "
    "elemento, ometti l'elemento o usa un'etichetta più generica con confidenza bassa. Meglio 'Albero' "
    "corretto che una specie inventata.\n"
    "NON classificare il cielo o oggetti celesti (stelle, pianeti, Luna, Sole, satelliti): sono gestiti "
    "da un motore separato. Ignora il cielo.\n"
    "Per ogni elemento fornisci: label generica in italiano; kind (uno tra: water, vegetation, tree, plant, "
    "rock, mountain, building, monument, city, place, bridge, road, path, person, vehicle, animal, nature, "
    "object); region come box normalizzato {x,y,w,h} in 0..1 (origine in alto a sinistra); confidence 0..1; "
    "role ('subject' per i 2-3 elementi principali, altrimenti 'element'); specificity ('generic' oppure "
    "'specific'); identity_hint = eventuale nome specifico SOLO se molto plausibile dall'immagine (verrà "
    "verificato: non è garantito), altrimenti stringa vuota.\n"
    'Rispondi SOLO con JSON compatto: {"scene":{"label":"","confidence":0.0},"elements":['
    '{"label":"","kind":"","region":{"x":0,"y":0,"w":0,"h":0},"confidence":0.0,"role":"element",'
    '"specificity":"generic","identity_hint":""}]}'
)

REFINE_SYSTEM = (
    "Sei il motore di dettaglio di Sense Vision. Ricevi un RITAGLIO ad alta risoluzione di un elemento già "
    "individuato in una scena, la sua etichetta generica e (se disponibili) candidati di identità reali dal "
    "contesto geografico. Determina l'identità più SPECIFICA sostenibile con affidabilità. 'Oltre la Vista': "
    "non inventare. Se il ritaglio non consente maggiore specificità, resta all'etichetta generica.\n"
    "Se sono presenti candidati geografici, scegline uno SOLO se coerente con l'immagine; non forzare.\n"
    'Rispondi SOLO con JSON compatto: {"label_specific":"","confidence":0.0,"text":""} '
    "(text = eventuale testo/insegna leggibile nel ritaglio, altrimenti vuoto; label_specific vuoto se non "
    "determinabile)."
)


async def _llm_json(system: str, prompt: str, image_b64: str) -> dict:
    if not EMERGENT_LLM_KEY or not image_b64:
        return {}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                       system_message=system).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(text=prompt, file_contents=[ImageContent(image_base64=image_b64)]))
        raw = resp if isinstance(resp, str) else (getattr(resp, "text", None) or str(resp))
        s, e = raw.find("{"), raw.rfind("}")
        return json.loads(raw[s:e + 1]) if s != -1 else {}
    except Exception as ex:
        logger.warning(f"sense-vision LLM failed: {ex}")
        return {}


def _strip(b64: Optional[str]) -> str:
    raw = (b64 or "").strip()
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    return raw


def _ang_diff(a: float, b: float) -> float:
    d = abs((a - b + 180) % 360 - 180)
    return d


def _region_az(region: dict, heading: Optional[float], fov_h: Optional[float]) -> Optional[float]:
    """Absolute azimuth of a region's horizontal centre, from camera heading + FOV."""
    if heading is None or not fov_h:
        return None
    cx = float(region.get("x", 0)) + float(region.get("w", 0)) / 2.0
    return (heading + (cx - 0.5) * fov_h) % 360.0


def _region_alt(region: dict, cam_alt: Optional[float], fov_v: Optional[float]) -> Optional[float]:
    if cam_alt is None or not fov_v:
        return None
    cy = float(region.get("y", 0)) + float(region.get("h", 0)) / 2.0
    return cam_alt + (0.5 - cy) * fov_v


def _kind_weight(kind: str) -> float:
    if kind in ("monument", "mountain", "city", "place"):
        return 1.0
    if kind in ("water", "bridge", "animal", "plant"):
        return 0.8
    if kind in ("building", "nature", "vegetation", "tree", "rock"):
        return 0.5
    return 0.3  # road, path, person, vehicle, object


def _fuse_geo(el: dict, geo: List[dict], heading: Optional[float], fov_h: Optional[float]) -> None:
    """Elevate a generic element to a specific identity using real OSM context.
    Mutates `el` in place. Never invents: only assigns a name that geographically
    lies in the element's direction."""
    if el["kind"] not in GEO_KINDS or not geo or el.get("az") is None or not fov_h:
        return
    tol = max(4.0, fov_h * 0.35)  # allow generous horizontal tolerance
    best = None
    for g in geo:
        gk = GEO_CAT_TO_KIND.get(g.get("category", ""), None)
        # Match by direction; kind must be compatible (or unknown mapping).
        if gk is not None and el["kind"] not in ("place", "building") and gk != el["kind"]:
            # allow monument↔building and city↔place cross-matches
            if not ({gk, el["kind"]} <= {"monument", "building"} or {gk, el["kind"]} <= {"city", "place"}):
                continue
        d = _ang_diff(el["az"], g["az"])
        if d <= tol and (best is None or d < best[0]):
            best = (d, g)
    if not best:
        return
    d, g = best
    el["label_specific"] = g["name"]
    el["az"] = g["az"]
    el["alt"] = g["alt"]
    el["distance_km"] = g.get("distanceKm")
    el["source"] = "fused"
    # Closer alignment + reasonable distance → confirmed, else probable.
    el["tier"] = "confirmed" if (d <= tol * 0.5 and el["confidence"] >= 0.5) else "probable"


def _decide_tier(el: dict) -> None:
    """No-Invention tiering for elements NOT resolved by geography."""
    if el.get("tier"):
        return
    conf = el["confidence"]
    hint = (el.get("identity_hint") or "").strip()
    # Botanical/animal specific identity relies on image only → require high conf.
    if hint and el["kind"] in ("plant", "tree", "animal", "vegetation"):
        if conf >= 0.9:
            el["label_specific"] = hint
            el["tier"] = "confirmed"
        elif conf >= 0.8:
            el["label_specific"] = hint
            el["tier"] = "probable"
        else:
            el["tier"] = "generic"
    elif conf >= 0.5:
        el["tier"] = "generic"
    else:
        el["tier"] = "undetermined"


def _build_element(raw: dict, ctx: dict, geo: List[dict]) -> Optional[dict]:
    label = (raw.get("label") or "").strip()[:60]
    kind = raw.get("kind") if raw.get("kind") in KINDS else "object"
    if not label:
        return None
    try:
        conf = float(raw.get("confidence", 0) or 0)
    except (TypeError, ValueError):
        conf = 0.0
    region = raw.get("region") or {}
    if not isinstance(region, dict):
        region = {}
    heading = ctx.get("heading")
    fov_h = ctx.get("fovH")
    fov_v = (fov_h * float(ctx.get("aspect"))) if (fov_h and ctx.get("aspect")) else None
    el = {
        "id": str(uuid.uuid4())[:8],
        "label": label,
        "label_specific": None,
        "kind": kind,
        "confidence": round(conf, 2),
        "region": {k: round(float(region.get(k, 0) or 0), 4) for k in ("x", "y", "w", "h")},
        "role": "subject" if raw.get("role") == "subject" else "element",
        "identity_hint": (raw.get("identity_hint") or "").strip()[:60],
        "az": _region_az(region, heading, fov_h),
        "alt": _region_alt(region, ctx.get("cameraAlt"), fov_v),
        "source": "image",
        "tier": None,
    }
    if el["az"] is not None:
        el["az"] = round(el["az"], 2)
    if el["alt"] is not None:
        el["alt"] = round(el["alt"], 2)
    # Fusion with real geography (may set label_specific/tier/az/alt).
    _fuse_geo(el, geo, heading, fov_h)
    _decide_tier(el)
    if el["tier"] == "undetermined":
        return None
    # Salience & notability (drives anti-clutter ranking + Spatial Memory).
    area = min(1.0, el["region"]["w"] * el["region"]["h"])
    spec_bonus = 0.25 if el.get("label_specific") else 0.0
    el["salience"] = round(min(1.0, 0.4 * area + 0.4 * _kind_weight(kind) + 0.2 * conf + spec_bonus), 3)
    el["notable"] = bool((kind in NOTABLE_KINDS or el.get("label_specific")) and el["tier"] in ("confirmed", "probable"))
    el.pop("identity_hint", None)
    return el


def _needs_zoom(el: dict, ctx: dict) -> bool:
    """A second, high-resolution crop pass helps when a NOTABLE element is not yet
    specific (or only probable) and its region is small in the frame."""
    if not el.get("notable"):
        return False
    area = el["region"]["w"] * el["region"]["h"]
    small = area < 0.16
    not_confirmed = el["tier"] != "confirmed" or not el.get("label_specific")
    return bool(small and not_confirmed)


class AnalyzeReq(BaseModel):
    image_base64: str
    context: Optional[dict] = None   # {lat, lon, heading, cameraAlt, fovH, aspect, ele, radius_km, ts}
    mode: str = "capture"            # "live" | "capture"


@sv_router.post("/analyze")
async def analyze(req: AnalyzeReq, user: dict = Depends(get_current_user)):
    """Pass 1 — whole-scene understanding + geographic fusion. Returns a Scene
    Graph. Fails soft to an empty scene (never blocks the camera)."""
    img = _strip(req.image_base64)
    ctx = req.context or {}
    if not EMERGENT_LLM_KEY or not img:
        return {"version": RECOGNITION_SCHEMA_VERSION, "scene": None, "subjects": [], "elements": [], "needs_zoom": []}

    # Real geographic context (deterministic) — degrades gracefully to [].
    geo: List[dict] = []
    if ctx.get("lat") is not None and ctx.get("lon") is not None:
        try:
            from geo_places import resolve_places
            radius = float(ctx.get("radius_km") or 60.0)
            geo, _ = await resolve_places(float(ctx["lat"]), float(ctx["lon"]), radius, float(ctx.get("ele") or 0.0))
        except Exception as ex:
            logger.warning(f"geo fusion unavailable: {ex}")
            geo = []

    data = await _llm_json(SCENE_SYSTEM, "Analizza l'intera scena. Restituisci solo il JSON.", img)
    raw_elements = data.get("elements") or []
    built: List[dict] = []
    for raw in raw_elements[:24]:
        el = _build_element(raw, ctx, geo)
        if el:
            built.append(el)
    built.sort(key=lambda e: e["salience"], reverse=True)

    subjects = [e for e in built if e["role"] == "subject"][:3]
    elements = [e for e in built if e["role"] != "subject"]
    needs_zoom = [e["id"] for e in built if _needs_zoom(e, ctx)]

    scene = None
    sc = data.get("scene") or {}
    if sc.get("label"):
        scene = {"label": str(sc["label"])[:80], "label_specific": None,
                 "confidence": round(float(sc.get("confidence", 0) or 0), 2), "source": "image", "tier": "generic"}
        # Scene-level specific identity from a dominant city/place in view.
        city = next((g for g in geo if GEO_CAT_TO_KIND.get(g.get("category", "")) in ("city", "place")), None)
        if city:
            scene["label_specific"] = city["name"]
            scene["source"] = "fused"

    return {
        "version": RECOGNITION_SCHEMA_VERSION,
        "scene": scene,
        "subjects": subjects,
        "elements": elements,
        "needs_zoom": needs_zoom,
        "geo_available": bool(geo),
    }


class RefineReq(BaseModel):
    crop_base64: str
    label: str = ""
    kind: str = "object"
    candidates: Optional[List[dict]] = None   # optional geo candidates [{name, category, distanceKm}]


@sv_router.post("/refine")
async def refine(req: RefineReq, user: dict = Depends(get_current_user)):
    """Pass 2 — high-resolution crop of one element (automatic gating or manual
    'Approfondisci'). Returns a more specific identity ONLY if supportable."""
    crop = _strip(req.crop_base64)
    if not EMERGENT_LLM_KEY or not crop:
        return {"label_specific": None, "confidence": 0.0, "tier": "generic", "text": ""}
    cand = ""
    if req.candidates:
        cand = "Candidati geografici reali:\n" + "\n".join(
            f"- {c.get('name')} ({c.get('category')}, {c.get('distanceKm')} km)" for c in req.candidates[:6])
    prompt = f"Etichetta generica: {req.label or '(sconosciuta)'} · kind: {req.kind}\n{cand}\nRestituisci solo il JSON."
    data = await _llm_json(REFINE_SYSTEM, prompt, crop)
    spec = (data.get("label_specific") or "").strip()[:60]
    try:
        conf = float(data.get("confidence", 0) or 0)
    except (TypeError, ValueError):
        conf = 0.0
    tier = "generic"
    if spec:
        tier = "confirmed" if conf >= 0.85 else ("probable" if conf >= 0.6 else "generic")
        if tier == "generic":
            spec = ""
    return {"label_specific": spec or None, "confidence": round(conf, 2), "tier": tier,
            "text": (data.get("text") or "").strip()[:120]}


# --------------------------------------------------------------------------- #
# Persistence — the recognition layer lives ON the observation, versioned, and
# NEVER touches the original image.
# --------------------------------------------------------------------------- #
class SaveRecognition(BaseModel):
    recognition: dict           # SceneRecognition captured at shot time (elements in-frame only)
    overlay_default: str = "on"  # "on" | "off" — the creator's view choice at capture


@sv_router.post("/observations/{obs_id}/recognition")
async def save_recognition(obs_id: str, req: SaveRecognition, user: dict = Depends(get_active_user)):
    obs = await db.observations.find_one({"id": obs_id}, {"_id": 0, "id": 1, "user_id": 1})
    if not obs:
        raise HTTPException(status_code=404, detail="Sense non trovato")
    if obs["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo l'autore può salvare il riconoscimento")
    rec = dict(req.recognition or {})
    rec["schema_version"] = RECOGNITION_SCHEMA_VERSION
    rec["overlay_default"] = "off" if req.overlay_default == "off" else "on"
    await db.observations.update_one({"id": obs_id}, {"$set": {
        "recognition": rec,
        "recognition_version": 1,
        "recognized_at": _now(),
        "recognition_source": "capture",
    }})
    return {"ok": True, "recognition_version": 1}


@sv_router.get("/observations/{obs_id}/recognition")
async def get_recognition(obs_id: str, user: dict = Depends(get_current_user)):
    obs = await db.observations.find_one({"id": obs_id}, {"_id": 0, "recognition": 1, "recognition_version": 1, "recognized_at": 1})
    if not obs:
        raise HTTPException(status_code=404, detail="Sense non trovato")
    return {"recognition": obs.get("recognition"), "recognition_version": obs.get("recognition_version", 0),
            "recognized_at": obs.get("recognized_at")}


@sv_router.post("/observations/{obs_id}/reanalyze")
async def reanalyze(obs_id: str, user: dict = Depends(get_active_user)):
    """Controlled, versioned RE-ANALYSIS (future-proofing). Re-runs the current
    engine on the stored image and bumps recognition_version. Owner-only. The
    original image is untouched; only the recognition layer is regenerated."""
    obs = await db.observations.find_one({"id": obs_id}, {"_id": 0})
    if not obs:
        raise HTTPException(status_code=404, detail="Sense non trovato")
    if obs["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo l'autore può rigenerare il riconoscimento")
    if not obs.get("has_image"):
        raise HTTPException(status_code=400, detail="Nessuna immagine da analizzare")
    import r2_storage
    img = await r2_storage.fetch_base64(obs_id, "detail")
    if not img:
        raise HTTPException(status_code=404, detail="Immagine non disponibile")
    d = obs.get("data") or {}
    ctx = {"lat": d.get("lat") or obs.get("lat"), "lon": d.get("lon") or obs.get("lon"),
           "heading": d.get("cameraAz"), "cameraAlt": d.get("cameraAlt"), "fovH": d.get("fovH")}
    result = await analyze(AnalyzeReq(image_base64=img, context=ctx, mode="capture"), user)
    new_version = int(obs.get("recognition_version", 0) or 0) + 1
    prev_default = (obs.get("recognition") or {}).get("overlay_default", "on")
    result["overlay_default"] = prev_default
    await db.observations.update_one({"id": obs_id}, {"$set": {
        "recognition": result,
        "recognition_version": new_version,
        "recognized_at": _now(),
        "recognition_source": "reanalysis",
    }})
    return {"ok": True, "recognition_version": new_version, "recognition": result}
