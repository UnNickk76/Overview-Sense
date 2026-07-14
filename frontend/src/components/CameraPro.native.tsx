import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Reanimated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Camera, useCameraDevice, useCameraFormat, PhotoFile } from "react-native-vision-camera";
import { Skia, ImageFormat } from "@shopify/react-native-skia";
import { SenseRadar } from "@/src/components/SenseRadar";
import { colors, fonts, spacing, type } from "@/src/theme";

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

export const CameraPro = forwardRef<CameraProHandle, { enhance?: boolean }>(({ enhance = true }, ref) => {
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

  const minZoom = device?.minZoom ?? 1;
  const maxZoom = Math.min(device?.maxZoom ?? 10, 32);
  const neutral = device?.neutralZoom ?? 1;
  const zoom = useSharedValue(neutral);
  const startZoom = useSharedValue(neutral);
  const exposure = useSharedValue(0);
  const startExp = useSharedValue(0);
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
    [2, 3, 5].forEach((f) => { if (neutral * f <= maxZoom + 0.01) arr.push({ label: `${f}×`, z: neutral * f }); });
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
  // Vertical drag anywhere = exposure compensation.
  const expPan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-12, 12])
    .onBegin(() => { startExp.value = exposure.value; })
    .onUpdate((e) => {
      if (!device) return;
      const span = (device.maxExposure - device.minExposure) || 2;
      const v = clamp(startExp.value - (e.translationY / 260) * span, device.minExposure, device.maxExposure);
      if (!lock) exposure.value = v;
    });
  const gesture = Gesture.Simultaneous(pinch, expPan, Gesture.Exclusive(longPress, tap));

  const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value, exposure: exposure.value }));
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
        <View pointerEvents="box-none" style={styles.hud}>
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
  hud: { position: "absolute", left: 0, right: 0, bottom: 150, alignItems: "center", gap: spacing.sm },
  presetRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 999, padding: 4 },
  presetPill: { minWidth: 40, alignItems: "center", justifyContent: "center", borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  presetOn: { backgroundColor: colors.brand },
  presetText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1 },
  hudRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  macroPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  macroText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.5 },
  zoomPill: { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  zoomText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm },
  lockBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.3)" },
  lockOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  lockText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.5 },
});
