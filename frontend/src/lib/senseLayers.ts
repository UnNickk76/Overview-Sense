// Sense Vision engine — shared source of truth for the visual Sense Layers.
// These are HONEST linear remaps of the REAL pixels of a photo (no invented data).
// Data-driven layers (Magnetic, Solar, Lunar, Satellite, Audio...) are added per-context
// only when real data is available, and are defined where that data lives.
import type { SenseVisualLayer } from "@/src/components/SenseCanvas";
import type { ObsData } from "@/src/lib/gallery";

export interface SenseLayerMeta {
  key: SenseVisualLayer;
  emoji: string;
  label: string;
  reveals: string; // honest description of WHAT the transform makes visible
}

// Order + intuitive icons. Labels kept short so small buttons stay clean.
export const SENSE_LAYER_META: SenseLayerMeta[] = [
  { key: "Originale", emoji: "⭕", label: "Originale", reveals: "L'immagine reale, senza elaborazione." },
  { key: "Luce", emoji: "☀️", label: "Luce", reveals: "Evidenzia come la luce reale costruisce la scena: zone di luminosità e ombra." },
  { key: "Colore", emoji: "🎨", label: "Colore", reveals: "Amplifica differenze cromatiche realmente presenti ma poco percepibili a occhio." },
  { key: "Micro-dettaglio", emoji: "✨", label: "Dettaglio", reveals: "Esalta micro-texture e dettagli fini realmente contenuti nell'immagine." },
  { key: "Contrasto", emoji: "🌓", label: "Contrasto", reveals: "Aumenta il contrasto per rivelare strutture nascoste tra i toni." },
  { key: "Luminanza", emoji: "🔆", label: "Luminanza", reveals: "Isola la sola luminosità reale, separandola dal colore." },
];

export function layerMeta(key: SenseVisualLayer): SenseLayerMeta {
  return SENSE_LAYER_META.find((m) => m.key === key) ?? SENSE_LAYER_META[0];
}

// ---------------------------------------------------------------------------
// Data-driven Sense Layers — shown ONLY when the real measurement exists.
// Never invented: if the value is null, the layer is hidden.
// ---------------------------------------------------------------------------
export interface DataLayerDef {
  key: string;
  emoji: string;
  label: string;
  reveals: string;
  value: (d: ObsData) => string | null;
}

function compass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
}

export const DATA_LAYERS: DataLayerDef[] = [
  {
    key: "magnetic", emoji: "🧲", label: "Magnetico",
    reveals: "Campo magnetico reale misurato dal magnetometro del dispositivo.",
    value: (d) => (d.magnetic?.magnitude != null ? `${Math.round(d.magnetic.magnitude)} µT` : null),
  },
  {
    key: "solar", emoji: "☀️", label: "Solare",
    reveals: "Posizione reale del Sole e direzione della luce al momento dello scatto.",
    value: (d) => (d.sun ? (d.sun.alt > 0 ? `${Math.round(d.sun.alt)}° · ${compass(d.sun.az)}` : `sotto l'orizzonte · ${compass(d.sun.az)}`) : null),
  },
  {
    key: "lunar", emoji: "🌙", label: "Lunare",
    reveals: "Fase e illuminazione reali della Luna in questo istante.",
    value: (d) => (d.moon ? `${d.moon.phase} · ${Math.round(d.moon.illum * 100)}%` : null),
  },
  {
    key: "satellite", emoji: "🛰", label: "Satelliti",
    reveals: "Satelliti e ISS realmente sopra l'osservatore (dati orbitali).",
    value: (d) => {
      const n = (d.satellites?.length ?? 0) + (d.iss ? 1 : 0);
      return n > 0 ? `${d.iss ? "ISS + " : ""}${d.satellites?.length ?? 0} sat` : null;
    },
  },
  {
    key: "universe", emoji: "🌌", label: "Universo",
    reveals: "Pianeti e costellazioni realmente presenti nella direzione inquadrata.",
    value: (d) => {
      const items = [...(d.planets?.map((p) => p.name) ?? []), ...(d.constellations ?? [])];
      return items.length ? items.slice(0, 3).join(", ") : null;
    },
  },
  {
    key: "air", emoji: "🌬", label: "Atmosfera",
    reveals: "Dati atmosferici reali disponibili (temperatura, pressione).",
    value: (d) => {
      const parts: string[] = [];
      if (d.weather?.temp != null) parts.push(`${Math.round(d.weather.temp)}°C`);
      if (d.weather?.pressure != null) parts.push(`${Math.round(d.weather.pressure)} hPa`);
      return parts.length ? parts.join(" · ") : null;
    },
  },
  {
    key: "spaceweather", emoji: "☄️", label: "Meteo spaziale",
    reveals: "Attività geomagnetica reale (indice Kp) da NOAA SWPC.",
    value: (d) => (d.spaceWeather?.kp != null ? `Kp ${d.spaceWeather.kp.toFixed(1)}${d.spaceWeather.level ? ` · ${d.spaceWeather.level}` : ""}` : null),
  },
  {
    key: "motion", emoji: "🧭", label: "Orientamento",
    reveals: "Direzione ed elevazione reali della fotocamera (bussola + accelerometro).",
    value: (d) => (d.cameraAz != null ? `${compass(d.cameraAz)} ${Math.round(d.cameraAz)}° · elev ${Math.round(d.cameraAlt ?? 0)}°` : null),
  },
  {
    key: "altitude", emoji: "📈", label: "Altitudine",
    reveals: "Quota reale sul livello del mare (GPS del dispositivo).",
    value: (d) => (d.altitude != null ? `${Math.round(d.altitude)} m s.l.m.` : null),
  },
  {
    key: "location", emoji: "📍", label: "Posizione",
    reveals: "Coordinate geografiche reali del luogo dello scatto.",
    value: (d) => (d.lat != null ? `${d.lat.toFixed(2)}°, ${(d.lon ?? 0).toFixed(2)}°` : null),
  },
];

export interface AvailableDataLayer extends DataLayerDef { current: string }

// Subject → recommended layers (deterministic, honest mapping from AI-detected subject).
// Only layers with REAL data actually appear (availableDataLayers filters). The order
// here defines which 2-3 layers are surfaced first on the Sense.
export const SUBJECT_LAYERS: Record<string, { label: string; pixel: SenseVisualLayer[]; data: string[] }> = {
  sky: { label: "Cielo", pixel: ["Luce", "Contrasto"], data: ["universe", "satellite", "spaceweather", "lunar", "solar", "air", "motion"] },
  moon: { label: "Luna", pixel: ["Contrasto", "Micro-dettaglio", "Luminanza"], data: ["lunar", "universe", "motion"] },
  sun: { label: "Sole", pixel: ["Luce", "Contrasto"], data: ["solar", "spaceweather", "air"] },
  person: { label: "Persona", pixel: ["Luce", "Colore", "Micro-dettaglio"], data: ["magnetic", "air", "solar", "lunar", "motion"] },
  animal: { label: "Animale", pixel: ["Colore", "Micro-dettaglio", "Luce"], data: ["motion", "air", "solar"] },
  plant: { label: "Pianta / fiore", pixel: ["Colore", "Micro-dettaglio"], data: ["air", "solar", "location"] },
  vehicle: { label: "Veicolo", pixel: ["Luce", "Colore", "Contrasto"], data: ["motion", "magnetic", "location"] },
  building: { label: "Edificio", pixel: ["Contrasto", "Micro-dettaglio"], data: ["magnetic", "motion", "location"] },
  landscape: { label: "Paesaggio", pixel: ["Luce", "Colore", "Contrasto"], data: ["altitude", "air", "solar", "motion", "location"] },
  mountain: { label: "Montagna", pixel: ["Contrasto", "Luce"], data: ["altitude", "air", "solar", "motion"] },
  forest: { label: "Foresta", pixel: ["Colore", "Micro-dettaglio"], data: ["air", "solar", "location", "altitude"] },
  city: { label: "Città", pixel: ["Contrasto", "Luce", "Colore"], data: ["air", "satellite", "location", "motion"] },
  water: { label: "Mare / acqua", pixel: ["Luce", "Colore"], data: ["lunar", "air", "motion", "location"] },
  object: { label: "Oggetto", pixel: ["Colore", "Micro-dettaglio"], data: ["magnetic", "motion"] },
  generic: { label: "Realtà", pixel: ["Luce", "Colore"], data: ["motion", "air", "location"] },
};

export function recommendedFor(subject: string): { label: string; pixel: SenseVisualLayer[]; data: string[] } {
  return SUBJECT_LAYERS[subject] ?? SUBJECT_LAYERS.generic;
}

export function availableDataLayers(d: ObsData | undefined): AvailableDataLayer[] {
  if (!d) return [];
  const out: AvailableDataLayer[] = [];
  for (const l of DATA_LAYERS) {
    const v = l.value(d);
    if (v) out.push({ ...l, current: v });
  }
  return out;
}

// Available layers ordered by the subject's recommendation (so the first 2-3 shown
// directly on the Sense are the most relevant). Unrecommended-but-available follow.
export function orderedDataLayers(d: ObsData | undefined, recData?: string[]): AvailableDataLayer[] {
  const avail = availableDataLayers(d);
  if (!recData?.length) return avail;
  const byKey = new Map(avail.map((l) => [l.key, l] as const));
  const ordered: AvailableDataLayer[] = [];
  for (const k of recData) { const l = byKey.get(k); if (l) { ordered.push(l); byKey.delete(k); } }
  for (const l of byKey.values()) ordered.push(l);
  return ordered;
}
