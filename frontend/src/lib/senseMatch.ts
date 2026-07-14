// Sense Match™ — pairs a Senshot / scene with a fitting soundtrack.
// STRICTLY royalty-free / CC only:
//  • NASA Voyager space sounds → Public Domain (sonification of real data)
//  • "Calm Pills" ambient      → CC0 (public domain dedication)
// Loops are bundled locally (offline, no attribution required).

export interface SenseTrack {
  id: string;
  title: string;
  artist: string;
  license: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  src: any;          // require()'d local asset
  keys: string[];    // keywords used to match a scene
}

export const SENSE_TRACKS: SenseTrack[] = [
  {
    id: "cosmos", title: "Giove · Voyager", artist: "NASA", license: "Pubblico dominio · NASA Voyager",
    src: require("@/assets/audio/cosmos.mp3"),
    keys: ["universe", "cosmos", "cosmic", "pianeta", "planet", "universe-explorer", "sistema solare", "solar system", "giove", "jupiter"],
  },
  {
    id: "deepfield", title: "Anelli di Urano · Voyager", artist: "NASA", license: "Pubblico dominio · NASA Voyager",
    src: require("@/assets/audio/deepfield.mp3"),
    keys: ["nebula", "nebulosa", "galassia", "galaxy", "deep", "profondo", "cosmic-object", "stella", "star"],
  },
  {
    id: "rings", title: "Anelli di Saturno · Voyager", artist: "NASA", license: "Pubblico dominio · NASA Voyager",
    src: require("@/assets/audio/rings.mp3"),
    keys: ["satellite", "terra", "earth", "satellite-explore", "gibs", "orbita", "saturn"],
  },
  {
    id: "magnetic", title: "Nettuno · Voyager", artist: "NASA", license: "Pubblico dominio · NASA Voyager",
    src: require("@/assets/audio/magnetic.mp3"),
    keys: ["magnetic", "magnetico", "invisibile", "invisible-3d", "campo", "aurora", "solar", "sole", "meteo", "kp", "gravità"],
  },
  {
    id: "calm", title: "The Healing Lake · Calm Pills", artist: "Uplifting Pills", license: "CC0 · pubblico dominio",
    src: require("@/assets/audio/calm.mp3"),
    keys: ["sense-vision", "natura", "ambiente", "terrestre", "luce", "colore", "default"],
  },
  {
    id: "meditation", title: "Tone Poetry · Calm Pills", artist: "Uplifting Pills", license: "CC0 · pubblico dominio",
    src: require("@/assets/audio/meditation.mp3"),
    keys: ["cielo", "sky", "luna", "moon", "notte", "night", "stelle", "timeline", "contemplazione"],
  },
];

export function matchTrack(hint: string | undefined | null): SenseTrack {
  const h = (hint ?? "").toLowerCase();
  if (h) for (const t of SENSE_TRACKS) if (t.keys.some((k) => h.includes(k))) return t;
  return SENSE_TRACKS.find((t) => t.id === "calm")!;
}

export function trackById(id?: string | null): SenseTrack | undefined {
  return id ? SENSE_TRACKS.find((t) => t.id === id) : undefined;
}
