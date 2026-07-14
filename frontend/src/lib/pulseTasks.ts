// Pulse™ — libreria curata di sfide osservative (OFFLINE, mai generate da AI).
// Ogni sfida invita a osservare la realtà cercando ciò che l'occhio di solito non nota.
// Le sfide sono etichettate con le fasce orarie in cui hanno senso: p.es. "la Luna"
// appare solo di notte, "l'ora dorata" solo all'alba/tramonto. La Pulse proposta viene
// sempre scelta tra quelle coerenti con l'orario reale del dispositivo.

export type PulseWindow = "dawn" | "day" | "golden" | "night" | "any";

export interface PulseTask {
  id: string;
  title: string;
  theme: string;
  prompt: string; // cosa fare
  hint: string; // cosa rivela OverView / perché è interessante
  icon: string; // emoji
  windows: PulseWindow[];
}

export const PULSE_TASKS: PulseTask[] = [
  // --- Any time -------------------------------------------------------------
  { id: "reflection", title: "Un riflesso", theme: "Riflessi", icon: "🪞",
    prompt: "Trova un riflesso: acqua, vetro, metallo, uno schermo.",
    hint: "Il riflesso raddoppia la realtà: mostra ciò che è dietro di te e la geometria della luce.",
    windows: ["any"] },
  { id: "symmetry", title: "Una simmetria", theme: "Geometria", icon: "🦋",
    prompt: "Cerca una simmetria naturale o costruita e mettila al centro.",
    hint: "La simmetria è un ordine nascosto che il cervello percepisce prima ancora di riconoscerlo.",
    windows: ["any"] },
  { id: "texture", title: "Una texture invisibile", theme: "Micro-dettaglio", icon: "🔬",
    prompt: "Avvicinati fino a riempire l'inquadratura con una superficie: corteccia, tessuto, pietra.",
    hint: "Da vicino ogni superficie diventa un paesaggio: OverView esalta il micro-dettaglio reale.",
    windows: ["any"] },
  { id: "hidden-geometry", title: "Una geometria nascosta", theme: "Geometria", icon: "📐",
    prompt: "Trova cerchi, triangoli o linee ripetute dove nessuno le nota.",
    hint: "La geometria struttura il mondo: una volta vista, non potrai più non vederla.",
    windows: ["any"] },
  { id: "complementary", title: "Colori complementari", theme: "Colore", icon: "🎨",
    prompt: "Inquadra due colori opposti (blu/arancio, rosso/verde) nella stessa scena.",
    hint: "I colori complementari si esaltano a vicenda: il layer Colore ne rivela la vera saturazione.",
    windows: ["any"] },
  { id: "small-in-big", title: "Il piccolo nel grande", theme: "Scala", icon: "🔭",
    prompt: "Metti un piccolo soggetto in un ambiente enorme.",
    hint: "Il contrasto di scala racconta la nostra posizione nell'universo.",
    windows: ["any"] },
  { id: "unusual-angle", title: "Prospettiva insolita", theme: "Punto di vista", icon: "🔄",
    prompt: "Fotografa qualcosa di comune da un angolo che nessuno userebbe.",
    hint: "Il Senshot è un punto di vista: cambiando prospettiva riveli una realtà diversa.",
    windows: ["any"] },
  { id: "face-detail", title: "Il dettaglio di uno sguardo", theme: "Persone", icon: "👁️",
    prompt: "Cattura un dettaglio di un volto: un occhio, le rughe, un'espressione.",
    hint: "I micro-dettagli di un volto contengono più informazioni di un ritratto intero.",
    windows: ["any"] },
  { id: "rust-metal", title: "Metallo e tempo", theme: "Materia", icon: "🔩",
    prompt: "Trova metallo ossidato, ruggine o una superficie consumata dal tempo.",
    hint: "L'ossidazione è chimica lenta resa visibile: il tempo che diventa colore.",
    windows: ["any"] },
  { id: "bark-cracks", title: "Corteccia e crepe", theme: "Materia", icon: "🌳",
    prompt: "Riempi l'inquadratura con corteccia, terra screpolata o intonaco.",
    hint: "Le crepe seguono le stesse leggi fisiche dei fiumi e dei fulmini.",
    windows: ["any"] },
  { id: "frozen-motion", title: "Movimento congelato", theme: "Tempo", icon: "💧",
    prompt: "Cattura qualcosa in movimento nell'istante esatto: acqua, ali, un salto.",
    hint: "La fotocamera vede un istante che l'occhio non può fermare.",
    windows: ["any"] },
  { id: "puddle", title: "Riflesso in una pozza", theme: "Riflessi", icon: "💦",
    prompt: "Trova una pozzanghera e usala come specchio del cielo o degli edifici.",
    hint: "Una pozza capovolge il mondo e rivela il cielo sotto i tuoi piedi.",
    windows: ["any"] },

  // --- Day ------------------------------------------------------------------
  { id: "sharp-shadow", title: "Un'ombra netta", theme: "Luce & Ombra", icon: "🌑",
    prompt: "Trova un'ombra dai bordi definiti e rendila protagonista.",
    hint: "L'ombra misura la direzione reale del Sole in questo istante.",
    windows: ["day"] },
  { id: "leaf-veins", title: "Le venature di una foglia", theme: "Natura", icon: "🍃",
    prompt: "Avvicinati a una foglia in controluce per vederne le nervature.",
    hint: "Le venature sono i fiumi che nutrono la foglia: rete invisibile della vita.",
    windows: ["day"] },
  { id: "micro-world", title: "Il micro-mondo", theme: "Micro-dettaglio", icon: "🐜",
    prompt: "Cerca un piccolo essere vivente o un dettaglio minuscolo e riempilo di inquadratura.",
    hint: "A questa scala esiste un mondo intero che passiamo accanto ogni giorno.",
    windows: ["day"] },
  { id: "clouds", title: "Nuvole e forme", theme: "Atmosfera", icon: "☁️",
    prompt: "Inquadra le nuvole e la loro forma nel cielo di ora.",
    hint: "Le nuvole raccontano l'umidità, il vento e la pressione reali sopra di te.",
    windows: ["day"] },
  { id: "sky-between", title: "Il cielo tra i palazzi", theme: "Urbano", icon: "🏙️",
    prompt: "Trova la porzione di cielo ritagliata tra edifici o strutture.",
    hint: "Lo spazio negativo del cielo diventa una forma disegnata dall'architettura.",
    windows: ["day"] },
  { id: "wind-visible", title: "Il vento reso visibile", theme: "Movimento", icon: "🌬️",
    prompt: "Cattura qualcosa che si muove nel vento: foglie, bandiere, capelli, erba.",
    hint: "Il vento è invisibile: lo vediamo solo attraverso ciò che tocca.",
    windows: ["day"] },
  { id: "ripples", title: "Increspature sull'acqua", theme: "Acqua", icon: "🌊",
    prompt: "Trova increspature o onde su una superficie d'acqua.",
    hint: "Ogni increspatura è un'onda che trasporta energia senza spostare l'acqua.",
    windows: ["day", "golden"] },

  // --- Golden hour / dusk ---------------------------------------------------
  { id: "grazing-light", title: "Luce radente", theme: "Luce", icon: "🌇",
    prompt: "Ora la luce è bassa: trova una superficie illuminata di lato.",
    hint: "La luce radente rivela ogni rilievo e texture che a mezzogiorno sparisce.",
    windows: ["golden"] },
  { id: "long-shadows", title: "Ombre lunghe", theme: "Luce & Ombra", icon: "🕴️",
    prompt: "Usa le ombre allungate del Sole basso come soggetto.",
    hint: "La lunghezza dell'ombra dipende dall'altezza reale del Sole sull'orizzonte.",
    windows: ["golden"] },
  { id: "sunset-colors", title: "I colori del tramonto", theme: "Atmosfera", icon: "🌅",
    prompt: "Cattura le gradazioni di colore del cielo mentre il Sole cala.",
    hint: "Il rosso nasce dalla luce che attraversa più atmosfera: fisica pura resa in colore.",
    windows: ["golden"] },
  { id: "backlight-silhouette", title: "Silhouette controluce", theme: "Luce", icon: "🌆",
    prompt: "Metti un soggetto davanti alla luce e rendilo una sagoma nera.",
    hint: "Togliendo il dettaglio resta solo la forma: l'essenza dell'oggetto.",
    windows: ["golden"] },
  { id: "blue-hour", title: "L'ora blu", theme: "Atmosfera", icon: "🔵",
    prompt: "Nella luce fredda del crepuscolo, cattura la dominante blu della scena.",
    hint: "L'ora blu è il breve equilibrio tra luce solare residua e luci artificiali.",
    windows: ["golden", "night"] },

  // --- Dawn -----------------------------------------------------------------
  { id: "dew", title: "Gocce e rugiada", theme: "Micro-dettaglio", icon: "💠",
    prompt: "Cerca gocce di rugiada o condensa e avvicinati.",
    hint: "Ogni goccia è una lente che contiene una versione capovolta del mondo.",
    windows: ["dawn"] },
  { id: "spiderweb", title: "Ragnatela all'alba", theme: "Natura", icon: "🕸️",
    prompt: "Trova una ragnatela, meglio se con la rugiada che la disegna.",
    hint: "La geometria della tela è ingegneria naturale ottimizzata per la trappola.",
    windows: ["dawn"] },
  { id: "first-light", title: "La prima luce", theme: "Luce", icon: "🌄",
    prompt: "Cattura la prima luce del giorno che tocca qualcosa.",
    hint: "L'alba è il terminatore: il confine reale tra notte e giorno che ti raggiunge.",
    windows: ["dawn"] },

  // --- Night ----------------------------------------------------------------
  { id: "moon-tonight", title: "La Luna di stanotte", theme: "Cielo", icon: "🌙",
    prompt: "Trova la Luna e catturala: OverView registrerà la sua fase reale.",
    hint: "La fase mostra quanto della Luna è illuminato dal Sole in questo istante.",
    windows: ["night"] },
  { id: "one-star", title: "Una stella", theme: "Cielo", icon: "⭐",
    prompt: "Punta verso una stella o un pianeta visibile ora sopra di te.",
    hint: "La sua luce è partita anni fa: stai osservando il passato in diretta.",
    windows: ["night"] },
  { id: "night-sky", title: "Il cielo notturno", theme: "Cielo", icon: "🌌",
    prompt: "Inquadra una porzione di cielo stellato più ampia che puoi.",
    hint: "OverView proietta stelle, pianeti e satelliti realmente presenti in quella direzione.",
    windows: ["night"] },
  { id: "dark-reveals", title: "Il buio che rivela", theme: "Luce", icon: "🔦",
    prompt: "In poca luce, cattura una scena e lascia che i dettagli emergano.",
    hint: "OverView amplifica la luce reale raccolta, mostrando ciò che l'occhio perde nel buio.",
    windows: ["night"] },
  { id: "city-lights", title: "Le luci della città", theme: "Urbano", icon: "🌃",
    prompt: "Cattura le luci artificiali della notte e i loro colori.",
    hint: "Ogni luce ha una temperatura di colore diversa: una firma della sua sorgente.",
    windows: ["night"] },
];

export function getTimeWindow(date: Date): Exclude<PulseWindow, "any"> {
  const h = date.getHours();
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 20) return "golden";
  return "night";
}

export const WINDOW_LABEL: Record<Exclude<PulseWindow, "any">, string> = {
  dawn: "Alba",
  day: "Giorno",
  golden: "Ora dorata",
  night: "Notte",
};

function fits(task: PulseTask, w: Exclude<PulseWindow, "any">): boolean {
  return task.windows.includes("any") || task.windows.includes(w);
}

export function tasksForNow(date: Date = new Date()): PulseTask[] {
  const w = getTimeWindow(date);
  const list = PULSE_TASKS.filter((t) => fits(t, w));
  return list.length ? list : PULSE_TASKS;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic Pulse for the current day + time window. `salt` reshuffles ("Altra sfida").
export function pulseForNow(date: Date = new Date(), salt = 0): PulseTask {
  const w = getTimeWindow(date);
  const list = tasksForNow(date);
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${w}-${salt}`;
  const idx = hashStr(dayKey) % list.length;
  return list[idx];
}

export function getPulseTask(id?: string | null): PulseTask | undefined {
  if (!id) return undefined;
  return PULSE_TASKS.find((t) => t.id === id);
}
