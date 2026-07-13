// Live + curated cosmic catalogs that extend the Universe Explorer scene.
// - Asteroids: LIVE from the backend (NASA NeoWs), with a curated real fallback.
// - Comets / Pulsars / Quasars / Probes: real curated catalogs (measured values,
//   sources labelled). 3D positions are a data-visualisation (deterministic scatter).

import { apiFetch } from "./client";
import { UObject, UScale, UKind } from "./universe";

// Deterministic pseudo-random from a string seed (stable positions per object).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

// Scatter an object on a spherical shell [rMin,rMax] deterministically by id.
function scatter(id: string, rMin: number, rMax: number): [number, number, number] {
  const a = hash(id + "az") * Math.PI * 2;
  const p = Math.acos(2 * hash(id + "pol") - 1);
  const r = rMin + hash(id + "rad") * (rMax - rMin);
  return [r * Math.sin(p) * Math.cos(a), (r * Math.cos(p)) * 0.5, r * Math.sin(p) * Math.sin(a)];
}

function km(n?: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} mln km`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} mila km`;
  return `${Math.round(n)} km`;
}

// ---------------- Asteroids (LIVE via backend) ----------------
interface ApiAsteroid {
  id: string; name: string; scale: 1;
  diameter_m_min?: number | null; diameter_m_max?: number | null;
  hazardous?: boolean; miss_km?: number | null; miss_lunar?: number | null;
  velocity_kms?: number | null; approach_date?: string | null; source: string;
}

export async function fetchAsteroids(): Promise<UObject[]> {
  try {
    const res = await apiFetch<{ objects: ApiAsteroid[]; live: boolean }>("/universe/asteroids");
    return (res.objects || []).map((a) => {
      const d = a.diameter_m_max ?? a.diameter_m_min ?? 100;
      const size = Math.max(0.06, Math.min(0.28, Math.log10(d + 10) * 0.08));
      const parts = [
        a.diameter_m_max ? `Ø ~${Math.round(a.diameter_m_max)} m` : null,
        a.velocity_kms ? `${a.velocity_kms.toFixed(1)} km/s` : null,
        a.miss_lunar ? `${a.miss_lunar.toFixed(1)}× distanza Luna` : null,
      ].filter(Boolean).join(" · ");
      return {
        id: a.id, name: a.name || "Asteroide", kind: "asteroid" as UKind, scale: 1 as UScale,
        pos: scatter(a.id, 42, 72), size, color: a.hazardous ? "#ff6b4a" : "#b8a98c",
        distanceLabel: a.miss_km ? km(a.miss_km) : "orbita NEO",
        blurb: `${a.hazardous ? "Asteroide potenzialmente pericoloso. " : ""}${parts || "Oggetto near-Earth."}${a.approach_date ? ` Passaggio: ${a.approach_date}.` : ""}`,
        rep: "data-viz", source: a.source,
      };
    });
  } catch {
    return [];
  }
}

// ---------------- Curated real catalogs ----------------
type Seed = Omit<UObject, "pos" | "rep"> & { rMin: number; rMax: number };

const SRC_JPL = "Dati orbitali reali · JPL/NASA";
const SRC_ATNF = "Catalogo pulsar ATNF · dati reali";
const SRC_QSO = "Cataloghi SDSS/NASA · dati reali";
const SRC_MISSION = "Missioni reali NASA/ESA";

const COMETS: Seed[] = [
  { id: "c-encke", name: "2P/Encke", kind: "comet", scale: 1, size: 0.14, color: "#bfe8ff", distanceLabel: "periodo 3,3 anni", blurb: "La cometa con il periodo orbitale più breve conosciuto.", source: SRC_JPL, rMin: 44, rMax: 66 },
  { id: "c-tempel", name: "55P/Tempel-Tuttle", kind: "comet", scale: 1, size: 0.14, color: "#a8dfff", distanceLabel: "periodo 33 anni", blurb: "Genitrice dello sciame meteorico delle Leonidi.", source: SRC_JPL, rMin: 44, rMax: 66 },
  { id: "c-swift", name: "109P/Swift-Tuttle", kind: "comet", scale: 1, size: 0.16, color: "#cdefff", distanceLabel: "periodo 133 anni", blurb: "Origine delle Perseidi, lo sciame meteorico d'agosto.", source: SRC_JPL, rMin: 48, rMax: 72 },
  { id: "c-halebopp", name: "C/1995 O1 Hale-Bopp", kind: "comet", scale: 1, size: 0.2, color: "#e6f7ff", distanceLabel: "periodo ~2.500 anni", blurb: "La 'Grande Cometa del 1997', visibile a occhio nudo per 18 mesi.", source: SRC_JPL, rMin: 52, rMax: 78 },
  { id: "c-neowise", name: "C/2020 F3 NEOWISE", kind: "comet", scale: 1, size: 0.16, color: "#d7f0ff", distanceLabel: "periodo ~6.800 anni", blurb: "Spettacolare cometa osservata nell'estate 2020.", source: SRC_JPL, rMin: 52, rMax: 78 },
  { id: "c-67p", name: "67P/Churyumov-Gerasimenko", kind: "comet", scale: 1, size: 0.13, color: "#bcd6cf", distanceLabel: "periodo 6,4 anni", blurb: "Visitata dalla sonda Rosetta e dal lander Philae (ESA).", source: SRC_JPL, rMin: 44, rMax: 66 },
];

const PULSARS: Seed[] = [
  { id: "p-crab", name: "Crab Pulsar (PSR B0531+21)", kind: "pulsar", scale: 3, size: 0.5, color: "#9aa8ff", distanceLabel: "6.500 anni luce", blurb: "Nel cuore della Nebulosa del Granchio: ruota ~30 volte al secondo.", source: SRC_ATNF, rMin: 10, rMax: 18 },
  { id: "p-vela", name: "Vela Pulsar (PSR B0833-45)", kind: "pulsar", scale: 3, size: 0.45, color: "#a0c8ff", distanceLabel: "959 anni luce", blurb: "Resto di supernova, ~11 rotazioni al secondo.", source: SRC_ATNF, rMin: 10, rMax: 18 },
  { id: "p-first", name: "PSR B1919+21", kind: "pulsar", scale: 3, size: 0.4, color: "#bcd6ff", distanceLabel: "~1.000 anni luce", blurb: "Il primo pulsar scoperto (1967), soprannominato 'LGM-1'.", source: SRC_ATNF, rMin: 10, rMax: 18 },
  { id: "p-closest", name: "PSR J0437-4715", kind: "pulsar", scale: 3, size: 0.42, color: "#c8d8ff", distanceLabel: "512 anni luce", blurb: "Il pulsar millisecondo più vicino: 174 rotazioni al secondo.", source: SRC_ATNF, rMin: 9, rMax: 16 },
  { id: "p-planets", name: "PSR B1257+12", kind: "pulsar", scale: 3, size: 0.4, color: "#b0c0ff", distanceLabel: "2.300 anni luce", blurb: "Attorno ad esso furono scoperti i primi pianeti extrasolari (1992).", source: SRC_ATNF, rMin: 12, rMax: 20 },
];

const QUASARS: Seed[] = [
  { id: "q-3c273", name: "3C 273", kind: "quasar", scale: 5, size: 1.0, color: "#ffd9a0", distanceLabel: "2,4 miliardi anni luce", blurb: "Il primo quasar identificato: il più brillante del cielo.", source: SRC_QSO, rMin: 12, rMax: 22 },
  { id: "q-ton618", name: "TON 618", kind: "quasar", scale: 5, size: 1.4, color: "#ffb060", distanceLabel: "10,4 miliardi anni luce", blurb: "Ospita uno dei buchi neri più massicci noti (~66 miliardi di masse solari).", source: SRC_QSO, rMin: 18, rMax: 30 },
  { id: "q-ulas", name: "ULAS J1342+0928", kind: "quasar", scale: 5, size: 0.9, color: "#ff8f6b", distanceLabel: "13,1 miliardi anni luce", blurb: "Uno dei quasar più lontani: luce emessa 690 milioni di anni dopo il Big Bang.", source: SRC_QSO, rMin: 24, rMax: 32 },
  { id: "q-apm", name: "APM 08279+5255", kind: "quasar", scale: 5, size: 1.1, color: "#ffc890", distanceLabel: "12 miliardi anni luce", blurb: "Quasar iper-luminoso con un enorme serbatoio d'acqua nel gas circostante.", source: SRC_QSO, rMin: 20, rMax: 30 },
];

const PROBES: Seed[] = [
  { id: "s-newhorizons", name: "New Horizons", kind: "spacecraft", scale: 1, size: 0.1, color: "#e6e6e6", distanceLabel: "~8,8 mld km", blurb: "Ha sorvolato Plutone (2015) e Arrokoth (2019); ora nella Fascia di Kuiper.", source: SRC_MISSION, rMin: 46, rMax: 70 },
  { id: "s-parker", name: "Parker Solar Probe", kind: "spacecraft", scale: 1, size: 0.09, color: "#ffd27a", distanceLabel: "sfiora il Sole", blurb: "La sonda più veloce mai costruita: 'tocca' la corona solare.", source: SRC_MISSION, rMin: 6, rMax: 14 },
  { id: "s-jwst", name: "James Webb (JWST)", kind: "spacecraft", scale: 1, size: 0.12, color: "#f0d9a0", distanceLabel: "1,5 mln km (L2)", blurb: "Il più grande telescopio spaziale: osserva l'universo nell'infrarosso.", source: SRC_MISSION, rMin: 11, rMax: 13 },
  { id: "s-voyager2", name: "Voyager 2", kind: "spacecraft", scale: 1, size: 0.1, color: "#dcdcdc", distanceLabel: "~20 mld km", blurb: "L'unica sonda ad aver visitato Urano e Nettuno; nello spazio interstellare.", source: SRC_MISSION, rMin: 46, rMax: 70 },
  { id: "s-juno", name: "Juno", kind: "spacecraft", scale: 1, size: 0.09, color: "#e0d6c0", distanceLabel: "orbita di Giove", blurb: "In orbita attorno a Giove: studia atmosfera e campo magnetico.", source: SRC_MISSION, rMin: 16, rMax: 22 },
];

function seedToObject(s: Seed): UObject {
  const { rMin, rMax, ...rest } = s;
  return { ...rest, pos: scatter(s.id, rMin, rMax), rep: "data-viz" };
}

const CURATED: UObject[] = [...COMETS, ...PULSARS, ...QUASARS, ...PROBES].map(seedToObject);

export type CatKey = "asteroid" | "comet" | "pulsar" | "quasar" | "spacecraft";
export const CATALOG_META: { key: CatKey; label: string; icon: string; scale: UScale }[] = [
  { key: "asteroid", label: "Asteroidi", icon: "planet", scale: 1 },
  { key: "comet", label: "Comete", icon: "sparkles", scale: 1 },
  { key: "spacecraft", label: "Sonde", icon: "rocket", scale: 1 },
  { key: "pulsar", label: "Pulsar", icon: "radio", scale: 3 },
  { key: "quasar", label: "Quasar", icon: "flash", scale: 5 },
];

// All catalog objects for a given scale (asteroids come from the live fetch).
export function catalogForScale(scale: UScale, asteroids: UObject[], enabled: Set<CatKey>): UObject[] {
  const curated = CURATED.filter((o) => o.scale === scale && enabled.has(o.kind as CatKey));
  const ast = scale === 1 && enabled.has("asteroid") ? asteroids : [];
  return [...curated, ...ast];
}

// Search across curated + live asteroids (name match).
export function searchCatalog(q: string, asteroids: UObject[]): UObject[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return [...CURATED, ...asteroids].filter((o) => o.name.toLowerCase().includes(s)).slice(0, 8);
}
