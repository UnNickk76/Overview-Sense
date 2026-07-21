import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, Linking, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import Svg, { Circle, Line, G, Defs, RadialGradient, Stop } from "react-native-svg";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer, useMagnetometer } from "@/src/hooks/useSensors";
import { compassPoint, nf } from "@/src/lib/format";
import { cameraAltFromAccel } from "@/src/lib/project";
import { api, Weather, SpaceWeather } from "@/src/lib/api";
import { loadSatrecs, computeSatellites, SatPos, hasSatrecs } from "@/src/lib/satellites";
import { buildObservation } from "@/src/lib/observationData";
import { saveObservation, type ObsData } from "@/src/lib/gallery";

type Mode = { key: string; label: string; tint: string; color: string };
const MODES: Mode[] = [
  { key: "fields", label: "Invisible Fields", tint: "rgba(212,175,55,0.10)", color: colors.brand },
  { key: "magnetic", label: "Magnetic Field", tint: "rgba(212,175,55,0.16)", color: colors.brand },
  { key: "solar", label: "Solar Field", tint: "rgba(255,159,10,0.16)", color: "#FF9F0A" },
  { key: "light", label: "Light Amplification", tint: "rgba(255,255,255,0.14)", color: "#FFFFFF" },
  { key: "contrast", label: "Contrast Mapping", tint: "rgba(0,0,0,0.28)", color: "#8FD0FF" },
  { key: "edge", label: "Edge Detection", tint: "rgba(0,0,0,0.15)", color: "#8FD0FF" },
  { key: "color", label: "Color Amplification", tint: "rgba(90,176,255,0.14)", color: colors.blue },
  { key: "night", label: "Night Vision", tint: "rgba(24,255,120,0.14)", color: "#18FF78" },
];

export default function InvisibleObserve() {
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
  const [modeIdx, setModeIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const satsReady = useRef(false);
  const mode = MODES[modeIdx];

  useEffect(() => {
    api.satellites().then((r) => { if (r.available) { loadSatrecs(r.satellites); satsReady.current = true; } }).catch(() => {});
    api.spaceWeather().then(setSpace).catch(() => {});
  }, []);
  useEffect(() => {
    if (obs.status === "granted") api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  const cameraAlt = useMemo(
    () => cameraAltFromAccel(accel),
    [accel.x, accel.y, accel.z],
  );

  const sats = useMemo<SatPos[]>(() => {
    if (obs.status !== "granted" || !satsReady.current) return [];
    return computeSatellites(now, obs.lat, obs.lon, (obs.altitude ?? 0) / 1000);
  }, [now, obs.lat, obs.lon, obs.status, obs.altitude]);

  const fieldIntensity = Math.min(1, mag.magnitude / 80);
  const modeColor = mode.key === "solar" ? "#FF9F0A" : mode.color === "#FFFFFF" ? colors.brand : mode.color;

  const rot = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [rot, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value + heading}deg` }, { scale: pulse.value }] }));

  const vizSize = Math.min(width, height) * 0.85;
  const cx = vizSize / 2;
  const rays = 12;

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        const data = obs.status === "granted"
          ? buildObservation(now, obs.lat, obs.lon, obs.altitude, heading, cameraAlt, sats, weather, space)
          : { ts: now.getTime(), cameraAz: heading, cameraAlt,
              spaceWeather: space?.kp_index?.available
                ? { kp: space.kp_index.value ?? undefined, level: space.kp_index.level ?? undefined, solarWind: space.solar_wind?.speed_kms }
                : undefined };
        (data as ObsData).magnetic = { magnitude: mag.magnitude };
        const saved = await saveObservation(photo.uri, data);
        router.push(`/observation?id=${saved.id}` as never);
      }
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  if (!perm) return <SpaceBackground><ScreenHeader title="Invisible Fields" /></SpaceBackground>;

  if (!perm.granted) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Invisible Fields" />
        <View style={styles.permCenter}>
          <Ionicons name="aperture-outline" size={44} color={colors.brand} />
          <Text style={styles.permTitle}>Osserva i campi invisibili</Text>
          <Text style={styles.permText}>Serve la fotocamera per sovrapporre in tempo reale i dati fisici reali (campo magnetico, orientamento, Sole, Luna, satelliti) e catturare una Observation unica.</Text>
          {perm.canAskAgain ? (
            <Pressable testID="grant-camera-fields" style={styles.cta} onPress={() => requestPerm()}>
              <Text style={styles.ctaText}>Consenti fotocamera</Text>
            </Pressable>
          ) : (
            <Pressable testID="open-settings-fields" style={styles.cta} onPress={() => Linking.openSettings()}>
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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: mode.tint }]} pointerEvents="none" />

      {/* Real-data field visualization overlay */}
      <View style={[StyleSheet.absoluteFill, styles.vizCenter]} pointerEvents="none">
        <Animated.View style={[{ width: vizSize, height: vizSize }, ringStyle]}>
          <Svg width={vizSize} height={vizSize}>
            <Defs>
              <RadialGradient id="fcore" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={modeColor} stopOpacity={0.28 + fieldIntensity * 0.3} />
                <Stop offset="100%" stopColor={modeColor} stopOpacity={0.02} />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cx} r={cx * (0.5 + fieldIntensity * 0.35)} fill="url(#fcore)" />
            {[0.9, 0.7, 0.5].map((k, i) => (
              <Circle key={i} cx={cx} cy={cx} r={cx * k} stroke={modeColor} strokeWidth={1} opacity={0.2 + fieldIntensity * 0.2} fill="none" />
            ))}
            <G>
              {Array.from({ length: rays }).map((_, i) => {
                const a = (i / rays) * Math.PI * 2;
                return (
                  <Line key={i} x1={cx + Math.cos(a) * cx * 0.35} y1={cx + Math.sin(a) * cx * 0.35}
                    x2={cx + Math.cos(a) * cx * (0.55 + fieldIntensity * 0.35)} y2={cx + Math.sin(a) * cx * (0.55 + fieldIntensity * 0.35)}
                    stroke={modeColor} strokeWidth={1} opacity={0.25} />
                );
              })}
            </G>
          </Svg>
        </Animated.View>
      </View>

      {/* Top HUD */}
      <View style={[styles.floatHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="fields-back" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.hudPill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.hudText}>{compassPoint(heading)} {heading.toFixed(0)}° · {nf(mag.magnitude, 0)} µT</Text>
        </View>
      </View>

      {/* Mode selector */}
      <View style={[styles.modeBar, { top: insets.top + 56 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {MODES.map((m, i) => (
            <Pressable key={m.key} testID={`mode-${m.key}`} onPress={() => { Haptics.selectionAsync(); setModeIdx(i); }}
              style={[styles.modeChip, i === modeIdx && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
              <BlurView intensity={i === modeIdx ? 0 : 25} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={[styles.modeText, i === modeIdx && { color: colors.onBrand }]}>{m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Bottom capture */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.captureHint}>Rendering di dati fisici reali · CAPTURE crea una Observation</Text>
        <Pressable testID="fields-capture" style={[styles.shutter, busy && { opacity: 0.5 }]} onPress={capture}>
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  vizCenter: { alignItems: "center", justifyContent: "center" },
  permCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.md, justifyContent: "center" },
  permTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl, textAlign: "center", marginTop: spacing.md },
  permText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999 },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  floatHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  glassBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hudPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hudText: { color: "#fff", fontFamily: fonts.monoMedium, fontSize: type.sm },
  modeBar: { position: "absolute", left: 0, right: 0 },
  modeChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modeText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: "center" },
  captureHint: { color: "#fff", fontFamily: fonts.regular, fontSize: type.sm - 1, opacity: 0.85, textAlign: "center" },
  shutter: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff" },
});
