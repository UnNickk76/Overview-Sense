// Go There™ location privacy — the author chooses how precisely a Senshot's
// place is shared. OverView shares a point of view, never someone's private life.
import type { GeoPrecision } from "./backend";

export interface GeoLevel {
  key: GeoPrecision;
  emoji: string;
  label: string;
  desc: string;
}

export const GEO_LEVELS: GeoLevel[] = [
  { key: "none", emoji: "📍", label: "Nessuna posizione", desc: "Il Senshot resta pubblico, ma Go There™ non sarà disponibile." },
  { key: "area", emoji: "🌍", label: "Area ampia", desc: "Mostra solo una zona generica (~5-10 km): “più o meno qui”." },
  { key: "approx", emoji: "📌", label: "Posizione approssimata", desc: "Go There™ porta nelle vicinanze (~100-500 m), non al punto esatto." },
  { key: "exact", emoji: "🎯", label: "Posizione precisa", desc: "Go There™ porta esattamente nel punto dello scatto." },
];

export function geoLevel(key: GeoPrecision | undefined): GeoLevel {
  return GEO_LEVELS.find((l) => l.key === key) ?? GEO_LEVELS[3];
}
