import React, { useRef, useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { GLView } from "expo-gl";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { EarthGlobe, EarthCtrl, makeEarthCtrl } from "@/src/components/EarthGlobe";
import { OverviewShortcut } from "@/src/components/OverviewShortcut";
import { SnapshotStudio, SnapshotInput } from "@/src/components/SnapshotStudio";
import { useObserver } from "@/src/hooks/useObserver";
import { colors, fonts, spacing, type } from "@/src/theme";

const RAD_FAR = 4.2, RAD_NEAR = 1.28, HANDOFF = 1.34;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrapLon = (d: number) => { let x = ((d + 180) % 360 + 360) % 360 - 180; return x; };

// Level 1-3 of the unified Explorer. At high zoom it hands off (crossfade) to the
// real NASA GIBS surface — the transition is masked so it feels continuous.
export default function EarthExplorer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const obs = useObserver();
  const ctrl = useRef<EarthCtrl>(makeEarthCtrl());
  const start = useRef({ az: 0, pol: 0, rad: 0 });
  const [altLabel, setAltLabel] = useState("Orbita");
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapInput, setSnapInput] = useState<SnapshotInput | null>(null);
  const fade = useSharedValue(0);
  const handingOff = useRef(false);

  const subPoint = () => ({
    lat: clamp(90 - (ctrl.current.pol * 180) / Math.PI, -85, 85),
    lon: wrapLon((ctrl.current.az * 180) / Math.PI - 90),
  });

  const updateAlt = (rad: number) => {
    const t = (RAD_FAR - rad) / (RAD_FAR - RAD_NEAR);
    setAltLabel(t < 0.25 ? "Orbita" : t < 0.6 ? "Ricostruzione 3D" : t < 0.9 ? "Regione" : "Superficie");
  };

  const goSurface = () => {
    if (handingOff.current) return;
    handingOff.current = true;
    const { lat, lon } = subPoint();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fade.value = withTiming(1, { duration: 380 });
    setTimeout(() => { router.push(`/satellite-explore?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&zoom=4` as never); }, 360);
  };

  // Reset fade when returning to this screen.
  useEffect(() => { const t = setTimeout(() => { fade.value = 0; handingOff.current = false; }, 500); return () => clearTimeout(t); }, [fade]);

  const stopSpin = () => { ctrl.current.idleSpin = false; };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => { stopSpin(); start.current = { az: ctrl.current.az, pol: ctrl.current.pol, rad: ctrl.current.rad }; })
    .onUpdate((e) => {
      const k = 0.004;
      ctrl.current.az = start.current.az - e.translationX * k;
      ctrl.current.pol = clamp(start.current.pol - e.translationY * k, 0.2, Math.PI - 0.2);
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => { stopSpin(); start.current.rad = ctrl.current.rad; })
    .onUpdate((e) => {
      const r = clamp(start.current.rad / e.scale, RAD_NEAR, RAD_FAR);
      ctrl.current.rad = r; updateAlt(r);
      if (r <= HANDOFF) goSurface();
    })
    .onEnd(() => updateAlt(ctrl.current.rad));
  const dtap = Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd(() => {
    stopSpin();
    const r = clamp(ctrl.current.rad * 0.62, RAD_NEAR, RAD_FAR);
    ctrl.current.rad = r; updateAlt(r);
    if (r <= HANDOFF) goSurface();
  });
  const gesture = Gesture.Simultaneous(pan, pinch, dtap);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const captureSnapshot = async () => {
    const r = ctrl.current.renderer as unknown as { domElement?: HTMLCanvasElement; getContext?: () => unknown };
    if (!r) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      let uri = ""; let base64: string | undefined;
      if (Platform.OS === "web" && r.domElement) { uri = r.domElement.toDataURL("image/png"); base64 = uri.split(",")[1]; }
      else if (r.getContext) {
        const snap = await GLView.takeSnapshotAsync(r.getContext() as never, { format: "png" });
        uri = typeof snap.uri === "string" ? snap.uri : "";
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      if (!uri) return;
      const { lat, lon } = subPoint();
      setSnapInput({
        uri, base64,
        title: "Terra · Ricostruzione scientifica",
        layerName: `Terra · ${altLabel}`,
        source: "OverView · ricostruzione (NASA Blue Marble / Solar System Scope, CC BY)",
        hashtags: ["Earth", "Terra", "SatelliteObservation", "Ricostruzione"],
        dataLines: [
          { icon: "🌍", label: `Punto sub-satellite ${lat.toFixed(1)}°, ${lon.toFixed(1)}°` },
          { icon: "🛰️", label: `Livello · ${altLabel} (ricostruzione)` },
        ],
        socialSource: "reality",
        snapKind: "earth",
        data: {
          from: "earth-explorer", lat, lon,
          viewpoint: { target: "earth-explorer", az: Number(ctrl.current.az.toFixed(3)), pol: Number(ctrl.current.pol.toFixed(3)), rad: Number(ctrl.current.rad.toFixed(2)) },
        },
      });
      setSnapOpen(true);
    } catch { /* ignore */ }
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <EarthGlobe ctrl={ctrl} />
        </View>
      </GestureDetector>

      {/* Crossfade veil used when handing off to real satellite imagery */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#02040a" }, fadeStyle]} />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Pressable testID="earth-back" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.titlePill}>
          <Ionicons name="earth" size={13} color={colors.brand} />
          <Text style={styles.titleText}>SATELLITE OBSERVATION · {altLabel.toUpperCase()}</Text>
        </View>
        <OverviewShortcut size={26} />
      </View>

      <View style={[styles.hint, { top: insets.top + 52 }]} pointerEvents="none">
        <Text style={styles.hintText}>Trascina per ruotare · pizzica per avvicinarti · zoom alto → immagini reali</Text>
      </View>

      <Pressable testID="earth-real" style={[styles.realBtn, { bottom: insets.bottom + 92 }]} onPress={goSurface}>
        <Ionicons name="scan" size={16} color="#fff" />
        <Text style={styles.realText}>Immagini satellitari reali</Text>
      </Pressable>

      <Pressable testID="earth-senshot" style={[styles.senshotBtn, { bottom: insets.bottom + 24 }]} onPress={captureSnapshot}>
        <Ionicons name="camera" size={20} color={colors.onBrand} />
        <Text style={styles.senshotText}>SENSHOT</Text>
      </Pressable>

      <SnapshotStudio visible={snapOpen} input={snapInput} onClose={() => setSnapOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#02040a" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,16,26,0.6)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  titlePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,16,26,0.6)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  titleText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 0.8 },
  hint: { position: "absolute", left: spacing.xl, right: spacing.xl, alignItems: "center" },
  hintText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, textAlign: "center", opacity: 0.8 },
  realBtn: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,16,26,0.7)", borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  realText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm },
  senshotBtn: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  senshotText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 1.5 },
});
