import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Reanimated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Camera, useCameraDevice, useCameraFormat, PhotoFile } from "react-native-vision-camera";
import { Skia, ImageFormat } from "@shopify/react-native-skia";
import Svg, { Path, Line } from "react-native-svg";
import { SenseRadar } from "@/src/components/SenseRadar";
import { colors, fonts, spacing, type } from "@/src/theme";

// iPhone-style "half-moon" zoom dial (decorative arc + live readout).
function ZoomCrescent({ label }: { label: string }) {
  const W = 300, H = 66;
  const p0 = { x: 16, y: 16 }, p1 = { x: W / 2, y: H - 6 }, p2 = { x: W - 16, y: 16 };
  const N = 18;
  const ticks: { x1: number; y1: number; x2: number; y2: number; major: boolean; mid: boolean }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    const dx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mid = i === N / 2;
    const major = i % 3 === 0;
    const L = mid ? 14 : major ? 10 : 6;
    ticks.push({ x1: x, y1: y, x2: x + nx * L, y2: y + ny * L, major, mid });
  }
  return (
    <View style={styles.crescentWrap}>
      <View style={styles.crescentLabel}><Text style={styles.crescentLabelText}>{label}</Text></View>
      <Svg width={W} height={H + 16}>
        <Path d={`M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} fill="none" />
        {ticks.map((tk, i) => (
          <Line key={i} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
            stroke={tk.mid ? colors.brand : tk.major ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)"}
            strokeWidth={tk.mid ? 2.5 : 1.5} strokeLinecap="round" />
        ))}
      </Svg>
    </View>
  );
}

const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);
Reanimated.addWhitelistedNativeProps({ zoom: true, exposure: true });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MAX_EDGE = 2600; // supersample from full-res capture → real detail, manageable size

export interface CameraProHandle {
  capture: () => Promise<{ uri: string; base64?: string } | null>;
}

// Real, non-inventive enhancement: unsharp mask + local contrast, exported by
// downscaling from the full-resolution capture (supersampling = genuine detail).
const SHARPEN = `
uniform shader image;
uniform float2 texel;
uniform float amount;
half4 main(float2 xy) {
  half4 c = image.eval(xy);
  half4 n = image.eval(xy + float2(0.0, -texel.y)) + image.eval(xy + float2(0.0, texel.y))
          + image.eval(xy + float2(-texel.x, 0.0)) + image.eval(xy + float2(texel.x, 0.0));
  half3 sharp = c.rgb * (1.0 + 4.0 * amount) - n.rgb * amount;
  return half4(clamp(sharp, 0.0, 1.0), c.a);
}`;

async function enhanceImage(path: string): Promise<string> {
  try {
    const b64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    const data = Skia.Data.fromBase64(b64);
    const img = Skia.Image.MakeImageFromEncoded(data);
    if (!img) return "file://" + path;
    const iw = img.width(), ih = img.height();
    const scale = Math.min(1, MAX_EDGE / Math.max(iw, ih));
    const W = Math.max(1, Math.round(iw * scale)), H = Math.max(1, Math.round(ih * scale));
    const surface = Skia.Surface.MakeOffscreen(W, H);
    if (!surface) return "file://" + path;
    const canvas = surface.getCanvas();
    const effect = Skia.RuntimeEffect.Make(SHARPEN);
    const paint = Skia.Paint();
    // Gentle local contrast (real, content-preserving).
    const cf = Skia.ColorFilter.MakeMatrix([
      1.08, 0, 0, 0, -0.03,
      0, 1.08, 0, 0, -0.03,
      0, 0, 1.08, 0, -0.03,
      0, 0, 0, 1, 0,
    ]);
    paint.setColorFilter(cf);
    if (effect) {
      const imgShader = img.makeShaderOptions(0, 0, 1, 1, Skia.Matrix().scale(scale, scale));
      const shader = effect.makeShaderWithChildren([1 / iw, 1 / ih, 0.6], [imgShader]);
      paint.setShader(shader);
      canvas.drawRect(Skia.XYWHRect(0, 0, W, H), paint);
    } else {
      canvas.drawImageRect(img, Skia.XYWHRect(0, 0, iw, ih), Skia.XYWHRect(0, 0, W, H), paint);
    }
    const snap = surface.makeImageSnapshot();
    const out = snap.encodeToBase64(ImageFormat.JPEG, 94);
    const outPath = FileSystem.cacheDirectory + "sense_" + Date.now() + ".jpg";
    await FileSystem.writeAsStringAsync(outPath, out, { encoding: FileSystem.EncodingType.Base64 });
    return outPath;
  } catch {
    return "file://" + path;
  }
}

export const CameraPro = forwardRef<CameraProHandle, { enhance?: boolean; hudBottom?: number }>(({ enhance = true, hudBottom = 150 }, ref) => {
  // Full physical optical range: ultra-wide → wide → tele. The virtual multi-cam
  // device auto-switches lenses for the widest field of view and Super Macro on
  // supported iPhones (Beyond View: only real optics, never fabricated detail).
  const multiDevice = useCameraDevice("back", {
    physicalDevices: ["ultra-wide-angle-camera", "wide-angle-camera", "telephoto-camera"],
  });
  const singleDevice = useCameraDevice("back");
  const device = multiDevice ?? singleDevice;
  const format = useCameraFormat(device, [{ photoResolution: "max" }]);
  const supportsHdr = !!format?.supportsPhotoHdr;
  const supportsLowLight = !!device?.supportsLowLightBoost;
  const cam = useRef<Camera>(null);
  const [hasPerm, setHasPerm] = useState(false);
  const [lock, setLock] = useState(false);
  const [focusPt, setFocusPt] = useState<{ x: number; y: number } | null>(null);
  const [zoomLabel, setZoomLabel] = useState("1.0×");
  const [zoomFactor, setZoomFactor] = useState(1);
  const [macro, setMacro] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);

  const minZoom = device?.minZoom ?? 1;
  // Full REAL optical+digital range of the device (e.g. up to ~123.8× on Pro tele).
  // Beyond View: we never fabricate detail, but we expose the sensor's real reach.
  const maxZoom = device?.maxZoom ?? 10;
  const neutral = device?.neutralZoom ?? 1;
  const zoom = useSharedValue(neutral);
  const startZoom = useSharedValue(neutral);
  const focusOpacity = useSharedValue(0);
  const lastZoomRef = useRef(neutral);

  const isMacro = useCallback(
    (z: number) => z <= minZoom + 0.02 && minZoom < neutral - 0.03,
    [minZoom, neutral],
  );

  // Quick zoom presets built from the device's REAL lenses; labels are honest
  // magnifications relative to the 1× wide lens.
  const presets = useMemo(() => {
    const arr: { label: string; z: number }[] = [];
    if (minZoom < neutral - 0.03) {
      const f = minZoom / neutral;
      arr.push({ label: `${f < 1 ? f.toFixed(1) : f.toFixed(0)}×`, z: minZoom });
    }
    arr.push({ label: "1×", z: neutral });
    [2, 5, 10, 25].forEach((f) => { if (neutral * f <= maxZoom - 0.01) arr.push({ label: `${f}×`, z: neutral * f }); });
    // Always offer the device's TRUE maximum as a one-tap stop.
    const maxDisp = maxZoom / neutral;
    const lastF = arr.length ? parseFloat(arr[arr.length - 1].label) : 1;
    if (maxDisp - lastF > 2) arr.push({ label: `${maxDisp.toFixed(maxDisp < 10 ? 1 : 0)}×`, z: maxZoom });
    return arr;
  }, [minZoom, neutral, maxZoom]);

  useEffect(() => {
    (async () => {
      const status = await Camera.getCameraPermissionStatus();
      if (status === "granted") setHasPerm(true);
      else { const r = await Camera.requestCameraPermission(); setHasPerm(r === "granted"); }
    })();
  }, []);

  const showZoom = useCallback((z: number) => {
    setZoomLabel(`${(z / neutral).toFixed(1)}×`);
    setZoomFactor(z / neutral);
    // Large lens/zoom change → drop the stale focus point so continuous AF/AE resumes.
    if (Math.abs(z - lastZoomRef.current) > neutral * 0.5) {
      lastZoomRef.current = z;
      setFocusPt(null);
    }
    setMacro(isMacro(z));
  }, [neutral, isMacro]);

  const setPreset = useCallback((z: number) => {
    Haptics.selectionAsync();
    zoom.value = withTiming(z, { duration: 220 });
    lastZoomRef.current = z;
    setZoomLabel(`${(z / neutral).toFixed(1)}×`);
    setZoomFactor(z / neutral);
    setFocusPt(null);
    setMacro(isMacro(z));
  }, [zoom, neutral, isMacro]);

  const doFocus = useCallback((x: number, y: number) => {
    if (lock) return;
    // Tap = auto-focus AND auto-expose at this point (recovers a dark scene after zoom).
    try { cam.current?.focus({ x, y }); } catch { /* ignore */ }
    Haptics.selectionAsync();
    setFocusPt({ x, y });
    focusOpacity.value = withTiming(1, { duration: 120 });
    focusOpacity.value = withTiming(0, { duration: 900 });
  }, [lock, focusOpacity]);

  const toggleLock = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLock((l) => !l);
  }, []);

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => { startZoom.value = zoom.value; })
    .onUpdate((e) => { const z = clamp(startZoom.value * e.scale, minZoom, maxZoom); zoom.value = z; showZoom(z); });
  const tap = Gesture.Tap().runOnJS(true).onEnd((e) => doFocus(e.x, e.y));
  const longPress = Gesture.LongPress().runOnJS(true).minDuration(450).onStart(() => toggleLock());
  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(longPress, tap));

  // iPhone-style dial: slide left/right on the preset row → smooth decimal zoom.
  const wheelPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-10, 10])
    .onBegin(() => { startZoom.value = zoom.value; setWheelOpen(true); Haptics.selectionAsync(); })
    .onUpdate((e) => {
      const dispStart = startZoom.value / neutral;
      const dispNew = clamp(dispStart * Math.pow(1.35, e.translationX / 45), minZoom / neutral, maxZoom / neutral);
      const z = clamp(dispNew * neutral, minZoom, maxZoom);
      zoom.value = z;
      showZoom(z);
    })
    .onEnd(() => setWheelOpen(false))
    .onFinalize(() => setWheelOpen(false));

  // Exposure is left on continuous AUTO (exposure bias 0) so the scene never gets
  // stuck dark after a zoom/lens change. Locking freezes AF/AE at the current point.
  const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value }));
  const focusStyle = useAnimatedStyle(() => ({ opacity: focusOpacity.value }));

  useImperativeHandle(ref, () => ({
    capture: async () => {
      if (!cam.current) return null;
      try {
        const photo: PhotoFile = await cam.current.takePhoto({ flash: "off", enableShutterSound: false });
        const raw = photo.path;
        const finalUri = enhance ? await enhanceImage(raw) : "file://" + raw;
        let base64: string | undefined;
        try { base64 = await FileSystem.readAsStringAsync(finalUri.replace("file://", ""), { encoding: FileSystem.EncodingType.Base64 }); } catch { /* ignore */ }
        return { uri: finalUri, base64 };
      } catch { return null; }
    },
  }), [enhance]);

  if (!device) {
    return <View style={styles.fallback}><Text style={styles.fallbackText}>Fotocamera non disponibile</Text></View>;
  }
  if (!hasPerm) {
    return <View style={styles.fallback}><Text style={styles.fallbackText}>Permesso fotocamera richiesto</Text></View>;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill}>
        <ReanimatedCamera
          ref={cam}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive
          photo
          photoQualityBalance="quality"
          photoHdr={supportsHdr}
          lowLightBoost={supportsLowLight}
          enableZoomGesture={false}
          animatedProps={animatedProps}
        />
        {focusPt ? (
          <Reanimated.View pointerEvents="none" style={[styles.focusRing, { left: focusPt.x - 34, top: focusPt.y - 34 }, focusStyle]} />
        ) : null}
        {zoomFactor > 20 ? (
          <View pointerEvents="none" style={styles.radarPos}>
            <SenseRadar zoom={zoomFactor} />
          </View>
        ) : null}
        <View pointerEvents="box-none" style={[styles.hud, { bottom: hudBottom }]}>
          <GestureDetector gesture={wheelPan}>
            <View style={styles.presetZone}>
              {wheelOpen ? (
                <ZoomCrescent label={zoomLabel} />
              ) : (
                <View style={styles.presetRow}>
                  {presets.map((p) => {
                    const active = zoomLabel === `${(p.z / neutral).toFixed(1)}×`;
                    return (
                      <Pressable key={p.label} testID={`zoom-${p.label}`} onPress={() => setPreset(p.z)}
                        style={[styles.presetPill, active && styles.presetOn]}>
                        <Text style={[styles.presetText, active && { color: colors.onBrand }]}>{p.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </GestureDetector>
          <View style={styles.hudRow}>
            <View style={styles.zoomPill}><Text style={styles.zoomText}>{zoomLabel}</Text></View>
            {macro ? (
              <View style={styles.macroPill}>
                <Ionicons name="leaf" size={12} color={colors.onBrand} />
                <Text style={styles.macroText}>MACRO</Text>
              </View>
            ) : null}
            <Pressable testID="camerapro-lock" style={[styles.lockBtn, lock && styles.lockOn]} onPress={toggleLock}>
              <Ionicons name={lock ? "lock-closed" : "lock-open"} size={15} color={lock ? colors.onBrand : "#fff"} />
              <Text style={[styles.lockText, lock && { color: colors.onBrand }]}>AF/AE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
});

CameraPro.displayName = "CameraPro";

const styles = StyleSheet.create({
  fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  fallbackText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.base },
  focusRing: { position: "absolute", width: 68, height: 68, borderRadius: 12, borderWidth: 1.5, borderColor: colors.brand },
  radarPos: { position: "absolute", top: 70, right: spacing.lg },
  hud: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: spacing.sm },
  presetZone: { minHeight: 74, alignItems: "center", justifyContent: "center" },
  presetRow: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 999, padding: 4 },
  presetPill: { minWidth: 34, alignItems: "center", justifyContent: "center", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  presetOn: { backgroundColor: colors.brand },
  presetText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1 },
  crescentWrap: { alignItems: "center", justifyContent: "flex-end", height: 74 },
  crescentLabel: { position: "absolute", top: 0, alignSelf: "center", backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, zIndex: 2 },
  crescentLabelText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 0.5 },
  hudRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  macroPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  macroText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.5 },
  zoomPill: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  zoomText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm },
  lockBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.3)" },
  lockOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  lockText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.5 },
});
