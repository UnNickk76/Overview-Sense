// Sense Vision engine — shared source of truth for the visual Sense Layers.
// These are HONEST linear remaps of the REAL pixels of a photo (no invented data).
// Data-driven layers (Magnetic, Solar, Lunar, Satellite, Audio...) are added per-context
// only when real data is available, and are defined where that data lives.
import type { SenseVisualLayer } from "@/src/components/SenseCanvas";

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
