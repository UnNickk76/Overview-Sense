// Real astronomical reference data for Universe Explorer.
// All values are real (approximate where nature is approximate). No invented data.

export const C_KMH = 1079252848.8; // speed of light km/h
export const LY_KM = 9.4607e12;    // 1 light-year in km
export const AU_KM = 1.495978707e8;

export interface TravelSpeed { key: string; label: string; emoji: string; kmh: number }
export const TRAVEL_SPEEDS: TravelSpeed[] = [
  { key: "walk", label: "A piedi", emoji: "🚶", kmh: 5 },
  { key: "car", label: "Automobile", emoji: "🚗", kmh: 100 },
  { key: "plane", label: "Aereo di linea", emoji: "✈️", kmh: 900 },
  { key: "falcon", label: "Falcon 9 (orbitale)", emoji: "🚀", kmh: 28000 },
  { key: "voyager", label: "Voyager 1", emoji: "🛰️", kmh: 61500 },
  { key: "light", label: "Velocità della luce", emoji: "💡", kmh: C_KMH },
];

// ----- SCALE ladder (powers of ten), from smallest to largest -----
export interface ScaleLevel { name: string; emoji: string; meters: number; note: string }
export const SCALE_LEVELS: ScaleLevel[] = [
  { name: "Limite di Planck", emoji: "🔬", meters: 1.6e-35, note: "La più piccola scala con significato fisico noto." },
  { name: "Quark", emoji: "⚛️", meters: 1e-18, note: "Costituenti fondamentali di protoni e neutroni." },
  { name: "Nucleo atomico", emoji: "⚛️", meters: 1e-15, note: "Il cuore denso dell'atomo (femtometri)." },
  { name: "Atomo", emoji: "🧬", meters: 1e-10, note: "Circa un decimo di nanometro." },
  { name: "Molecola di DNA", emoji: "🧬", meters: 2e-9, note: "Larghezza della doppia elica." },
  { name: "Virus", emoji: "🦠", meters: 1e-7, note: "Circa 100 nanometri." },
  { name: "Cellula umana", emoji: "🔴", meters: 1e-5, note: "Decine di micrometri." },
  { name: "Capello", emoji: "🧵", meters: 1e-4, note: "Circa 100 micrometri di spessore." },
  { name: "Tu", emoji: "🧍", meters: 1.7, note: "La scala umana, il tuo punto di partenza." },
  { name: "Stanza", emoji: "🚪", meters: 5, note: "L'ambiente intorno a te." },
  { name: "Città", emoji: "🏙️", meters: 1e4, note: "Chilometri di edifici e strade." },
  { name: "Terra", emoji: "🌍", meters: 1.2742e7, note: "Diametro del nostro pianeta." },
  { name: "Orbita terrestre bassa (ISS)", emoji: "🛰️", meters: 8.2e5, note: "~410 km di quota: dove orbita la ISS." },
  { name: "Luna (distanza)", emoji: "🌙", meters: 3.844e8, note: "Distanza media Terra-Luna." },
  { name: "Sole (diametro)", emoji: "☀️", meters: 1.3927e9, note: "Ci starebbero ~109 Terre in fila." },
  { name: "Sistema Solare", emoji: "🪐", meters: 2.9e12, note: "Fino all'orbita di Nettuno." },
  { name: "Nube di Oort", emoji: "❄️", meters: 1.5e16, note: "Il confine gravitazionale del Sole." },
  { name: "Stella più vicina", emoji: "✨", meters: 4.0e16, note: "Proxima Centauri, ~4,24 anni luce." },
  { name: "Via Lattea", emoji: "🌌", meters: 9.5e20, note: "~100.000 anni luce di diametro." },
  { name: "Gruppo Locale", emoji: "🌐", meters: 1e23, note: "Via Lattea, Andromeda e decine di galassie." },
  { name: "Ammasso della Vergine", emoji: "🕸️", meters: 1e24, note: "Migliaia di galassie legate dalla gravità." },
  { name: "Superammasso Laniakea", emoji: "🕸️", meters: 5e24, note: "Il nostro superammasso, 100.000 galassie." },
  { name: "Filamenti cosmici", emoji: "🕸️", meters: 1e25, note: "La ragnatela cosmica di materia." },
  { name: "Universo osservabile", emoji: "🌌", meters: 8.8e26, note: "93 miliardi di anni luce di diametro." },
];

// ----- Cosmic objects -----
export type ObjType = "star" | "planet" | "moon" | "galaxy" | "nebula" | "blackhole" | "comet" | "spacecraft" | "dwarf";

export interface CosmicObject {
  id: string;
  name: string;
  type: ObjType;
  emoji: string;
  category: string;          // maps to feed category
  distanceKm: number;        // distance from Earth
  distanceLabel?: string;    // pre-formatted alt (e.g. "4.24 anni luce")
  diameterKm?: number;
  massKg?: number;
  gravityMs2?: number;
  tempK?: number;
  orbitalPeriod?: string;
  imageUrl?: string;         // public NASA/ESA image
  description: string;
  facts: string[];
}

const LY = LY_KM;

export const COSMIC_OBJECTS: CosmicObject[] = [
  {
    id: "sun", name: "Sole", type: "star", emoji: "☀️", category: "Sole",
    distanceKm: 1.496e8, diameterKm: 1.3927e6, massKg: 1.989e30, gravityMs2: 274, tempK: 5778,
    orbitalPeriod: "225-250 milioni di anni (attorno alla Via Lattea)",
    imageUrl: "https://images-assets.nasa.gov/image/PIA03149/PIA03149~medium.jpg",
    description: "La stella al centro del Sistema Solare, una nana gialla di sequenza principale.",
    facts: ["Contiene il 99,86% della massa del Sistema Solare.", "La sua luce impiega ~8 min 20 s a raggiungerti.", "Ogni secondo converte ~600 milioni di tonnellate di idrogeno in elio."],
  },
  {
    id: "moon", name: "Luna", type: "moon", emoji: "🌙", category: "Luna",
    distanceKm: 384400, diameterKm: 3474, massKg: 7.342e22, gravityMs2: 1.62, tempK: 250,
    orbitalPeriod: "27,3 giorni",
    imageUrl: "https://images-assets.nasa.gov/image/as11-44-6667/as11-44-6667~medium.jpg",
    description: "L'unico satellite naturale della Terra, si allontana di ~3,8 cm all'anno.",
    facts: ["La sua gravità causa le maree.", "Mostra sempre la stessa faccia (rotazione sincrona).", "La luce impiega ~1,3 secondi per arrivare da lì."],
  },
  {
    id: "mercury", name: "Mercurio", type: "planet", emoji: "☿️", category: "Pianeti",
    distanceKm: 9.17e7, diameterKm: 4879, massKg: 3.301e23, gravityMs2: 3.7, tempK: 440, orbitalPeriod: "88 giorni",
    description: "Il pianeta più piccolo e più vicino al Sole.",
    facts: ["Un giorno solare dura ~176 giorni terrestri.", "Nessuna atmosfera significativa."],
  },
  {
    id: "venus", name: "Venere", type: "planet", emoji: "♀️", category: "Pianeti",
    distanceKm: 4.14e7, diameterKm: 12104, massKg: 4.867e24, gravityMs2: 8.87, tempK: 737, orbitalPeriod: "225 giorni",
    description: "Il pianeta più caldo, avvolto da una densa atmosfera di CO₂.",
    facts: ["Effetto serra estremo: 465 °C in superficie.", "Ruota in senso opposto agli altri pianeti."],
  },
  {
    id: "mars", name: "Marte", type: "planet", emoji: "♂️", category: "Pianeti",
    distanceKm: 7.83e7, diameterKm: 6779, massKg: 6.417e23, gravityMs2: 3.72, tempK: 210, orbitalPeriod: "687 giorni",
    imageUrl: "https://images-assets.nasa.gov/image/PIA00407/PIA00407~medium.jpg",
    description: "Il pianeta rosso, con il vulcano più alto del Sistema Solare (Olympus Mons).",
    facts: ["Ha due piccole lune: Phobos e Deimos.", "Un giorno marziano dura 24h 37m."],
  },
  {
    id: "jupiter", name: "Giove", type: "planet", emoji: "🪐", category: "Pianeti",
    distanceKm: 5.88e8, diameterKm: 139820, massKg: 1.898e27, gravityMs2: 24.79, tempK: 165, orbitalPeriod: "11,9 anni",
    imageUrl: "https://images-assets.nasa.gov/image/PIA22946/PIA22946~medium.jpg",
    description: "Il gigante gassoso più grande, con la Grande Macchia Rossa.",
    facts: ["Ha oltre 95 lune conosciute.", "La Grande Macchia Rossa è una tempesta più grande della Terra."],
  },
  {
    id: "saturn", name: "Saturno", type: "planet", emoji: "🪐", category: "Pianeti",
    distanceKm: 1.2e9, diameterKm: 116460, massKg: 5.683e26, gravityMs2: 10.44, tempK: 134, orbitalPeriod: "29,4 anni",
    imageUrl: "https://images-assets.nasa.gov/image/PIA11141/PIA11141~medium.jpg",
    description: "Famoso per il suo spettacolare sistema di anelli di ghiaccio e roccia.",
    facts: ["Gli anelli sono larghi ~280.000 km ma spessi solo ~10 m.", "Meno denso dell'acqua."],
  },
  {
    id: "proxima", name: "Proxima Centauri", type: "star", emoji: "✨", category: "Astronomia",
    distanceKm: 4.24 * LY, distanceLabel: "4,24 anni luce", diameterKm: 200000, massKg: 2.4e29, tempK: 3042,
    description: "La stella più vicina al Sole, una nana rossa con un pianeta nella zona abitabile.",
    facts: ["La sua luce impiega 4,24 anni ad arrivare.", "Ospita Proxima b, un pianeta potenzialmente roccioso."],
  },
  {
    id: "sirius", name: "Sirio", type: "star", emoji: "⭐", category: "Costellazioni",
    distanceKm: 8.6 * LY, distanceLabel: "8,6 anni luce", diameterKm: 2.4e6, tempK: 9940,
    description: "La stella più luminosa del cielo notturno, nella costellazione del Cane Maggiore.",
    facts: ["È in realtà un sistema doppio (Sirio A e B).", "Molto più calda e luminosa del Sole."],
  },
  {
    id: "betelgeuse", name: "Betelgeuse", type: "star", emoji: "🔴", category: "Costellazioni",
    distanceKm: 548 * LY, distanceLabel: "~548 anni luce", diameterKm: 1.2e9, tempK: 3600,
    description: "Supergigante rossa in Orione, candidata a esplodere in supernova.",
    facts: ["Se fosse al posto del Sole, inghiottirebbe fino a Giove.", "La sua luminosità varia nel tempo."],
  },
  {
    id: "milkyway", name: "Via Lattea", type: "galaxy", emoji: "🌌", category: "Via Lattea",
    distanceKm: 0, distanceLabel: "Ci sei dentro", diameterKm: 100000 * LY,
    description: "La nostra galassia a spirale barrata, con 100-400 miliardi di stelle.",
    facts: ["Il Sole orbita al centro in ~230 milioni di anni.", "Al centro c'è Sagittarius A*, un buco nero supermassiccio."],
  },
  {
    id: "andromeda", name: "Galassia di Andromeda", type: "galaxy", emoji: "🌌", category: "Astronomia",
    distanceKm: 2.537e6 * LY, distanceLabel: "2,5 milioni di anni luce", diameterKm: 220000 * LY,
    imageUrl: "https://images-assets.nasa.gov/image/PIA17004/PIA17004~medium.jpg",
    description: "La grande galassia a spirale più vicina, in rotta di collisione con la Via Lattea.",
    facts: ["Si fonderà con la Via Lattea tra ~4,5 miliardi di anni.", "Visibile a occhio nudo da cieli bui."],
  },
  {
    id: "orion-nebula", name: "Nebulosa di Orione", type: "nebula", emoji: "🌫️", category: "Costellazioni",
    distanceKm: 1344 * LY, distanceLabel: "1.344 anni luce", diameterKm: 24 * LY,
    imageUrl: "https://images-assets.nasa.gov/image/PIA13130/PIA13130~medium.jpg",
    description: "Una vasta regione di formazione stellare visibile nella spada di Orione.",
    facts: ["Una vera 'fabbrica di stelle'.", "Visibile con un semplice binocolo."],
  },
  {
    id: "sgra", name: "Sagittarius A*", type: "blackhole", emoji: "🕳️", category: "Via Lattea",
    distanceKm: 26000 * LY, distanceLabel: "26.000 anni luce", massKg: 8.26e36,
    description: "Il buco nero supermassiccio al centro della Via Lattea.",
    facts: ["Massa pari a ~4,3 milioni di Soli.", "Fotografato dall'Event Horizon Telescope nel 2022."],
  },
  {
    id: "iss", name: "Stazione Spaziale (ISS)", type: "spacecraft", emoji: "🛰️", category: "ISS",
    distanceKm: 410, diameterKm: 0.109, description: "Il laboratorio orbitante abitato dall'umanità.",
    facts: ["Orbita a ~28.000 km/h, un giro in ~90 minuti.", "Abitata ininterrottamente dal 2000."],
  },
  {
    id: "voyager1", name: "Voyager 1", type: "spacecraft", emoji: "📡", category: "Satelliti",
    distanceKm: 2.4e10, description: "L'oggetto costruito dall'uomo più lontano, nello spazio interstellare.",
    facts: ["Lanciata nel 1977.", "I suoi segnali impiegano oltre 22 ore ad arrivare."],
  },
  {
    id: "halley", name: "Cometa di Halley", type: "comet", emoji: "☄️", category: "Astronomia",
    distanceKm: 5.2e9, orbitalPeriod: "~76 anni",
    description: "La cometa periodica più famosa, di ritorno visibile nel 2061.",
    facts: ["Osservata da millenni.", "Origina gli sciami Eta Aquaridi e Orionidi."],
  },
  {
    id: "pluto", name: "Plutone", type: "dwarf", emoji: "🪨", category: "Pianeti",
    distanceKm: 5.9e9, diameterKm: 2377, massKg: 1.303e22, gravityMs2: 0.62, tempK: 44, orbitalPeriod: "248 anni",
    imageUrl: "https://images-assets.nasa.gov/image/PIA19952/PIA19952~medium.jpg",
    description: "Pianeta nano nella Fascia di Kuiper, esplorato da New Horizons nel 2015.",
    facts: ["Ha un cuore di ghiaccio azotato (Sputnik Planitia).", "La luce del Sole lo raggiunge in ~5,5 ore."],
  },
];

export function getObject(id: string): CosmicObject | undefined {
  return COSMIC_OBJECTS.find((o) => o.id === id);
}

// ----- Formatting helpers -----
export function formatDistanceKm(km: number): string {
  if (km === 0) return "—";
  if (km < 1e6) return `${km.toLocaleString("it-IT", { maximumFractionDigits: 0 })} km`;
  if (km < LY_KM) {
    const au = km / AU_KM;
    if (au < 0.01) return `${(km / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} milioni di km`;
    return `${au.toLocaleString("it-IT", { maximumFractionDigits: 2 })} UA`;
  }
  const ly = km / LY_KM;
  if (ly < 1e6) return `${ly.toLocaleString("it-IT", { maximumFractionDigits: 2 })} anni luce`;
  return `${(ly / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 2 })} milioni di anni luce`;
}

export function lightTravelTime(km: number): string {
  return travelTime(km, C_KMH);
}

export function travelTime(km: number, kmh: number): string {
  if (km <= 0) return "—";
  const hours = km / kmh;
  const seconds = hours * 3600;
  if (seconds < 60) return `${seconds.toLocaleString("it-IT", { maximumFractionDigits: 1 })} secondi`;
  if (seconds < 3600) return `${(seconds / 60).toLocaleString("it-IT", { maximumFractionDigits: 1 })} minuti`;
  if (hours < 24) return `${hours.toLocaleString("it-IT", { maximumFractionDigits: 1 })} ore`;
  const days = hours / 24;
  if (days < 365) return `${days.toLocaleString("it-IT", { maximumFractionDigits: 1 })} giorni`;
  const years = days / 365.25;
  if (years < 1e3) return `${years.toLocaleString("it-IT", { maximumFractionDigits: 1 })} anni`;
  if (years < 1e6) return `${(years / 1e3).toLocaleString("it-IT", { maximumFractionDigits: 1 })} migliaia di anni`;
  if (years < 1e9) return `${(years / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} milioni di anni`;
  return `${(years / 1e9).toLocaleString("it-IT", { maximumFractionDigits: 2 })} miliardi di anni`;
}
