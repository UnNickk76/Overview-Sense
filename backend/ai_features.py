"""AI narration layer — turns VERIFIED real data into engaging explanations.

Strict rule: the AI never invents values or phenomena. It only rephrases the
provided, already-computed facts into clear, useful, evocative Italian prose
(explanations, curiosities, practical observation / photography / listening tips).
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import EMERGENT_LLM_KEY

ai_router = APIRouter(prefix="/api/ai", tags=["ai-narration"])

BASE_RULES = (
    "Sei la voce narrante di Overview, uno strumento scientifico. Ricevi SOLO dati reali "
    "già calcolati da sensori del dispositivo e da fonti scientifiche pubbliche. "
    "REGOLE ASSOLUTE: non inventare mai valori o fenomeni; non aggiungere numeri non forniti; "
    "se un dato manca, non supporlo. Il tuo compito è trasformare i dati verificati in un testo "
    "chiaro, semplice, coinvolgente e utile in ITALIANO. Puoi aggiungere spiegazioni scientifiche "
    "corrette, curiosità, consigli pratici di osservazione/fotografia/ascolto e collegamenti "
    "storici o scientifici generali, ma il fondamento resta sempre il dato reale. Tono: divulgatore "
    "brillante e rigoroso, mai pseudoscienza. Sii conciso."
)


async def llm_complete(system: str, prompt: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI non disponibile")
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                   system_message=system).with_model("openai", "gpt-5.5")
    resp = await chat.send_message(UserMessage(text=prompt))
    if isinstance(resp, str):
        return resp
    return getattr(resp, "text", None) or getattr(resp, "content", None) or str(resp)


MODERATION_SYSTEM = (
    "You are a strict image safety classifier for Overview, a science observation app. "
    "Analyze the given image and decide if it violates the no-nudity / no-sexual-content policy. "
    "Respond with ONLY a compact JSON object, no prose, in this exact shape: "
    '{\"nudity\": <bool>, \"sexual\": <bool>, \"safe\": <bool>}. '
    "Set nudity=true if the image shows exposed genitalia, exposed female breasts, exposed buttocks, "
    "or explicit sexual acts. Set sexual=true for pornographic or sexually explicit content. "
    "safe MUST be false if nudity or sexual is true, otherwise safe=true. "
    "Ordinary scenes (nature, sky, people clothed, objects, art, science) are safe."
)


async def moderate_image_safe(image_base64: str) -> dict:
    """Returns {"safe": bool, "checked": bool}. Fails OPEN on technical errors so the
    app keeps working if the AI is unavailable, but blocks anything flagged as nudity."""
    import json
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    if not EMERGENT_LLM_KEY or not image_base64:
        return {"safe": True, "checked": False}
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                       system_message=MODERATION_SYSTEM).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(
            text="Classify this image for the no-nudity policy. Return only the JSON.",
            file_contents=[ImageContent(image_base64=image_base64)],
        ))
        text = resp if isinstance(resp, str) else (
            getattr(resp, "text", None) or getattr(resp, "content", None) or str(resp))
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            return {"safe": True, "checked": False}
        data = json.loads(text[start:end + 1])
        safe = bool(data.get("safe", True)) and not data.get("nudity") and not data.get("sexual")
        return {"safe": safe, "checked": True}
    except Exception:
        # Technical failure -> fail open (do not block legitimate science photos).
        return {"safe": True, "checked": False}


class ExplainOppReq(BaseModel):
    title: str
    facts: List[str]
    kind: Optional[str] = None


RECOGNIZE_SYSTEM = (
    "You classify the PRIMARY subject of a photo for the Overview app. "
    "Pick exactly ONE from: sky, moon, sun, person, animal, plant, vehicle, building, "
    "landscape, mountain, forest, city, water, object. "
    "Use 'water' for sea/lake/river, 'city' for urban skylines/streets, 'mountain' for peaks/ranges, "
    "'forest' for woods/dense trees. "
    "Respond ONLY with compact JSON: {\"subject\": <one of those>, \"label_it\": <2-3 word Italian label>}."
)


class RecognizeReq(BaseModel):
    image_base64: str


@ai_router.post("/recognize-subject")
async def recognize_subject(req: RecognizeReq):
    """Best-effort AI subject recognition to SUGGEST layers. Fails open (never blocks)."""
    import json as _json
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    raw = req.image_base64
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    if not EMERGENT_LLM_KEY or not raw:
        return {"subject": "generic", "label_it": "Realtà"}
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                       system_message=RECOGNIZE_SYSTEM).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(
            text="Classify the primary subject. Return only the JSON.",
            file_contents=[ImageContent(image_base64=raw)],
        ))
        text = resp if isinstance(resp, str) else (getattr(resp, "text", None) or str(resp))
        s, e = text.find("{"), text.rfind("}")
        data = _json.loads(text[s:e + 1]) if s != -1 else {}
        return {"subject": data.get("subject", "generic"), "label_it": data.get("label_it", "Realtà")}
    except Exception:
        return {"subject": "generic", "label_it": "Realtà"}


@ai_router.post("/explain-opportunity")
async def explain_opportunity(req: ExplainOppReq):
    facts = "\n".join(f"- {f}" for f in req.facts if f)
    prompt = (
        f"Opportunità di osservazione: \"{req.title}\".\n"
        f"Dati reali verificati:\n{facts}\n\n"
        "Scrivi una spiegazione di 2-4 frasi che aiuti concretamente la persona a viverla ora: "
        "cosa fare, quando, dove guardare e un consiglio pratico. Parti SEMPRE dai dati sopra."
    )
    return {"text": await llm_complete(BASE_RULES, prompt)}


class CuriosityReq(BaseModel):
    facts: List[str]


@ai_router.post("/curiosity")
async def curiosity(req: CuriosityReq):
    facts = "\n".join(f"- {f}" for f in req.facts if f)
    prompt = (
        "Genera la \"Curiosità del giorno\" (2-3 frasi) partendo ESCLUSIVAMENTE da questi dati reali "
        f"del momento e del luogo dell'utente:\n{facts}\n\n"
        "Deve essere sorprendente, vera e legata a ciò che l'utente può percepire ora."
    )
    return {"text": await llm_complete(BASE_RULES, prompt)}


class VizField(BaseModel):
    label: str
    value: str


class ExplainVizReq(BaseModel):
    fields: List[VizField]


@ai_router.post("/explain-visualization")
async def explain_visualization(req: ExplainVizReq):
    data = "\n".join(f"- {f.label}: {f.value}" for f in req.fields)
    system = BASE_RULES + (
        " Stai spiegando la modalità INVISIBLE FIELDS: una visualizzazione grafica di dati fisici "
        "reali e misurabili (campo magnetico, orientamento, luce, Sole, Luna, satelliti, meteo, "
        "meteo spaziale, GPS, rumore ambientale). NON è un'aura e non rappresenta nulla di "
        "paranormale: è solo una resa grafica di dati reali. Chiarisci quali dati contribuiscono "
        "alla visualizzazione e perché appare così."
    )
    prompt = (
        "Dati reali attualmente alla base della visualizzazione Invisible Fields:\n"
        f"{data}\n\n"
        "Spiega in 3-5 frasi quali di questi dati stanno modellando la grafica (colori, forma, "
        "movimento, intensità) e perché. Ricorda che è una rappresentazione di dati fisici reali, "
        "non un fenomeno inventato."
    )
    return {"text": await llm_complete(system, prompt)}


class SatelliteReq(BaseModel):
    location: str
    date: str
    layer: str
    layer_desc: str
    notes: Optional[str] = None


@ai_router.post("/analyze-satellite")
async def analyze_satellite(req: SatelliteReq):
    system = BASE_RULES + (
        " Stai analizzando un'immagine satellitare di osservazione della Terra. NON hai accesso ai "
        "pixel dell'immagine: ricevi solo METADATI verificati (località, data, tipo di layer). "
        "Il tuo compito è guidare l'interpretazione scientifica SENZA inventare ciò che è presente "
        "nell'immagine. Non trasformare mai una correlazione in una certezza. Non confermare ipotesi "
        "prive di evidenze. Devi rispondere ESCLUSIVAMENTE con un oggetto JSON valido con esattamente "
        "queste tre chiavi (valori stringa in italiano, 1-3 frasi ciascuno): "
        '{"observe": "...", "explanations": "...", "cannot": "..."}. '
        "'observe' = cosa questo tipo di layer permette oggettivamente di rilevare in quel contesto; "
        "'explanations' = possibili interpretazioni compatibili con quel tipo di dato; "
        "'cannot' = ciò che questo dato NON permette di concludere."
    )
    notes = f"\nNote dell'osservatore: {req.notes}" if req.notes else ""
    prompt = (
        f"Località: {req.location}\nData acquisizione: {req.date}\n"
        f"Layer satellitare: {req.layer} — {req.layer_desc}{notes}\n\n"
        "Restituisci SOLO il JSON con le tre sezioni WHAT WE OBSERVE / POSSIBLE EXPLANATIONS / "
        "WHAT WE CANNOT CONCLUDE."
    )
    text = await llm_complete(system, prompt)
    import json as _json
    observe = explanations = cannot = None
    try:
        raw = text.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1].replace("json", "", 1).strip() if "```" in raw else raw
        parsed = _json.loads(raw)
        observe = parsed.get("observe")
        explanations = parsed.get("explanations")
        cannot = parsed.get("cannot")
    except Exception:
        pass
    return {
        "observe": observe or text,
        "explanations": explanations or "",
        "cannot": cannot or "",
    }
