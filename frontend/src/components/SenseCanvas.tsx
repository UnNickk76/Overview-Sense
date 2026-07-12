import React from "react";
import { Platform } from "react-native";
import { Image as RNImage } from "expo-image";
import { Canvas, Image as SkiaImage, useImage, ColorMatrix } from "@shopify/react-native-skia";

// Real pixel-processing of a captured Sense. Each matrix is an honest linear
// remap of the ACTUAL photo pixels — no invented data, only light made visible.
const LR = 0.2126, LG = 0.7152, LB = 0.0722;

export type SenseVisualLayer =
  | "Originale" | "Luce" | "Colore" | "Contrasto" | "Luminanza" | "Micro-dettaglio";

export const VISUAL_LAYERS: SenseVisualLayer[] = [
  "Originale", "Luce", "Colore", "Contrasto", "Luminanza", "Micro-dettaglio",
];

// Map a capture-time Sense layer to the closest visual transform.
export function layerToVisual(label?: string): SenseVisualLayer {
  switch (label) {
    case "Luce": return "Luce";
    case "Colore": return "Colore";
    case "Contrasto": return "Contrasto";
    case "Micro-dettaglio": return "Micro-dettaglio";
    default: return "Originale";
  }
}

function matrixFor(layer: SenseVisualLayer): number[] {
  switch (layer) {
    case "Luce": // brightness + gentle contrast lift
      return [1.1, 0, 0, 0, 0.10, 0, 1.1, 0, 0, 0.10, 0, 0, 1.1, 0, 0.10, 0, 0, 0, 1, 0];
    case "Colore": { // saturation amplification (s = 1.8)
      const s = 1.8, is = 1 - s;
      return [
        LR * is + s, LG * is, LB * is, 0, 0,
        LR * is, LG * is + s, LB * is, 0, 0,
        LR * is, LG * is, LB * is + s, 0, 0,
        0, 0, 0, 1, 0,
      ];
    }
    case "Contrasto": { // c = 1.5
      const c = 1.5, o = (1 - c) / 2;
      return [c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0];
    }
    case "Luminanza": // grayscale luminance map
      return [LR, LG, LB, 0, 0, LR, LG, LB, 0, 0, LR, LG, LB, 0, 0, 0, 0, 0, 1, 0];
    case "Micro-dettaglio": { // grayscale + strong contrast to reveal micro-texture
      const c = 1.9;
      return [LR * c, LG * c, LB * c, 0, -0.45, LR * c, LG * c, LB * c, 0, -0.45, LR * c, LG * c, LB * c, 0, -0.45, 0, 0, 0, 1, 0];
    }
    default: // Originale — identity
      return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  }
}

interface Props {
  uri: string;
  width: number;
  height: number;
  layer: SenseVisualLayer;
}

export function SenseCanvas({ uri, width, height, layer }: Props) {
  const image = useImage(uri);

  // Fallback (web / not-yet-loaded / no transform): plain image.
  if (Platform.OS === "web" || !image || layer === "Originale") {
    return <RNImage source={{ uri }} style={{ width, height }} contentFit="cover" />;
  }

  return (
    <Canvas style={{ width, height }}>
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover">
        <ColorMatrix matrix={matrixFor(layer)} />
      </SkiaImage>
    </Canvas>
  );
}
