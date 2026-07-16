import React from "react";
import { Platform } from "react-native";
import { Image as RNImage } from "expo-image";
import {
  Canvas, Image as SkiaImage, useImage, ColorMatrix,
  Fill, Shader, ImageShader, Skia,
} from "@shopify/react-native-skia";

// Real pixel-processing of a captured Sense. Each transform is an honest remap of
// the ACTUAL photo pixels — no invented data, only light/detail made visible.
const LR = 0.2126, LG = 0.7152, LB = 0.0722;

export type SenseVisualLayer =
  | "Originale" | "Luce" | "Colore" | "Contrasto" | "Luminanza"
  | "Silhouette" | "Dettaglio"
  | "Micro-dettaglio"; // legacy alias for older captures → Silhouette

export const VISUAL_LAYERS: SenseVisualLayer[] = [
  "Originale", "Luce", "Colore", "Contrasto", "Luminanza", "Silhouette", "Dettaglio",
];

// Map a capture-time Sense layer label to the closest visual transform.
export function layerToVisual(label?: string): SenseVisualLayer {
  switch (label) {
    case "Luce": return "Luce";
    case "Colore": return "Colore";
    case "Contrasto": return "Contrasto";
    case "Luminanza": return "Luminanza";
    case "Silhouette": return "Silhouette";
    case "Dettaglio": return "Dettaglio";
    case "Micro-dettaglio": return "Silhouette"; // legacy
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
    case "Silhouette":
    case "Micro-dettaglio": { // high-contrast B/W — isolates shapes/backlit profiles
      const c = 1.9;
      return [LR * c, LG * c, LB * c, 0, -0.45, LR * c, LG * c, LB * c, 0, -0.45, LR * c, LG * c, LB * c, 0, -0.45, 0, 0, 0, 1, 0];
    }
    default: // Originale — identity
      return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  }
}

// Real detail enhancement: unsharp mask + local micro-contrast. Reweights ONLY the
// pixels actually captured — reveals real micro-texture, no super-resolution/invention.
// Built lazily and ONLY on native (accessing Skia.RuntimeEffect on web throws — CanvasKit
// isn't loaded there, and SkiaSense never mounts on web anyway).
const SHARPEN_SRC = `
uniform shader image;
uniform float2 texel;
uniform float amount;
half4 main(float2 xy) {
  half4 c = image.eval(xy);
  half3 n = image.eval(xy + float2(0.0, -texel.y)).rgb + image.eval(xy + float2(0.0, texel.y)).rgb
          + image.eval(xy + float2(-texel.x, 0.0)).rgb + image.eval(xy + float2(texel.x, 0.0)).rgb;
  half3 sharp = c.rgb * (1.0 + 4.0 * amount) - n * amount;
  return half4(clamp(sharp, 0.0, 1.0), c.a);
}`;

let _sharpen: ReturnType<typeof Skia.RuntimeEffect.Make> | null | undefined;
function getSharpen() {
  if (_sharpen !== undefined) return _sharpen;
  try { _sharpen = Skia.RuntimeEffect.Make(SHARPEN_SRC); } catch { _sharpen = null; }
  return _sharpen;
}

interface Props {
  uri: string;
  width: number;
  height: number;
  layer: SenseVisualLayer;
}

function SkiaSense({ uri, width, height, layer }: Props) {
  const image = useImage(uri);
  if (!image) return <RNImage source={{ uri }} style={{ width, height }} contentFit="cover" />;

  // Real "Dettaglio" — spatial sharpening via RuntimeEffect (not a color matrix).
  const sharpen = layer === "Dettaglio" ? getSharpen() : null;
  if (layer === "Dettaglio" && sharpen) {
    const iw = image.width() || width, ih = image.height() || height;
    return (
      <Canvas style={{ width, height }}>
        <Fill>
          <Shader source={sharpen} uniforms={{ texel: [1 / iw, 1 / ih], amount: 0.85 }}>
            <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width, height }} />
          </Shader>
        </Fill>
      </Canvas>
    );
  }

  return (
    <Canvas style={{ width, height }}>
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover">
        <ColorMatrix matrix={matrixFor(layer)} />
      </SkiaImage>
    </Canvas>
  );
}

export function SenseCanvas({ uri, width, height, layer }: Props) {
  // On web (Skia CanvasKit can't fetch cross-origin) or with no transform, use a plain image.
  // useImage is only ever called inside SkiaSense, which never mounts on web.
  if (Platform.OS === "web" || layer === "Originale") {
    return <RNImage source={{ uri }} style={{ width, height }} contentFit="cover" transition={150} />;
  }
  return <SkiaSense uri={uri} width={width} height={height} layer={layer} />;
}
