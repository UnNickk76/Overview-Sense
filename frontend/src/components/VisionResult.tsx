import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Canvas, useCanvasRef, Image as SkiaImage, useImage, ColorMatrix, Text as SkiaText,
  useFont, Rect, ImageFormat,
} from "@shopify/react-native-skia";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { colors, fonts, spacing, type } from "@/src/theme";
import { MODES, VisionMode, autoPick } from "@/src/lib/visionModes";
import { saveImageObservation } from "@/src/lib/gallery";

interface Props {
  uri: string;
  initialMode: VisionMode;
  fieldLines: string[];
  realityLines: string[];
  onClose: () => void;
}

export function VisionResult({ uri, initialMode, fieldLines, realityLines, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const image = useImage(uri);
  const font = useFont(require("@/assets/fonts/GeistMono-Regular.ttf"), 15);
  const ref = useCanvasRef();
  const [effMode, setEffMode] = useState<VisionMode>(initialMode === "auto" ? "detail" : initialMode);
  const [analyzed, setAnalyzed] = useState(initialMode !== "auto");
  const [status, setStatus] = useState<string | null>(null);

  const dims = useMemo(() => {
    if (!image) return { w: width, h: width };
    const ratio = image.height() / image.width();
    const maxH = 560;
    let h = width * ratio;
    if (h > maxH) h = maxH;
    return { w: width, h };
  }, [image, width]);

  // Real scene analysis for Auto mode.
  useEffect(() => {
    if (!image || initialMode !== "auto" || analyzed) return;
    try {
      const px = image.readPixels() as Uint8Array | null;
      if (px && px.length > 16) {
        const total = px.length / 4;
        let lum = 0, green = 0, topLum = 0, topCount = 0, n = 0;
        const stride = Math.max(1, Math.floor(total / 4000));
        const rowW = image.width();
        for (let i = 0; i < total; i += stride) {
          const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
          const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lum += l;
          green += g / (r + g + b + 0.001);
          const row = Math.floor(i / rowW);
          if (row < image.height() * 0.33) { topLum += l; topCount++; }
          n++;
        }
        const avgLum = lum / n, greenRatio = green / n, topB = topCount ? topLum / topCount : avgLum;
        setEffMode(autoPick(avgLum, greenRatio, topB));
      }
    } catch { setEffMode("detail"); }
    setAnalyzed(true);
  }, [image, initialMode, analyzed]);

  const matrix = MODES[effMode].matrix;
  const overlayLines = effMode === "reality" ? realityLines : effMode === "field" ? fieldLines : [];
  const showOverlay = overlayLines.length > 0;

  const snapshotBase64 = async (): Promise<string | null> => {
    const snap = ref.current?.makeImageSnapshot();
    if (!snap) return null;
    return snap.encodeToBase64(ImageFormat.JPEG, 95);
  };

  const saveToPhotos = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("Salvataggio…");
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) { setStatus("Permesso Foto negato"); return; }
    const b64 = await snapshotBase64();
    if (!b64) { setStatus("Errore"); return; }
    const tmp = `${FileSystem.cacheDirectory}overview_${Date.now()}.jpg`;
    await FileSystem.writeAsStringAsync(tmp, b64, { encoding: FileSystem.EncodingType.Base64 });
    await MediaLibrary.saveToLibraryAsync(tmp);
    setStatus("Salvato in Foto ✓");
  };

  const saveToGallery = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("Salvataggio…");
    const b64 = await snapshotBase64();
    if (!b64) { setStatus("Errore"); return; }
    await saveImageObservation(b64, `Visione · ${MODES[effMode].label}`);
    setStatus("Salvato in Osservazioni ✓");
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="vision-close" style={styles.glassBtn} onPress={onClose}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.modeTitle}>{MODES[effMode].label}{initialMode === "auto" ? "  · Auto" : ""}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.canvasWrap}>
        {image ? (
          <Canvas ref={ref} style={{ width: dims.w, height: dims.h }}>
            <SkiaImage image={image} x={0} y={0} width={dims.w} height={dims.h} fit="cover">
              <ColorMatrix matrix={matrix} />
            </SkiaImage>
            {showOverlay && font ? (
              <>
                <Rect x={0} y={0} width={dims.w} height={overlayLines.length * 22 + 20} color="rgba(0,0,0,0.45)" />
                {overlayLines.map((line, i) => (
                  <SkiaText key={i} x={14} y={28 + i * 22} text={line} font={font} color="#D4AF37" />
                ))}
              </>
            ) : null}
          </Canvas>
        ) : (
          <View style={[styles.canvasWrap, { height: 400 }]}><ActivityIndicator color={colors.brand} /></View>
        )}
      </View>

      <Text style={styles.purpose}>{MODES[effMode].purpose}</Text>
      {!analyzed ? <Text style={styles.analyzing}>Analisi automatica della scena…</Text> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable testID="save-photos" style={styles.actionBtn} onPress={saveToPhotos}>
          <Ionicons name="download" size={18} color={colors.onSurface} />
          <Text style={styles.actionText}>Salva in Foto</Text>
        </Pressable>
        <Pressable testID="save-gallery" style={[styles.actionBtn, styles.actionPrimary]} onPress={saveToGallery}>
          <Ionicons name="bookmark" size={18} color={colors.onBrand} />
          <Text style={[styles.actionText, { color: colors.onBrand }]}>Osservazioni</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>
        L&apos;elaborazione agisce sui pixel reali della foto per rendere percepibile ciò che l&apos;occhio fatica a distinguere. Nessun dato è inventato.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", zIndex: 50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  glassBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modeTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  canvasWrap: { alignItems: "center", justifyContent: "center", backgroundColor: "#050608" },
  purpose: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", paddingHorizontal: spacing.xl, marginTop: spacing.lg, lineHeight: 21 },
  analyzing: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, textAlign: "center", marginTop: spacing.sm },
  status: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base, textAlign: "center", marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: 16, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actionPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  actionText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, textAlign: "center", paddingHorizontal: spacing.xl, marginTop: spacing.md, opacity: 0.6 },
});
