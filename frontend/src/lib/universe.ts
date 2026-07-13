// Universe Explorer — real, data-based 3D dataset across 5 progressive scales.
// The 3D scene is a data-based VISUALISATION (positions/sizes to real scale-order).
// Real PHOTOS live in each object's detail card (NASA Images API). Planet surface
// textures are equirectangular maps by Solar System Scope (CC BY 4.0).

export type UScale = 1 | 2 | 3 | 4 | 5;

export const SCALES: { level: UScale; name: string; sub: string }[] = [
  { level: 1, name: "Sistema Solare", sub: "Terra, Luna, pianeti, comete" },
  { level: 2, name: "Stelle vicine", sub: "I sistemi stellari intorno a noi" },
  { level: 3, name: "Via Lattea", sub: "Nebulose, ammassi, il centro galattico" },
  { level: 4, name: "Gruppo Locale", sub: "Le galassie vicine" },
  { level: 5, name: "Universo osservabile", sub: "Ammassi e superammassi" },
];

export type UKind =
  | "star" | "planet" | "moon" | "dwarf" | "comet" | "asteroid"
  | "nebula" | "cluster" | "galaxy" | "galaxycluster" | "blackhole"
  | "spacecraft" | "structure";

export type Representation = "photo" | "composite" | "reconstruction" | "illustration" | "model" | "data-viz";

export interface UObject {
  id: string;
  name: string;
  kind: UKind;
  scale: UScale;
  pos: [number, number, number];
  size: number;
  color: string;
  texture?: string;      // equirectangular surface map (spheres)
  emissive?: boolean;    // self-luminous (stars/sun)
  ring?: boolean;        // Saturn
  distanceLabel: string;
  blurb: string;
  cosmicId?: string;     // link to COSMIC_OBJECTS for the full detail screen
  rep: Representation;
  source: string;        // attribution for the visualisation
}

const TEX = (n: string) => `https://www.solarsystemscope.com/textures/download/2k_${n}.jpg`;
const SSS = "Texture: Solar System Scope (CC BY 4.0) · Visualizzazione basata sui dati";
const NASA_VIZ = "Posizioni/scale da cataloghi NASA/ESA · Visualizzazione basata sui dati";

export const UNIVERSE: UObject[] = [
  // ---------------- Scale 1 · Solar System ----------------
  { id: "sun", name: "Sole", kind: "star", scale: 1, pos: [0, 0, 0], size: 2.4, color: "#FDB813", texture: TEX("sun"), emissive: true, distanceLabel: "8 min luce", blurb: "La nostra stella: una sfera di plasma che alimenta ogni cosa.", cosmicId: "sun", rep: "photo", source: SSS },
  { id: "mercury", name: "Mercurio", kind: "planet", scale: 1, pos: [4, 0.2, 1], size: 0.35, color: "#9c8b7a", texture: TEX("mercury"), distanceLabel: "~4,3 min luce", blurb: "Il pianeta più vicino al Sole, senza atmosfera.", cosmicId: "mercury", rep: "photo", source: SSS },
  { id: "venus", name: "Venere", kind: "planet", scale: 1, pos: [6, -0.4, -2], size: 0.55, color: "#d9b382", texture: TEX("venus_surface"), distanceLabel: "~2,3 min luce", blurb: "Avvolto da nubi di acido, è il pianeta più caldo.", cosmicId: "venus", rep: "photo", source: SSS },
  { id: "earth", name: "Terra", kind: "planet", scale: 1, pos: [9, 0, 2], size: 0.6, color: "#3a7bd5", texture: TEX("earth_daymap"), distanceLabel: "Sei qui", blurb: "Il nostro pianeta. L'unico luogo dove sappiamo esistere la vita.", cosmicId: "earth", rep: "photo", source: SSS },
  { id: "moon", name: "Luna", kind: "moon", scale: 1, pos: [10.1, 0.3, 2.4], size: 0.2, color: "#c9c9c9", texture: TEX("moon"), distanceLabel: "1,3 sec luce", blurb: "Il nostro satellite naturale, nato da un impatto gigante.", cosmicId: "moon", rep: "photo", source: SSS },
  { id: "iss", name: "ISS", kind: "spacecraft", scale: 1, pos: [9.3, 0.5, 2.1], size: 0.08, color: "#dfe7ef", distanceLabel: "408 km dalla Terra", blurb: "Stazione Spaziale Internazionale, laboratorio in microgravità.", cosmicId: "iss", rep: "data-viz", source: NASA_VIZ },
  { id: "mars", name: "Marte", kind: "planet", scale: 1, pos: [13, -0.6, -3], size: 0.45, color: "#c1440e", texture: TEX("mars"), distanceLabel: "~12,7 min luce", blurb: "Il pianeta rosso, meta delle missioni robotiche.", cosmicId: "mars", rep: "photo", source: SSS },
  { id: "jupiter", name: "Giove", kind: "planet", scale: 1, pos: [18, 0.8, 4], size: 1.3, color: "#d8ca9d", texture: TEX("jupiter"), distanceLabel: "~43 min luce", blurb: "Il gigante gassoso, con la Grande Macchia Rossa.", cosmicId: "jupiter", rep: "photo", source: SSS },
  { id: "saturn", name: "Saturno", kind: "planet", scale: 1, pos: [23, -0.5, -5], size: 1.1, color: "#e3d2a0", texture: TEX("saturn"), ring: true, distanceLabel: "~79 min luce", blurb: "Celebre per il suo maestoso sistema di anelli.", cosmicId: "saturn", rep: "photo", source: SSS },
  { id: "uranus", name: "Urano", kind: "planet", scale: 1, pos: [27, 0.4, 3], size: 0.8, color: "#a6dbe0", texture: TEX("uranus"), distanceLabel: "~2,7 ore luce", blurb: "Gigante ghiacciato che ruota 'sdraiato'.", cosmicId: "uranus", rep: "photo", source: SSS },
  { id: "neptune", name: "Nettuno", kind: "planet", scale: 1, pos: [30, -0.3, -4], size: 0.78, color: "#3f54ba", texture: TEX("neptune"), distanceLabel: "~4,2 ore luce", blurb: "Il pianeta più esterno, con venti supersonici.", cosmicId: "neptune", rep: "photo", source: SSS },
  { id: "pluto", name: "Plutone", kind: "dwarf", scale: 1, pos: [34, 1.2, 6], size: 0.18, color: "#c8b6a0", distanceLabel: "~5,5 ore luce", blurb: "Pianeta nano nella Fascia di Kuiper.", cosmicId: "pluto", rep: "data-viz", source: NASA_VIZ },
  { id: "halley", name: "Cometa di Halley", kind: "comet", scale: 1, pos: [16, 3, -8], size: 0.15, color: "#bfe8ff", distanceLabel: "orbita ~76 anni", blurb: "La cometa periodica più famosa, di ritorno nel 2061.", cosmicId: "halley", rep: "data-viz", source: NASA_VIZ },
  { id: "voyager1", name: "Voyager 1", kind: "spacecraft", scale: 1, pos: [40, 5, 2], size: 0.1, color: "#e6e6e6", distanceLabel: "~24 mld km", blurb: "L'oggetto umano più lontano, nello spazio interstellare.", cosmicId: "voyager1", rep: "data-viz", source: NASA_VIZ },

  // ---------------- Scale 2 · Nearby stars ----------------
  { id: "sun2", name: "Sole", kind: "star", scale: 2, pos: [0, 0, 0], size: 0.6, color: "#FDB813", emissive: true, distanceLabel: "Sei qui", blurb: "Il nostro Sole, punto di partenza.", cosmicId: "sun", rep: "data-viz", source: NASA_VIZ },
  { id: "proxima", name: "Proxima Centauri", kind: "star", scale: 2, pos: [7, 1, -3], size: 0.35, color: "#ff6b4a", emissive: true, distanceLabel: "4,24 anni luce", blurb: "La stella più vicina al Sole, con un pianeta in zona abitabile.", cosmicId: "proxima", rep: "data-viz", source: NASA_VIZ },
  { id: "alphacen", name: "Alpha Centauri", kind: "star", scale: 2, pos: [7.6, 0.6, -2.6], size: 0.55, color: "#fff2cc", emissive: true, distanceLabel: "4,37 anni luce", blurb: "Sistema stellare triplo, vicino di casa del Sole.", rep: "data-viz", source: NASA_VIZ },
  { id: "barnard", name: "Stella di Barnard", kind: "star", scale: 2, pos: [-6, -1.5, 4], size: 0.3, color: "#ff7a4a", emissive: true, distanceLabel: "5,96 anni luce", blurb: "Nana rossa con il moto proprio più veloce del cielo.", rep: "data-viz", source: NASA_VIZ },
  { id: "sirius", name: "Sirio", kind: "star", scale: 2, pos: [10, -2, 6], size: 0.7, color: "#bcd6ff", emissive: true, distanceLabel: "8,6 anni luce", blurb: "La stella più brillante del cielo notturno.", cosmicId: "sirius", rep: "data-viz", source: NASA_VIZ },
  { id: "vega", name: "Vega", kind: "star", scale: 2, pos: [-11, 2, -5], size: 0.65, color: "#dbe6ff", emissive: true, distanceLabel: "25 anni luce", blurb: "Stella di riferimento storica per la fotometria.", rep: "data-viz", source: NASA_VIZ },
  { id: "betelgeuse", name: "Betelgeuse", kind: "star", scale: 2, pos: [14, 4, -9], size: 1.4, color: "#ff5330", emissive: true, distanceLabel: "~640 anni luce", blurb: "Supergigante rossa, candidata a esplodere in supernova.", cosmicId: "betelgeuse", rep: "data-viz", source: NASA_VIZ },

  // ---------------- Scale 3 · Milky Way ----------------
  { id: "sgra", name: "Sagittarius A*", kind: "blackhole", scale: 3, pos: [0, 0, 0], size: 0.9, color: "#ffb060", distanceLabel: "26.000 anni luce", blurb: "Il buco nero supermassiccio al centro della Via Lattea.", cosmicId: "sgra", rep: "reconstruction", source: "EHT/ricostruzione · Visualizzazione basata sui dati" },
  { id: "orion-neb", name: "Nebulosa di Orione", kind: "nebula", scale: 3, pos: [8, 2, -5], size: 1.6, color: "#ff7bd0", distanceLabel: "1.344 anni luce", blurb: "Vivaio stellare visibile a occhio nudo.", cosmicId: "orion-nebula", rep: "data-viz", source: NASA_VIZ },
  { id: "eagle-neb", name: "Nebulosa Aquila", kind: "nebula", scale: 3, pos: [-9, -3, 6], size: 1.5, color: "#8fd0a0", distanceLabel: "7.000 anni luce", blurb: "Sede dei celebri 'Pilastri della Creazione'.", rep: "data-viz", source: NASA_VIZ },
  { id: "crab-neb", name: "Nebulosa del Granchio", kind: "nebula", scale: 3, pos: [11, -4, 7], size: 1.2, color: "#9aa8ff", distanceLabel: "6.500 anni luce", blurb: "Resto di supernova con una pulsar al centro.", rep: "data-viz", source: NASA_VIZ },
  { id: "pleiades", name: "Pleiadi", kind: "cluster", scale: 3, pos: [-12, 4, -7], size: 1.3, color: "#bcd6ff", distanceLabel: "444 anni luce", blurb: "Ammasso aperto giovane e brillante.", rep: "data-viz", source: NASA_VIZ },
  { id: "milkyway3", name: "Via Lattea", kind: "structure", scale: 3, pos: [0, -6, 0], size: 22, color: "#4a5fb0", distanceLabel: "~100.000 anni luce", blurb: "La nostra galassia a spirale barrata.", cosmicId: "milkyway", rep: "reconstruction", source: "Visualizzazione basata sui dati" },

  // ---------------- Scale 4 · Local Group ----------------
  { id: "milkyway4", name: "Via Lattea", kind: "galaxy", scale: 4, pos: [0, 0, 0], size: 2.2, color: "#7f8fe0", distanceLabel: "Sei qui", blurb: "La nostra galassia, casa del Sole.", cosmicId: "milkyway", rep: "reconstruction", source: "Visualizzazione basata sui dati" },
  { id: "andromeda", name: "Andromeda (M31)", kind: "galaxy", scale: 4, pos: [10, 2, -4], size: 3.2, color: "#cdbfff", distanceLabel: "2,5 milioni anni luce", blurb: "La grande spirale in rotta di collisione con la Via Lattea.", cosmicId: "andromeda", rep: "data-viz", source: NASA_VIZ },
  { id: "triangulum", name: "Triangolo (M33)", kind: "galaxy", scale: 4, pos: [-9, -3, 5], size: 1.8, color: "#a0c8ff", distanceLabel: "2,7 milioni anni luce", blurb: "Terza galassia per dimensione del Gruppo Locale.", rep: "data-viz", source: NASA_VIZ },
  { id: "lmc", name: "Grande Nube di Magellano", kind: "galaxy", scale: 4, pos: [5, -4, 6], size: 1.1, color: "#ffd9a0", distanceLabel: "160.000 anni luce", blurb: "Galassia satellite visibile dall'emisfero sud.", rep: "data-viz", source: NASA_VIZ },
  { id: "smc", name: "Piccola Nube di Magellano", kind: "galaxy", scale: 4, pos: [6.5, -4.5, 5], size: 0.8, color: "#ffe6c0", distanceLabel: "200.000 anni luce", blurb: "Compagna della Grande Nube di Magellano.", rep: "data-viz", source: NASA_VIZ },

  // ---------------- Scale 5 · Observable Universe ----------------
  { id: "localgroup", name: "Gruppo Locale", kind: "galaxycluster", scale: 5, pos: [0, 0, 0], size: 1.6, color: "#8f9fe0", distanceLabel: "~10 milioni anni luce", blurb: "L'insieme di galassie a cui appartiene la Via Lattea.", rep: "data-viz", source: NASA_VIZ },
  { id: "virgo", name: "Ammasso della Vergine", kind: "galaxycluster", scale: 5, pos: [9, 3, -5], size: 2.4, color: "#bca0ff", distanceLabel: "54 milioni anni luce", blurb: "Grande ammasso al cuore del Superammasso Locale.", rep: "data-viz", source: NASA_VIZ },
  { id: "laniakea", name: "Superammasso Laniakea", kind: "structure", scale: 5, pos: [-10, -4, 7], size: 5, color: "#6f8fd0", distanceLabel: "520 milioni anni luce", blurb: "Il superammasso che contiene la Via Lattea.", rep: "data-viz", source: NASA_VIZ },
  { id: "cmb", name: "Universo osservabile", kind: "structure", scale: 5, pos: [0, 0, 0], size: 34, color: "#2a3a70", distanceLabel: "raggio ~46,5 mld anni luce", blurb: "Il limite di ciò che possiamo osservare: il fondo cosmico.", rep: "data-viz", source: "Fondo cosmico a microonde · Visualizzazione basata sui dati" },
];

export function objectsForScale(scale: UScale): UObject[] {
  return UNIVERSE.filter((o) => o.scale === scale);
}

export function searchUniverse(q: string): UObject[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const seen = new Set<string>();
  return UNIVERSE.filter((o) => {
    if (seen.has(o.name)) return false;
    const hit = o.name.toLowerCase().includes(s);
    if (hit) seen.add(o.name);
    return hit;
  }).slice(0, 12);
}

export const KIND_LABEL: Record<UKind, string> = {
  star: "Stella", planet: "Pianeta", moon: "Luna", dwarf: "Pianeta nano",
  comet: "Cometa", asteroid: "Asteroide", nebula: "Nebulosa", cluster: "Ammasso stellare",
  galaxy: "Galassia", galaxycluster: "Ammasso di galassie", blackhole: "Buco nero",
  spacecraft: "Sonda / Missione", structure: "Struttura cosmica",
};

export const REP_LABEL: Record<Representation, string> = {
  photo: "Foto reale (dettaglio)", composite: "Composizione", reconstruction: "Ricostruzione scientifica",
  illustration: "Illustrazione", model: "Modello 3D", "data-viz": "Visualizzazione basata sui dati",
};
