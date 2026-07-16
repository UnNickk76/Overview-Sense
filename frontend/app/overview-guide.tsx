import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator, ScrollView, Platform, Linking, Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import Animated, { FadeIn } from "react-native-reanimated";
import { CameraPro, CameraProHandle } from "@/src/components/CameraPro";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { SenseRadar } from "@/src/components/SenseRadar";
import { SenseStatusRing } from "@/src/components/SenseStatusRing";
import { OverviewShortcut } from "@/src/components/OverviewShortcut";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer } from "@/src/hooks/useSensors";
import { computeSky } from "@/src/lib/skyObjects";
import { computeSatellites, loadSatrecs, hasSatrecs, SatPos } from "@/src/lib/satellites";
import { api } from "@/src/lib/api";
import {
  GuideTarget, GuideKind, computeGuidance, bearingTo, distanceKm, elevationTo,
} from "@/src/lib/guidance";
import { buildObservation } from "@/src/lib/observationData";
import { saveObservation } from "@/src/lib/gallery";
import { useCameraPermissions } from "expo-camera";

const SUGGESTIONS = ["Trova Saturno", "Dov'è la ISS?", "Portami sulla Luna", "Trova Giove", "Fammi vedere Andromeda", "Trova il Colosseo"];

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
}

export default function OverviewGuide() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { q: initialQ } = useLocalSearchParams<{ q?: string }>();
  const [perm, requestPerm] = useCameraPermissions();
  const obs = useObserver();
  const now = useNow(700);
  const granted = perm?.granted === true;
  const heading = useHeading(granted, 100);
  const accel = useAccelerometer(granted, 150);
  const cameraRef = useRef<CameraProHandle>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [descriptor, setDescriptor] = useState<{ domain: string; name: string; sky_key: string; lat?: number; lon?: number; elevation_m?: number; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const s = Keyboard.addListener("keyboardDidShow", (e) => { setKbOpen(true); setKbHeight(e.endCoordinates?.height ?? 0); });
    const h = Keyboard.addListener("keyboardDidHide", () => { setKbOpen(false); setKbHeight(0); });
    return () => { s.remove(); h.remove(); };
  }, []);

  useEffect(() => {
    if (!hasSatrecs()) api.satellites().then((r) => { if (r.available && r.satellites?.length) loadSatrecs(r.satellites); }).catch(() => {});
  }, []);

  const pitch = useMemo(
    () => -Math.atan2(accel.z, Math.hypot(accel.x, accel.y)) * (180 / Math.PI),
    [accel.x, accel.y, accel.z],
  );

  // Resolve the descriptor to a live target (real az/alt) each tick.
  const target = useMemo<GuideTarget | null>(() => {
    if (!descriptor || obs.status !== "granted") return null;
    const d = descriptor;
    if (d.domain === "earth" && d.lat != null && d.lon != null) {
      const dist = distanceKm(obs.lat, obs.lon, d.lat, d.lon);
      const az = bearingTo(obs.lat, obs.lon, d.lat, d.lon);
      const alt = elevationTo(dist, d.elevation_m ?? 0, obs.altitude ?? 0);
      return { domain: "earth", name: d.name, kind: "landmark", az, alt, distanceKm: dist, note: d.note };
    }
    if (d.domain === "sky") {
      const key = norm(d.sky_key || d.name);
      if (key.includes("iss") || norm(d.name).includes("stazione spaziale")) {
        if (hasSatrecs()) {
          const sats: SatPos[] = computeSatellites(now, obs.lat, obs.lon, (obs.altitude ?? 0) / 1000);
          const iss = sats.find((s) => /iss|zarya/i.test(s.name));
          if (iss) return { domain: "sky", name: "ISS", kind: "iss", az: iss.az, alt: iss.alt, distanceKm: iss.rangeKm, note: d.note };
        }
        return { domain: "sky", name: "ISS", kind: "iss", az: 0, alt: -90, note: "Posizione ISS non disponibile ora" };
      }
      const sky = computeSky(now, obs.lat, obs.lon);
      const match = sky.find((o) => {
        const oid = norm(o.id.replace(/^(ds-|star-)/, "")), on = norm(o.name);
        return oid === key || on === key || on.split(" ").some((w) => w.length > 3 && key.includes(w)) || key.split(" ").some((w) => w.length > 3 && on.includes(w));
      });
      if (match) {
        return { domain: "sky", name: d.name, kind: match.kind as GuideKind, az: match.az, alt: match.alt, magnitude: match.magnitude, note: d.note };
      }
    }
    return null;
  }, [descriptor, obs.status, obs.lat, obs.lon, obs.altitude, now]);

  const guide = useMemo(() => (target ? computeGuidance(target, heading, pitch) : null), [target, heading, pitch]);

  const resolve = useCallback(async (q: string) => {
    const text = q.trim();
    if (!text || resolving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResolving(true); setError(null); setDescriptor(null);
    try {
      const lat = obs.status === "granted" ? obs.lat : undefined;
      const lon = obs.status === "granted" ? obs.lon : undefined;
      const d = await api.guideResolve(text, lat, lon);
      if (d.domain === "unknown") { setError(`Non ho trovato "${text}". Prova con un oggetto reale del cielo o della Terra.`); }
      else setDescriptor(d);
    } catch { setError("OverView Guide non è disponibile ora. Riprova."); } finally { setResolving(false); }
  }, [obs, resolving]);

  // Deep-link target from a technical card ("Guidami"): auto-resolve once ready.
  const didAutoResolve = useRef(false);
  useEffect(() => {
    if (initialQ && !didAutoResolve.current && obs.status === "granted") {
      didAutoResolve.current = true;
      setQuery(String(initialQ));
      resolve(String(initialQ));
    }
  }, [initialQ, obs.status, resolve]);

  const startRec = async () => {
    const p = await AudioModule.requestRecordingPermissionsAsync();
    if (!p.granted) { setError("Consenti il microfono per usare la voce."); return; }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
    recorder.record();
    setRecording(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const stopRec = async () => {
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      setResolving(true);
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const { text } = await api.guideTranscribe(b64, "m4a");
      if (text) { setQuery(text); await resolve(text); } else setResolving(false);
    } catch { setError("Trascrizione non riuscita. Prova a scrivere."); setResolving(false); }
  };

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.capture();
      if (!photo?.uri) { setBusy(false); return; }
      const data = obs.status === "granted"
        ? buildObservation(now, obs.lat, obs.lon, obs.altitude, heading, pitch, [], null, null)
        : { ts: now.getTime(), cameraAz: heading, cameraAlt: pitch } as ReturnType<typeof buildObservation>;
      data.subject = target?.name;
      data.senseLayer = "OverView Guide";
      data.from = "overview-guide";
      const saved = await saveObservation(photo.uri, data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/observation?id=${saved.id}` as never);
    } catch { setBusy(false); }
  };

  if (!perm) return <SpaceBackground />;

  if (!granted) {
    return (
      <SpaceBackground>
        <View style={[styles.permBox, { paddingTop: insets.top + 40 }]}>
          <Ionicons name="compass" size={60} color={colors.brand} />
          <Text style={styles.permTitle}>OverView Guide™</Text>
          <Text style={styles.permText}>Chiedi cosa vuoi osservare — a voce o per iscritto — e OverView ti guida con lo sguardo fino a trovarlo, nel cielo o sulla Terra.</Text>
          {perm.canAskAgain
            ? <Pressable testID="guide-grant" style={styles.cta} onPress={() => requestPerm()}><Text style={styles.ctaText}>Attiva la fotocamera</Text></Pressable>
            : <Pressable testID="guide-settings" style={styles.cta} onPress={() => Linking.openSettings()}><Text style={styles.ctaText}>Apri Impostazioni</Text></Pressable>}
        </View>
      </SpaceBackground>
    );
  }

  const locked = guide?.state === "locked";

  return (
    <View style={styles.root}>
      <CameraPro ref={cameraRef} enhance hudBottom={insets.bottom + 236} />

      {/* Tap anywhere above the input to dismiss the keyboard */}
      {kbOpen ? (
        <Pressable testID="guide-kb-dismiss" style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()} />
      ) : null}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="guide-back" style={styles.glass} onPress={() => router.back()}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.titlePill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="compass" size={13} color={colors.brand} />
          <Text style={styles.titleText}>OVERVIEW GUIDE</Text>
        </View>
        <OverviewShortcut size={26} />
      </View>

      {/* Live radar + status ring while guiding */}
      {target && guide ? (
        <>
          <View style={[styles.radarPos, { top: insets.top + 58 }]}>
            <SenseRadar target={{ az: target.az, alt: target.alt, name: target.name }} heading={heading} />
          </View>
          <View style={styles.ringPos} pointerEvents="none">
            <SenseStatusRing size={170} proximity={guide.proximity} state={guide.state}
              status={locked ? "AGGANCIATO" : guide.state === "approaching" ? "QUASI" : "RICERCA"} />
          </View>
          <Animated.View entering={FadeIn} style={[styles.hintWrap, { bottom: insets.bottom + 150 }]} pointerEvents="none">
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.hintText}>{guide.hint}</Text>
            {!locked ? <Text style={styles.hintSub}>Zoom consigliato {guide.recommendedZoom}× · {target.name}</Text> : (
              <Text style={styles.hintSub}>Zoom consigliato {guide.recommendedZoom}× · pronto per il Senshot</Text>
            )}
          </Animated.View>
          {locked ? (
            <Pressable testID="guide-capture" style={[styles.captureBtn, { bottom: insets.bottom + 60 }]} onPress={capture} disabled={busy}>
              <Ionicons name="aperture" size={22} color={colors.onBrand} />
              <Text style={styles.captureText}>Scatta il Senshot</Text>
            </Pressable>
          ) : null}
          <Pressable testID="guide-reset" style={[styles.resetBtn, { bottom: insets.bottom + (locked ? 118 : 60) }]} onPress={() => { setDescriptor(null); setQuery(""); }}>
            <Ionicons name="close" size={16} color="#fff" />
            <Text style={styles.resetText}>Cambia obiettivo</Text>
          </Pressable>
        </>
      ) : null}

      {/* Input bar (only when no active target) */}
      {!target ? (
        <View style={[styles.bottomPanel, { paddingBottom: (kbOpen ? spacing.md : insets.bottom + 16) + (Platform.OS === "ios" ? kbHeight : 0) }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          {error ? <Text style={styles.error}>{error}</Text> : (
            <Text style={styles.lead}>Cosa vuoi osservare? Scrivi o parla.</Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} testID={`sugg-${s}`} style={styles.chip} onPress={() => { setQuery(s); resolve(s); }}>
                <Text style={styles.chipText}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput testID="guide-input" style={styles.input} value={query} onChangeText={setQuery}
              placeholder="Es. Trova Saturno" placeholderTextColor={colors.onSurfaceSecondary}
              onSubmitEditing={() => resolve(query)} returnKeyType="search" />
            <Pressable testID="guide-mic" style={[styles.micBtn, recording && styles.micOn]} onPressIn={startRec} onPressOut={stopRec}>
              <Ionicons name={recording ? "radio" : "mic"} size={20} color={recording ? colors.onBrand : colors.brand} />
            </Pressable>
            <Pressable testID="guide-go" style={styles.goBtn} onPress={() => resolve(query)} disabled={resolving}>
              {resolving ? <ActivityIndicator color={colors.onBrand} /> : <Ionicons name="arrow-forward" size={20} color={colors.onBrand} />}
            </Pressable>
          </View>
          {recording ? <Text style={styles.recHint}>Sto ascoltando… rilascia per cercare</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  permBox: { flex: 1, alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
  permTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"], marginTop: spacing.md },
  permText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 22 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.md },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  header: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, zIndex: 5 },
  glass: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  titlePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  titleText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 1.2 },
  radarPos: { position: "absolute", right: spacing.lg, zIndex: 4 },
  ringPos: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  hintWrap: { position: "absolute", alignSelf: "center", borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", maxWidth: "88%" },
  hintText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.lg, textAlign: "center" },
  hintSub: { color: colors.brand, fontFamily: fonts.mono, fontSize: type.sm - 1, marginTop: 3 },
  captureBtn: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  captureText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 0.5 },
  resetBtn: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  resetText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm },
  bottomPanel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.md, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  lead: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, textAlign: "center" },
  error: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center" },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1, height: 48, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 24, paddingHorizontal: spacing.lg, color: "#fff", fontFamily: fonts.regular, fontSize: type.base },
  micBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brand },
  micOn: { backgroundColor: colors.brand },
  goBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  recHint: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center" },
});
