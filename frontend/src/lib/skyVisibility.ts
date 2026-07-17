// Sky Visibility™ + Sense Auto Mode™
// Decides whether the sky is really observable before drawing any astronomical object,
// and picks the most fitting "Sense" for what the camera is looking at.
// Device orientation (pitch) is the fast, offline-authoritative signal; the AI scene
// verdict refines it (walls/ceilings/ground that pitch alone can't tell from open sky).

import { Ionicons } from "@expo/vector-icons";

export type Scene = "sky" | "ground" | "surface" | "water" | "nature" | "person" | "object" | "indoor" | "unknown";
export type SenseModeKey = "sky" | "surface" | "ground" | "bio" | "nature" | "object" | "water" | "thermal" | "energy";

export interface SenseMode {
  key: SenseModeKey;
  emoji: string;
  label: string;     // proprietary English name (kept in EN in both languages)
  icon: keyof typeof Ionicons.glyphMap;
}

export const SENSE_MODES: Record<SenseModeKey, SenseMode> = {
  sky: { key: "sky", emoji: "☁️", label: "Sky Vision", icon: "cloudy-outline" },
  surface: { key: "surface", emoji: "🧱", label: "Surface Sense", icon: "grid-outline" },
  ground: { key: "ground", emoji: "🪨", label: "Ground Sense", icon: "earth-outline" },
  bio: { key: "bio", emoji: "👤", label: "Bio Sense", icon: "body-outline" },
  nature: { key: "nature", emoji: "🌳", label: "Nature Sense", icon: "leaf-outline" },
  object: { key: "object", emoji: "🚗", label: "Object Sense", icon: "cube-outline" },
  water: { key: "water", emoji: "🌊", label: "Water Sense", icon: "water-outline" },
  thermal: { key: "thermal", emoji: "🔥", label: "Thermal Sense", icon: "flame-outline" },
  energy: { key: "energy", emoji: "⚡", label: "Energy Sense", icon: "flash-outline" },
};

export const AUTO_MODES: SenseModeKey[] = ["sky", "surface", "ground", "bio", "nature", "object", "water"];

export function sceneToMode(scene: Scene): SenseModeKey {
  switch (scene) {
    case "sky": return "sky";
    case "surface": return "surface";
    case "ground": return "ground";
    case "person": return "bio";
    case "nature": return "nature";
    case "object": return "object";
    case "water": return "water";
    case "indoor": return "surface";
    default: return "sky";
  }
}

// Pitch → sky visibility. cameraAlt is the camera look-direction elevation in degrees.
// Pointing down at the ground (negative) => no sky. Around/above horizon => sky opens up.
export function pitchVisibility(cameraAlt: number): number {
  if (!Number.isFinite(cameraAlt)) return 50;
  // -15° (looking down) -> 0% ; +25° (looking up) -> 100%
  const v = ((cameraAlt + 15) / 40) * 100;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// Combine the real-time pitch score with an optional AI verdict.
// If the AI clearly sees a non-sky scene, it can veto the sky even if pitch is high (ceiling/wall).
export function combineVisibility(pitch: number, ai: number | null, scene: Scene): number {
  if (ai == null) return pitch;
  if (scene !== "sky" && scene !== "unknown") return Math.min(pitch, ai, 20);
  // trust the lower of the two so obstacles/indoor pull the score down honestly
  return Math.round(Math.min(pitch, Math.max(ai, pitch * 0.5)));
}

export const SKY_THRESHOLD = 35; // below this, astronomical objects are hidden

export function skyBucket(score: number): 0 | 25 | 50 | 75 | 100 {
  if (score < 13) return 0;
  if (score < 38) return 25;
  if (score < 63) return 50;
  if (score < 88) return 75;
  return 100;
}
