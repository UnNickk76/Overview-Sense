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


class ExplainOppReq(BaseModel):
    title: str
    facts: List[str]
    kind: Optional[str] = None


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
