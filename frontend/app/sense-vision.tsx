import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, Linking, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCameraPermissions } from "expo-camera";
import { CameraPro, CameraProHandle } from "@/src/components/CameraPro";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, FadeIn, FadeOut,
} from "react-native-reanimated";
import Svg, { Circle, Line, G, Defs, RadialGradient, Stop } from "react-native-svg";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer, useMagnetometer } from "@/src/hooks/useSensors";
import { compassPoint, nf } from "@/src/lib/format";
import { api, Weather, SpaceWeather } from "@/src/lib/api";
import { loadSatrecs, computeSatellites, SatPos } from "@/src/lib/satellites";
import { buildObservation } from "@/src/lib/observationData";
import { saveObservation } from "@/src/lib/gallery";
import type { ObsData } from "@/src/lib/gallery";
import { SenseMark } from "@/src/components/SenseMark";
import { OverviewShortcut } from "@/src/components/OverviewShortcut";

// The "Invisible Fields" engine, presented to the user as Sense Layers.
type Layer = { key: string; label: string; tint: string; color: string };
const SENSE_LAYERS: Layer[] = [
  { key: "environment", label: "Ambiente", tint: "rgba(212,175,55,0.10)", color: colors.brand },
  { key: "light", label: "Luce", tint: "rgba(255,255,255,0.14)", color: "#FFFFFF" },
  { key: "color", label: "Colore", tint: "rgba(90,176,255,0.14)", color: colors.blue },
  { key: "contrast", label: "Contrasto", tint: "rgba(0,0,0,0.28)", color: "#8FD0FF" },
  { key: "detail", label: "Micro-dettaglio", tint: "rgba(0,0,0,0.15)", color: "#8FD0FF" },
  { key: "magnetic", label: "Campo magnetico", tint: "rgba(212,175,55,0.16)", color: colors.brand },
  { key: "solar", label: "Sole & UV", tint: "rgba(255,159,10,0.16)", color: "#FF9F0A" },
];

export default function SenseVision() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const obs = useObserver();
  const now = useNow(1000);
  const heading = useHeading(perm?.granted === true, 150);
  const accel = useAccelerometer(perm?.granted === true, 200);
  const mag = useMagnetometer(perm?.granted === true, 200);
  const cameraRef = useRef<CameraProHandle>(null);
  const [layerIdx, setLayerIdx] = useState(0);
  const [enhance, setEnhance] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"init" | "scan" | "ready">("init");
  const [created, setCreated] = useState(false);
  const [review, setReview] = useState<{ uri: string; data: ObsData } | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const satsReady = useRef(false);
  const layer = SENSE_LAYERS[layerIdx];

  useEffect(() => {
    api.satellites().then((r) => { if (r.available) { loadSatrecs(r.satellites); satsReady.current = true; } }).catch(() => {});
    api.spaceWeather().then(setSpace).catch(() => {});
  }, []);
  useEffect(() => {
    if (obs.status === "granted") api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  // Sense Vision boot animation
  useEffect(() => {
    if (perm?.granted !== true) return;
    setStage("init");
    const t1 = setTimeout(() => setStage("scan"), 950);
    const t2 = setTimeout(() => setStage("ready"), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [perm?.granted]);

  const cameraAlt = useMemo(
    () => -Math.atan2(accel.z, Math.hypot(accel.x, accel.y)) * (180 / Math.PI),
    [accel.x, accel.y, accel.z],
  );

  const sats = useMemo<SatPos[]>(() => {
    if (obs.status !== "granted" || !satsReady.current) return [];
    return computeSatellites(now, obs.lat, obs.lon, (obs.altitude ?? 0) / 1000);
  }, [now, obs.lat, obs.lon, obs.status, obs.altitude]);

  const fieldIntensity = Math.min(1, mag.magnitude / 80);
  const layerColor = layer.key === "solar" ? "#FF9F0A" : layer.color === "#FFFFFF" ? colors.brand : layer.color;

  const rot = useSharedValue(0);
  const pulse = useSharedValue(1);
  const scanY = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
    scanY.value = withRepeat(withSequence(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
  }, [rot, pulse, scanY]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value + heading}deg` }, { scale: pulse.value }] }));
  const scanStyle = useAnimatedStyle(() => ({ top: `${10 + scanY.value * 78}%` }));

  const vizSize = Math.min(width, height) * 0.85;
  const cx = vizSize / 2;
  const rays = 12;

  const makeSense = async () => {
    if (busy || stage !== "ready") return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.capture();
      if (photo?.uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        let data: ObsData;
        if (obs.status === "granted") {
          data = buildObservation(now, obs.lat, obs.lon, obs.altitude, heading, cameraAlt, sats, weather, space);
        } else {
          data = {
            ts: now.getTime(), cameraAz: heading, cameraAlt,
            spaceWeather: space?.kp_index?.available
              ? { kp: space.kp_index.value ?? undefined, level: space.kp_index.level ?? undefined, solarWind: space.solar_wind?.speed_kms }
              : undefined,
          };
        }
        data.senseLayer = layer.label;
        data.magnetic = { magnitude: mag.magnitude };
        // Viewpoint origin: enables the universal "Go There" (enter this place from above).
        data.from = "sense-vision";
        // Show a review step — the user decides to keep or discard (nothing saved yet).
        setReview({ uri: photo.uri, data });
      }
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  // Discard the captured photo and return to the live camera (nothing is saved).
  const discardSense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReview(null);
  };

  // GO INSIDE — leave the "Look Up" camera and explore this exact place from above (satellite).
  const goInside = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (obs.status === "granted") {
      router.push(`/satellite-explore?lat=${obs.lat}&lon=${obs.lon}&zoom=6` as never);
    } else {
      router.push("/satellite-explore" as never);
    }
  };

  // Save the reviewed Sense to the local gallery, then open it to enhance / publish.
  const saveSense = async () => {
    if (!review || busy) return;
    setBusy(true);
    try {
      const saved = await saveObservation(review.uri, review.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReview(null);
      setCreated(true);
      setTimeout(() => router.replace(`/observation?id=${saved.id}` as never), 750);
    } catch { setBusy(false); }
  };

  if (!perm) return <SpaceBackground><ScreenHeader title="Sense Vision" /></SpaceBackground>;

  if (!perm.granted) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Sense Vision™" />
        <View style={styles.permCenter}>
          <SenseMark size={64} />
          <Text style={styles.permTitle}>Make a Sense</Text>
          <Text style={styles.permText}>Inquadra qualsiasi cosa — un fiore, la tua mano, un&apos;auto, il cielo. Sense Vision rivela ciò che l&apos;occhio non vede usando i dati reali dei sensori e delle fonti scientifiche. Nessun dato inventato.</Text>
          <Text style={styles.permSlogan}>&ldquo;You don&apos;t take a photo. You make a Sense.&rdquo;</Text>
          {perm.canAskAgain ? (
            <Pressable testID="grant-camera-sense" style={styles.cta} onPress={() => requestPerm()}>
              <Text style={styles.ctaText}>Attiva Sense Vision</Text>
            </Pressable>
          ) : (
            <Pressable testID="open-settings-sense" style={styles.cta} onPress={() => Linking.openSettings()}>
              <Text style={styles.ctaText}>Apri Impostazioni</Text>
            </Pressable>
          )}
        </View>
      </SpaceBackground>
    );
  }

  return (
    <View style={styles.root}>
      <CameraPro ref={cameraRef} enhance={enhance} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: layer.tint }]} pointerEvents="none" />

      {/* Real-data Sense visualization overlay (Invisible Fields engine) */}
      <View style={[StyleSheet.absoluteFill, styles.vizCenter]} pointerEvents="none">
        <Animated.View style={[{ width: vizSize, height: vizSize }, ringStyle]}>
          <Svg width={vizSize} height={vizSize}>
            <Defs>
              <RadialGradient id="score" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={layerColor} stopOpacity={0.28 + fieldIntensity * 0.3} />
                <Stop offset="100%" stopColor={layerColor} stopOpacity={0.02} />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cx} r={cx * (0.5 + fieldIntensity * 0.35)} fill="url(#score)" />
            {[0.9, 0.7, 0.5].map((k, i) => (
              <Circle key={i} cx={cx} cy={cx} r={cx * k} stroke={layerColor} strokeWidth={1} opacity={0.2 + fieldIntensity * 0.2} fill="none" />
            ))}
            <G>
              {Array.from({ length: rays }).map((_, i) => {
                const a = (i / rays) * Math.PI * 2;
                return (
                  <Line key={i} x1={cx + Math.cos(a) * cx * 0.35} y1={cx + Math.sin(a) * cx * 0.35}
                    x2={cx + Math.cos(a) * cx * (0.55 + fieldIntensity * 0.35)} y2={cx + Math.sin(a) * cx * (0.55 + fieldIntensity * 0.35)}
                    stroke={layerColor} strokeWidth={1} opacity={0.25} />
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      </View>

      {/* Boot animation */}
      {stage !== "ready" ? (
        <Animated.View exiting={FadeOut.duration(400)} style={styles.bootOverlay} pointerEvents="none">
          <Animated.View style={[styles.scanLine, scanStyle]} />
          <View style={styles.bootCenter}>
            <SenseMark size={48} active />
            <Text style={styles.bootText}>
              {stage === "init" ? "Initializing Sense Vision…" : "Looking beyond human perception…"}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* Sense Created flash */}
      {created ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.createdOverlay} pointerEvents="none">
          <SenseMark size={64} active />
          <Text style={styles.createdText}>Sense Created</Text>
        </Animated.View>
      ) : null}

      {/* Top HUD */}
      <View style={[styles.floatHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="sense-back" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.hudPill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.hudText}>SENSE VISION™</Text>
        </View>
        <View style={styles.hudRight}>
          <OverviewShortcut size={26} />
          <Pressable testID="sense-gallery" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/observations" as never); }}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="images-outline" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Real-enhancement toggle — "observe better", never invents detail */}
      {stage === "ready" && !review ? (
        <Pressable testID="sense-enhance" onPress={() => { Haptics.selectionAsync(); setEnhance((e) => !e); }}
          style={[styles.enhancePill, { top: insets.top + 54 }, enhance && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
          <Ionicons name="sparkles" size={13} color={enhance ? colors.onBrand : "#fff"} />
          <Text style={[styles.enhanceText, enhance && { color: colors.onBrand }]}>Osserva meglio</Text>
        </Pressable>
      ) : null}

      {/* Sense Layer selector */}
      {stage === "ready" && !review ? (
        <Animated.View entering={FadeIn.delay(150)} style={[styles.layerBar, { top: insets.top + 56 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            {SENSE_LAYERS.map((m, i) => (
              <Pressable key={m.key} testID={`sense-layer-${m.key}`} onPress={() => { Haptics.selectionAsync(); setLayerIdx(i); }}
                style={[styles.layerChip, i === layerIdx && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                <BlurView intensity={i === layerIdx ? 0 : 25} tint="dark" style={StyleSheet.absoluteFill} />
                <Text style={[styles.layerText, i === layerIdx && { color: colors.onBrand }]}>{m.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* Bottom — MAKE A SENSE */}
      {stage === "ready" && !review ? (
        <Animated.View entering={FadeIn.delay(200)} style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {/* Universal "Look Up / Go Inside" language */}
          <View style={styles.pivotRow}>
            <View style={styles.pivotActive}>
              <Ionicons name="telescope" size={13} color={colors.brand} />
              <Text style={styles.pivotActiveText}>LOOK UP · stai osservando</Text>
            </View>
            <Pressable testID="sense-go-inside" style={styles.pivotGo} onPress={goInside}>
              <Ionicons name="planet" size={13} color={colors.onBrand} />
              <Text style={styles.pivotGoText}>GO INSIDE</Text>
            </Pressable>
          </View>
          <Text style={styles.hudMeta}>{compassPoint(heading)} {heading.toFixed(0)}° · {nf(mag.magnitude, 0)} µT{weather?.temperature_c != null ? ` · ${nf(weather.temperature_c, 0)}°` : ""}</Text>
          <Pressable testID="make-a-sense" style={[styles.senseBtn, busy && { opacity: 0.85 }]} onPress={makeSense} disabled={busy}>
            <SenseMark size={26} active={busy} />
            <Text style={styles.senseBtnText}>MAKE A SENSE</Text>
          </Pressable>
          <Text style={styles.captureHint}>Rivela i dati reali della scena · Layer: {layer.label}</Text>
        </Animated.View>
      ) : null}

      {/* Review — decide whether to keep or discard the captured Sense */}
      {review ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.reviewOverlay}>
          <Image source={{ uri: review.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
          <View style={styles.reviewScrim} pointerEvents="none" />
          <View style={[styles.reviewTop, { paddingTop: insets.top + 10 }]}>
            <View style={styles.reviewBadge}>
              <SenseMark size={18} />
              <Text style={styles.reviewBadgeText}>Sense catturato · {review.data.senseLayer}</Text>
            </View>
          </View>
          <View style={[styles.reviewBar, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.reviewHint}>Vuoi conservare questo Sense? Potrai poi migliorarlo e pubblicarlo dalla galleria.</Text>
            <View style={styles.reviewBtns}>
              <Pressable testID="discard-sense" style={styles.discardBtn} onPress={discardSense} disabled={busy}>
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={styles.discardText}>Scarta</Text>
              </Pressable>
              <Pressable testID="save-sense" style={[styles.saveBtn, busy && { opacity: 0.85 }]} onPress={saveSense} disabled={busy}>
                <Ionicons name="checkmark" size={20} color={colors.onBrand} />
                <Text style={styles.saveText}>Salva</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  vizCenter: { alignItems: "center", justifyContent: "center" },
  permCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.md, justifyContent: "center" },
  permTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"], textAlign: "center", marginTop: spacing.md, letterSpacing: 0.5 },
  permText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  permSlogan: { color: colors.brand, fontFamily: fonts.regular, fontStyle: "italic", fontSize: type.base, textAlign: "center", marginVertical: spacing.sm },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999 },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  floatHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  glassBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hudPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hudText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 1.5 },
  hudRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  enhancePill: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.3)" },
  enhanceText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.3 },
  hudMeta: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1, opacity: 0.85 },
  pivotRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  pivotActive: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,16,26,0.6)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  pivotActiveText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.5 },
  pivotGo: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8 },
  pivotGoText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm - 2, letterSpacing: 0.5 },
  layerBar: { position: "absolute", left: 0, right: 0 },
  layerChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  layerText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: "center" },
  senseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, minWidth: 240, shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  senseBtnText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.lg, letterSpacing: 1.5 },
  captureHint: { color: "#fff", fontFamily: fonts.regular, fontSize: type.sm - 1, opacity: 0.85, textAlign: "center" },
  bootOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  scanLine: { position: "absolute", left: "6%", right: "6%", height: 2, backgroundColor: colors.brand, opacity: 0.7, shadowColor: colors.brand, shadowOpacity: 1, shadowRadius: 8 },
  bootCenter: { alignItems: "center", gap: spacing.md },
  bootText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, letterSpacing: 0.5 },
  createdOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", gap: spacing.md },
  createdText: { color: colors.brand, fontFamily: fonts.bold, fontSize: type["2xl"], letterSpacing: 1 },
  reviewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  reviewScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  reviewTop: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  reviewBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(10,16,26,0.7)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  reviewBadgeText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm },
  reviewBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: "center" },
  reviewHint: { color: "#fff", fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", opacity: 0.9, lineHeight: 19 },
  reviewBtns: { flexDirection: "row", gap: spacing.md, width: "100%" },
  discardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(30,30,32,0.85)", borderRadius: 999, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  discardText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.lg },
  saveText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 0.5 },
});
