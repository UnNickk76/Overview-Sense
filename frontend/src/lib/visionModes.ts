import { Ionicons } from "@expo/vector-icons";

export type VisionMode = "auto" | "light" | "spectrum" | "detail" | "field" | "reality" | "deep";

export interface ModeInfo {
  key: VisionMode;
  label: string;
  purpose: string;
  icon: keyof typeof Ionicons.glyphMap;
  matrix: number[]; // 4x5 Skia ColorMatrix (identity for reality/field base)
}

const identity = [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0];

// Saturation matrix helper
function sat(s: number): number[] {
  const r = 0.2126, g = 0.7152, b = 0.0722;
  return [
    r*(1-s)+s, g*(1-s),   b*(1-s),   0, 0,
    r*(1-s),   g*(1-s)+s, b*(1-s),   0, 0,
    r*(1-s),   g*(1-s),   b*(1-s)+s, 0, 0,
    0,0,0,1,0,
  ];
}
function contrast(c: number): number[] {
  const t = (1 - c) * 0.5;
  return [c,0,0,0,t, 0,c,0,0,t, 0,0,c,0,t, 0,0,0,1,0];
}

export const MODES: Record<VisionMode, ModeInfo> = {
  auto: { key: "auto", label: "Auto", purpose: "Overview analizza la scena e sceglie la modalità", icon: "sparkles", matrix: identity },
  light: {
    key: "light", label: "Light+", purpose: "Amplificazione della luce: rivela ciò che è troppo buio",
    icon: "sunny", matrix: [1.9,0,0,0,0.06, 0,1.9,0,0,0.06, 0,0,1.9,0,0.06, 0,0,0,1,0],
  },
  spectrum: {
    key: "spectrum", label: "Spectrum", purpose: "Amplificazione cromatica: variazioni di colore impercettibili",
    icon: "color-palette", matrix: sat(2.4),
  },
  detail: {
    key: "detail", label: "Detail", purpose: "Contrasto e dettagli normalmente difficili da percepire",
    icon: "scan", matrix: contrast(1.7),
  },
  field: {
    key: "field", label: "Field", purpose: "Campi fisici e dati ambientali reali sovrapposti",
    icon: "magnet", matrix: [1,0,0,0,0, 0,1.05,0,0,0.02, 0,0,1.15,0,0.04, 0,0,0,1,0],
  },
  reality: {
    key: "reality", label: "Reality", purpose: "Dati astronomici e satellitari reali sovrapposti al cielo",
    icon: "telescope", matrix: [1.25,0,0,0,0, 0,1.25,0,0,0, 0,0,1.4,0,0.02, 0,0,0,1,0],
  },
  deep: {
    key: "deep", label: "Deep", purpose: "Esalta i dettagli deboli oltre ciò che è immediatamente visibile",
    icon: "planet", matrix: [1.6,0,0,0,-0.1, 0,1.5,0,0,-0.05, 0,0,1.9,0,0.05, 0,0,0,1,0],
  },
};

export const MODE_ORDER: VisionMode[] = ["auto", "light", "spectrum", "detail", "field", "reality", "deep"];

// Real heuristic: pick a mode from average luminance & green ratio of the frame.
export function autoPick(avgLum: number, greenRatio: number, topBrightness: number): VisionMode {
  if (avgLum < 0.22) return "light";
  if (greenRatio > 0.42) return "spectrum";
  if (topBrightness > 0.55 && topBrightness > avgLum + 0.12) return "reality";
  if (avgLum < 0.4) return "deep";
  return "detail";
}
