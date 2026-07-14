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


class SeeReq(BaseModel):
    image_base64: str
    facts: List[str] = []


SEE_SYSTEM = (
    "Sei l'Assistente Visivo di Overview. RICEVI una foto reale scattata dall'utente e un elenco "
    "di DATI REALI verificati (sensori del dispositivo e fonti scientifiche pubbliche). "
    "Il tuo compito: descrivere ciò che è OGGETTIVAMENTE visibile nell'immagine e arricchirlo con i "
    "dati reali forniti, rivelando ciò che l'occhio umano non percepisce facilmente. "
    "REGOLE ASSOLUTE: non inventare mai oggetti, valori o fenomeni non visibili o non forniti; "
    "non aggiungere numeri non presenti nei dati; se non sei sicuro di cosa sia, dillo con onestà; "
    "niente pseudoscienza, aure o paranormale. Rispondi in ITALIANO, 3-6 frasi, tono divulgativo "
    "brillante ma rigoroso. Quando utile, evidenzia cosa di invisibile-ma-reale è presente nella scena."
)


@ai_router.post("/see")
async def see(req: SeeReq):
    """Visual Assistant: the AI 'sees' through the camera and explains the real scene.
    Vision via OpenAI gpt-5.4. Never invents details (Beyond View philosophy)."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    raw = (req.image_base64 or "").strip()
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    if not EMERGENT_LLM_KEY or not raw:
        raise HTTPException(status_code=503, detail="Assistente Visivo non disponibile")
    facts = "\n".join(f"- {f}" for f in (req.facts or []) if f) or "- (nessun dato sensore disponibile)"
    prompt = (
        "Dati reali verificati del momento e del luogo:\n" + facts + "\n\n"
        "Osserva la foto e spiega cosa stai guardando integrando questi dati reali. "
        "Descrivi solo ciò che è realmente visibile o fornito."
    )
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                       system_message=SEE_SYSTEM).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(
            text=prompt, file_contents=[ImageContent(image_base64=raw)]))
        text = resp if isinstance(resp, str) else (
            getattr(resp, "text", None) or getattr(resp, "content", None) or str(resp))
        return {"text": text}
    except Exception:
        raise HTTPException(status_code=503, detail="Assistente Visivo non disponibile")


PULSE_COMPARE_SYSTEM = (
    "Sei il giudice-narratore di Pulse™, la sfida osservativa di OverView. Ricevi DUE foto reali "
    "scattate da due osservatori diversi sullo stesso tema, più i dati reali di ciascuna. "
    "Filosofia 'Oltre la Vista': NON inventare mai dettagli non visibili; descrivi solo ciò che è "
    "realmente nelle immagini o nei dati forniti. Confronta le due osservazioni in ITALIANO con "
    "questa struttura, senza dichiarare un 'vincitore' assoluto: "
    "1) COSA HANNO IN COMUNE, 2) OSSERVAZIONE A — cosa rivela di unico, "
    "3) OSSERVAZIONE B — cosa rivela di unico, 4) SGUARDO INVISIBILE — quale dettaglio reale, "
    "prospettiva o dato scientifico ciascuna ha catturato meglio. Tono: divulgatore rigoroso e "
    "incoraggiante. Sii conciso (max ~180 parole)."
)


async def compare_pulse(theme: str, img_a: str, facts_a: list, img_b: str, facts_b: list) -> str:
    """Pulse Challenge: AI compares two real Senshots on the same theme (Beyond View)."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="Pulse Challenge non disponibile")
    fa = "\n".join(f"- {f}" for f in (facts_a or []) if f) or "- (nessun dato)"
    fb = "\n".join(f"- {f}" for f in (facts_b or []) if f) or "- (nessun dato)"
    prompt = (
        f"Tema della sfida Pulse: \"{theme}\".\n\n"
        f"OSSERVAZIONE A (prima immagine) — dati reali:\n{fa}\n\n"
        f"OSSERVAZIONE B (seconda immagine) — dati reali:\n{fb}\n\n"
        "Confronta le due immagini secondo la struttura richiesta."
    )
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                       system_message=PULSE_COMPARE_SYSTEM).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(
            text=prompt,
            file_contents=[ImageContent(image_base64=img_a), ImageContent(image_base64=img_b)]))
        return resp if isinstance(resp, str) else (
            getattr(resp, "text", None) or getattr(resp, "content", None) or str(resp))
    except Exception:
        raise HTTPException(status_code=503, detail="Pulse Challenge non disponibile")


class GuideResolveReq(BaseModel):
    query: str
    lat: Optional[float] = None
    lon: Optional[float] = None


GUIDE_SYSTEM = (
    "Sei il risolutore di OverView Guide. L'utente chiede di osservare un oggetto reale, "
    "nel cielo o sulla Terra. Devi restituire SOLO un oggetto JSON valido, senza testo extra, "
    "con questi campi: "
    '{"domain":"sky"|"earth"|"unknown", "name":"nome leggibile in italiano", '
    '"sky_key":"sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|iss|<nome stella EN>|<nome deep-sky EN>|galcenter", '
    '"lat":numero, "lon":numero, "elevation_m":numero, "note":"breve nota in italiano"}. '
    "Regole: se è un corpo celeste usa domain=sky e compila sky_key con la chiave canonica in inglese "
    "(pianeti in inglese: jupiter, saturn...; stelle col nome proprio inglese: Sirius, Vega; ISS => iss; "
    "Via Lattea/centro galattico => galcenter). Se è un luogo terrestre (monti, monumenti, città, laghi, vulcani, fari) "
    "usa domain=earth e fornisci lat, lon ed elevation_m stimata realistica. Non inventare oggetti inesistenti: "
    "se non riconosci nulla di reale usa domain=unknown. Usa dati geografici/astronomici reali e verificati."
)


@ai_router.post("/guide/resolve")
async def guide_resolve(req: GuideResolveReq):
    import json
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    if not EMERGENT_LLM_KEY or not (req.query or "").strip():
        raise HTTPException(status_code=503, detail="OverView Guide non disponibile")
    loc = f" L'utente si trova a lat {req.lat}, lon {req.lon}." if req.lat is not None else ""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                       system_message=GUIDE_SYSTEM).with_model("openai", "gpt-5.4")
        resp = await chat.send_message(UserMessage(text=f'Richiesta: "{req.query}".{loc} Rispondi con il solo JSON.'))
        text = resp if isinstance(resp, str) else (getattr(resp, "text", None) or str(resp))
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1].replace("json", "", 1).strip() if "```" in text else text
        start, end = text.find("{"), text.rfind("}")
        data = json.loads(text[start:end + 1]) if start >= 0 else {}
        return {
            "domain": data.get("domain", "unknown"),
            "name": data.get("name") or req.query,
            "sky_key": (data.get("sky_key") or "").strip(),
            "lat": data.get("lat"),
            "lon": data.get("lon"),
            "elevation_m": data.get("elevation_m"),
            "note": data.get("note", ""),
        }
    except Exception:
        raise HTTPException(status_code=503, detail="OverView Guide non disponibile")


class TranscribeReq(BaseModel):
    audio_base64: str
    mime: Optional[str] = "m4a"


@ai_router.post("/guide/transcribe")
async def guide_transcribe(req: TranscribeReq):
    import base64 as _b64
    import os
    import tempfile
    from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
    raw = (req.audio_base64 or "").strip()
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    if not EMERGENT_LLM_KEY or not raw:
        raise HTTPException(status_code=503, detail="Trascrizione non disponibile")
    ext = (req.mime or "m4a").split("/")[-1]
    if ext not in ("mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"):
        ext = "m4a"
    path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as f:
            f.write(_b64.b64decode(raw))
            path = f.name
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        result = await stt.transcribe(file=path, model="whisper-1", language="it")
        txt = result.get("text") if isinstance(result, dict) else (getattr(result, "text", None) or str(result))
        return {"text": (txt or "").strip()}
    except Exception:
        raise HTTPException(status_code=503, detail="Trascrizione non disponibile")
    finally:
        if path and os.path.exists(path):
            try:
                os.unlink(path)
            except Exception:
                pass


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
