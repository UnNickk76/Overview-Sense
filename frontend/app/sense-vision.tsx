import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, Linking, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BlurView } from "expo-blur";
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
  const cameraRef = useRef<CameraView>(null);
  const [layerIdx, setLayerIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"init" | "scan" | "ready">("init");
  const [created, setCreated] = useState(false);
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
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
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
        const saved = await saveObservation(photo.uri, data);
        setCreated(true);
        setTimeout(() => router.replace(`/observation?id=${saved.id}` as never), 850);
      } else {
        setBusy(false);
      }
    } catch { setBusy(false); }
  };

  if (!perm) return <SpaceBackground><ScreenHeader title="Sense Vision" /></SpaceBackground>;

  if (!perm.granted) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Sense Vision™" />
        <View style={styles.permCenter}>
          <Ionicons name="scan-circle-outline" size={52} color={colors.brand} />
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
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
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
            <Ionicons name="eye" size={30} color={colors.brand} />
            <Text style={styles.bootText}>
              {stage === "init" ? "Initializing Sense Vision…" : "Looking beyond human perception…"}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* Sense Created flash */}
      {created ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.createdOverlay} pointerEvents="none">
          <Ionicons name="sparkles" size={48} color={colors.brand} />
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
      </View>

      {/* Sense Layer selector */}
      {stage === "ready" ? (
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
      {stage === "ready" ? (
        <Animated.View entering={FadeIn.delay(200)} style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.hudMeta}>{compassPoint(heading)} {heading.toFixed(0)}° · {nf(mag.magnitude, 0)} µT{weather?.temperature_c != null ? ` · ${nf(weather.temperature_c, 0)}°` : ""}</Text>
          <Pressable testID="make-a-sense" style={[styles.senseBtn, busy && { opacity: 0.6 }]} onPress={makeSense} disabled={busy}>
            <Ionicons name="sparkles" size={20} color={colors.onBrand} />
            <Text style={styles.senseBtnText}>MAKE A SENSE</Text>
            <Ionicons name="sparkles" size={20} color={colors.onBrand} />
          </Pressable>
          <Text style={styles.captureHint}>Rivela i dati reali della scena · Layer: {layer.label}</Text>
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
  hudMeta: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1, opacity: 0.85 },
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
});
