import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, Linking, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCameraPermissions } from "expo-camera";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { CameraPro, CameraProHandle } from "@/src/components/CameraPro";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SenseMark } from "@/src/components/SenseMark";
import { OverviewShortcut } from "@/src/components/OverviewShortcut";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer, useMagnetometer } from "@/src/hooks/useSensors";
import { compassPoint, nf } from "@/src/lib/format";
import { api, Weather, SpaceWeather } from "@/src/lib/api";
import { loadSatrecs, computeSatellites, SatPos } from "@/src/lib/satellites";
import { buildObservation } from "@/src/lib/observationData";
import { saveObservation } from "@/src/lib/gallery";
import type { ObsData } from "@/src/lib/gallery";

type Stage = "live" | "analyzing" | "result";

export default function VisualAssistant() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const obs = useObserver();
  const now = useNow(1000);
  const granted = perm?.granted === true;
  const heading = useHeading(granted, 150);
  const accel = useAccelerometer(granted, 200);
  const mag = useMagnetometer(granted, 200);
  const cameraRef = useRef<CameraProHandle>(null);

  const [stage, setStage] = useState<Stage>("live");
  const [shot, setShot] = useState<{ uri: string; data: ObsData; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const satsReady = useRef(false);

  useEffect(() => {
    api.satellites().then((r) => { if (r.available) { loadSatrecs(r.satellites); satsReady.current = true; } }).catch(() => {});
    api.spaceWeather().then(setSpace).catch(() => {});
  }, []);
  useEffect(() => {
    if (obs.status === "granted") api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  const cameraAlt = useMemo(
    () => -Math.atan2(accel.z, Math.hypot(accel.x, accel.y)) * (180 / Math.PI),
    [accel.x, accel.y, accel.z],
  );
  const sats = useMemo<SatPos[]>(() => {
    if (obs.status !== "granted" || !satsReady.current) return [];
    return computeSatellites(now, obs.lat, obs.lon, (obs.altitude ?? 0) / 1000);
  }, [now, obs.lat, obs.lon, obs.status, obs.altitude]);

  // Build the list of REAL verified facts we hand to the AI (never invented).
  const buildFacts = (): { facts: string[]; data: ObsData } => {
    let data: ObsData;
    if (obs.status === "granted") {
      data = buildObservation(now, obs.lat, obs.lon, obs.altitude, heading, cameraAlt, sats, weather, space);
    } else {
      data = { ts: now.getTime(), cameraAz: heading, cameraAlt };
    }
    data.senseLayer = "Visual Assistant";
    data.magnetic = { magnitude: mag.magnitude };
    data.from = "visual-assistant";

    const facts: string[] = [];
    facts.push(`Ora locale: ${new Date(now).toLocaleString("it-IT")}`);
    facts.push(`Direzione fotocamera (bussola): ${compassPoint(heading)} ${heading.toFixed(0)}°`);
    facts.push(`Inclinazione fotocamera: ${cameraAlt.toFixed(0)}°`);
    if (Number.isFinite(mag.magnitude)) facts.push(`Campo magnetico misurato: ${nf(mag.magnitude, 0)} µT`);
    if (obs.status === "granted") {
      facts.push(`Posizione: lat ${obs.lat.toFixed(4)}, lon ${obs.lon.toFixed(4)}`);
      if (obs.altitude != null) facts.push(`Altitudine: ${nf(obs.altitude, 0)} m`);
    }
    if (weather?.available) {
      if (weather.temperature_c != null) facts.push(`Temperatura aria: ${nf(weather.temperature_c, 0)} °C`);
      if (weather.humidity_pct != null) facts.push(`Umidità: ${nf(weather.humidity_pct, 0)}%`);
      if (weather.pressure_hpa != null) facts.push(`Pressione: ${nf(weather.pressure_hpa, 0)} hPa`);
      if (weather.air_quality?.us_aqi != null) facts.push(`Qualità aria (US AQI): ${weather.air_quality.us_aqi}`);
    }
    if (data.sun) facts.push(`Sole: altezza ${data.sun.alt.toFixed(0)}°, azimut ${data.sun.az.toFixed(0)}°`);
    if (data.moon) facts.push(`Luna: ${data.moon.phase}, illuminata al ${(data.moon.illum * 100).toFixed(0)}%`);
    if (space?.kp_index?.available && space.kp_index.value != null) {
      facts.push(`Meteo spaziale: indice Kp ${space.kp_index.value}${space.kp_index.level ? ` (${space.kp_index.level})` : ""}`);
    }
    if (data.iss) facts.push(`ISS sopra l'orizzonte: altezza ${data.iss.alt.toFixed(0)}°`);
    return { facts, data };
  };

  // Inquadra → Comprendo: capture the frame + explain it with real data.
  const comprehend = async () => {
    if (busy || stage !== "live") return;
    setBusy(true);
    setStage("analyzing");
    try {
      const photo = await cameraRef.current?.capture();
      if (!photo?.uri || !photo.base64) { setStage("live"); setBusy(false); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { facts, data } = buildFacts();
      let text = "";
      try {
        const r = await api.see(photo.base64, facts);
        text = r.text?.trim() || "";
      } catch {
        text = "L'Assistente Visivo non è disponibile in questo momento. Riprova più tardi.";
      }
      data.aiNote = text;
      setShot({ uri: photo.uri, data, text });
      setStage("result");
    } catch {
      setStage("live");
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShot(null);
    setStage("live");
  };

  // Comprendo → Senshot: save the analyzed frame with the AI context attached.
  const createSenshot = async () => {
    if (!shot || busy) return;
    setBusy(true);
    try {
      const saved = await saveObservation(shot.uri, shot.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/observation?id=${saved.id}` as never);
    } catch { setBusy(false); }
  };

  if (!perm) return <SpaceBackground><ScreenHeader title="Assistente Visivo" /></SpaceBackground>;

  if (!granted) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Assistente Visivo" />
        <View style={styles.permCenter}>
          <Ionicons name="eye" size={60} color={colors.brand} />
          <Text style={styles.permTitle}>Inquadra → Comprendo → Senshot</Text>
          <Text style={styles.permText}>
            Punta la fotocamera su qualsiasi cosa: l&apos;assistente osserva la scena e la spiega usando i dati reali
            dei sensori e delle fonti scientifiche. Nessun dato inventato.
          </Text>
          {perm.canAskAgain ? (
            <Pressable testID="grant-camera-va" style={styles.cta} onPress={() => requestPerm()}>
              <Text style={styles.ctaText}>Attiva la fotocamera</Text>
            </Pressable>
          ) : (
            <Pressable testID="open-settings-va" style={styles.cta} onPress={() => Linking.openSettings()}>
              <Text style={styles.ctaText}>Apri Impostazioni</Text>
            </Pressable>
          )}
        </View>
      </SpaceBackground>
    );
  }

  return (
    <View style={styles.root}>
      <CameraPro ref={cameraRef} enhance />

      {/* Top HUD */}
      <View style={[styles.floatHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="va-back" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.hudPill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="eye" size={13} color={colors.brand} />
          <Text style={styles.hudText}>ASSISTENTE VISIVO</Text>
        </View>
        <OverviewShortcut size={26} />
      </View>

      {/* Live guidance */}
      {stage === "live" ? (
        <Animated.View entering={FadeIn.delay(120)} style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.hudMeta}>
            {compassPoint(heading)} {heading.toFixed(0)}° · {nf(mag.magnitude, 0)} µT{weather?.temperature_c != null ? ` · ${nf(weather.temperature_c, 0)}°` : ""}
          </Text>
          <Pressable testID="va-comprehend" style={[styles.senseBtn, busy && { opacity: 0.85 }]} onPress={comprehend} disabled={busy}>
            <Ionicons name="scan" size={22} color={colors.onBrand} />
            <Text style={styles.senseBtnText}>COMPRENDO</Text>
          </Pressable>
          <Text style={styles.captureHint}>Inquadra ciò che vuoi capire · l&apos;AI spiega con dati reali</Text>
        </Animated.View>
      ) : null}

      {/* Analyzing overlay */}
      {stage === "analyzing" ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.analyzeOverlay} pointerEvents="none">
          <SenseMark size={54} active />
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.md }} />
          <Text style={styles.analyzeText}>Comprendo la scena…</Text>
          <Text style={styles.analyzeSub}>Analizzo l&apos;immagine con i dati reali</Text>
        </Animated.View>
      ) : null}

      {/* Result: photo + AI explanation + Senshot */}
      {stage === "result" && shot ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut} style={styles.resultOverlay}>
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
          <View style={styles.resultScrim} pointerEvents="none" />
          <View style={[styles.resultTop, { paddingTop: insets.top + 10 }]}>
            <View style={styles.reviewBadge}>
              <Ionicons name="eye" size={16} color={colors.brand} />
              <Text style={styles.reviewBadgeText}>Comprendo</Text>
            </View>
          </View>
          <Pressable testID="va-close" style={[styles.resultClose, { top: insets.top + 8 }]} onPress={retry} hitSlop={10}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>

          <View style={[styles.resultSheet, { paddingBottom: insets.bottom + 16, maxHeight: height * 0.62 }]}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.sheetHandle} />
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }} showsVerticalScrollIndicator={false}>
              <View style={styles.aiHeader}>
                <SenseMark size={22} />
                <Text style={styles.aiHeaderText}>Cosa stai osservando</Text>
              </View>
              <Text style={styles.aiText}>{shot.text}</Text>
              <Text style={styles.aiFootnote}>Spiegazione basata solo su dati reali e su ciò che è visibile. Overview non inventa nulla.</Text>
            </ScrollView>

            <View style={styles.resultBtns}>
              <Pressable testID="va-retry" style={styles.discardBtn} onPress={retry} disabled={busy}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.discardText}>Riprova</Text>
              </Pressable>
              <Pressable testID="va-senshot" style={[styles.saveBtn, busy && { opacity: 0.85 }]} onPress={createSenshot} disabled={busy}>
                <SenseMark size={20} active={busy} />
                <Text style={styles.saveText}>Crea Senshot</Text>
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
  permCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.md, justifyContent: "center" },
  permTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl, textAlign: "center", marginTop: spacing.md },
  permText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999, marginTop: spacing.sm },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  floatHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  glassBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hudPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hudText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 1.2 },
  hudMeta: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1, opacity: 0.85 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: "center" },
  senseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, minWidth: 240, shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  senseBtnText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.lg, letterSpacing: 1.5 },
  captureHint: { color: "#fff", fontFamily: fonts.regular, fontSize: type.sm - 1, opacity: 0.85, textAlign: "center" },
  analyzeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center" },
  analyzeText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: spacing.md },
  analyzeSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 4 },
  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  resultScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  resultTop: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
  resultClose: { position: "absolute", right: spacing.lg, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  reviewBadge: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(10,16,26,0.7)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  reviewBadgeText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm },
  resultSheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", marginTop: spacing.sm },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  aiHeaderText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base, letterSpacing: 0.5 },
  aiText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 23 },
  aiFootnote: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 1, fontStyle: "italic", lineHeight: 17 },
  resultBtns: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  discardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(30,30,32,0.85)", borderRadius: 999, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  discardText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base },
  saveBtn: { flex: 1.3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.lg },
  saveText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 0.5 },
});
