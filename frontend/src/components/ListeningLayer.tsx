import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Platform, Linking } from "react-native";
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule,
  createAudioPlayer, AudioPlayer, setAudioModeAsync,
} from "expo-audio";
import Svg, { Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GlassCard } from "@/src/components/GlassCard";
import { colors, fonts, spacing, type } from "@/src/theme";
import { saveAudioObservation } from "@/src/lib/gallery";

const BARS = 40;

// Normalise platform metering (dB or 0..1) to a 0..1 intensity.
function normLevel(m: number | undefined): number {
  if (m == null) return 0;
  if (m <= 0) return Math.max(0, Math.min(1, (m + 60) / 60)); // dB scale
  if (m <= 1) return m; // already 0..1
  return Math.max(0, Math.min(1, m / 100));
}

export function ListeningLayer() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 120);
  const [permDenied, setPermDenied] = useState(false);
  const [history, setHistory] = useState<number[]>(Array(BARS).fill(0));
  const [impulse, setImpulse] = useState(false);
  const [lastUri, setLastUri] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const prev = useRef(0);
  const orb = useSharedValue(0);

  const level = normLevel(state.metering);
  const dbText = state.metering != null ? `${state.metering.toFixed(0)} dB` : "— dB";

  useEffect(() => {
    if (!state.isRecording) return;
    orb.value = withTiming(level, { duration: 120 });
    setHistory((h) => [...h.slice(1), level]);
    if (Math.abs(level - prev.current) > 0.28) {
      setImpulse(true);
      setTimeout(() => setImpulse(false), 350);
    }
    prev.current = level;
  }, [state.metering, state.isRecording, level, orb]);

  useEffect(() => () => { player.current?.release(); }, []);

  const start = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) { setPermDenied(true); return; }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
    recorder.record();
    setLastUri(null);
    setSaved(false);
  };

  const stop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    setLastUri(recorder.uri ?? null);
    setHistory(Array(BARS).fill(0));
  };

  const playback = (amplified: boolean) => {
    if (!lastUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.current?.release();
    player.current = createAudioPlayer({ uri: lastUri });
    player.current.volume = amplified ? 1.0 : 0.7;
    player.current.play();
  };

  const save = async () => {
    if (!lastUri) return;
    await saveAudioObservation(lastUri, "Paesaggio sonoro");
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + orb.value * 0.8 }], opacity: 0.5 + orb.value * 0.5 }));

  if (Platform.OS === "web") {
    return (
      <GlassCard testID="listen-web-notice" style={{ margin: spacing.lg }}>
        <Text style={styles.title}>Listening Layer</Text>
        <Text style={styles.note}>L&apos;analisi del microfono richiede un iPhone reale (Expo Go). Non è disponibile nell&apos;anteprima web.</Text>
      </GlassCard>
    );
  }

  return (
    <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
      <GlassCard testID="listen-card" style={{ flex: 1, alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.title}>Paesaggio sonoro</Text>
          <Text style={styles.subtitle}>Intensità reale in tempo reale</Text>
        </View>

        <View style={styles.orbWrap}>
          <View style={[styles.orbHalo, impulse && { borderColor: colors.brand }]} />
          <Animated.View style={[styles.orb, orbStyle, impulse && { backgroundColor: colors.brand }]} />
          <Text style={styles.db}>{dbText}</Text>
        </View>

        <Svg width="100%" height={70}>
          {history.map((v, i) => {
            const bw = 100 / BARS;
            const h = 4 + v * 62;
            return <Rect key={i} x={`${i * bw + 0.5}%`} y={70 - h} width={`${bw - 1}%`} height={h} rx={2} fill={i > BARS - 4 ? colors.brand : colors.blue} opacity={0.5 + v * 0.5} />;
          })}
        </Svg>

        <View style={styles.metaRow}>
          <Meta label="Intensità" value={`${Math.round(level * 100)}%`} />
          <Meta label="Impulsi" value={impulse ? "rilevato" : "—"} accent={impulse ? colors.brand : colors.onSurface} />
          <Meta label="Stato" value={state.isRecording ? "in ascolto" : "fermo"} />
        </View>
      </GlassCard>

      {permDenied ? (
        <Pressable testID="mic-settings" style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.settingsText}>Microfono negato · Apri Impostazioni</Text>
        </Pressable>
      ) : null}

      {!state.isRecording && lastUri ? (
        <View style={styles.playbackRow}>
          <SmallBtn icon="play" label="Originale" onPress={() => playback(false)} testID="play-original" />
          <SmallBtn icon="volume-high" label="Amplificato" onPress={() => playback(true)} testID="play-amplified" />
          <SmallBtn icon={saved ? "checkmark" : "bookmark"} label={saved ? "Salvato" : "Salva"} onPress={save} testID="save-recording" primary />
        </View>
      ) : null}

      <Pressable testID="record-toggle" style={[styles.recBtn, state.isRecording && styles.recActive]} onPress={state.isRecording ? stop : start}>
        <Ionicons name={state.isRecording ? "stop" : "mic"} size={24} color={state.isRecording ? colors.onSurface : colors.onBrand} />
        <Text style={[styles.recText, state.isRecording && { color: colors.onSurface }]}>{state.isRecording ? "Ferma" : "Ascolta l'ambiente"}</Text>
      </Pressable>

      <Text style={styles.note}>
        OverView rende percepibili intensità e impulsi realmente presenti. Lo spettro completo delle frequenze richiede un modulo nativo dedicato: non viene simulato per non inventare dati.
      </Text>
    </View>
  );
}

function Meta({ label, value, accent = colors.onSurface }: { label: string; value: string; accent?: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={[styles.metaValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function SmallBtn({ icon, label, onPress, testID, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; testID: string; primary?: boolean }) {
  return (
    <Pressable testID={testID} style={[styles.smallBtn, primary && styles.smallPrimary]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={primary ? colors.onBrand : colors.onSurface} />
      <Text style={[styles.smallText, primary && { color: colors.onBrand }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2 },
  orbWrap: { alignItems: "center", justifyContent: "center", height: 180, width: 180 },
  orbHalo: { position: "absolute", width: 170, height: 170, borderRadius: 85, borderWidth: 1, borderColor: colors.border },
  orb: { width: 130, height: 130, borderRadius: 65, backgroundColor: colors.blue },
  db: { position: "absolute", color: colors.onSurface, fontFamily: fonts.mono, fontSize: type.lg },
  metaRow: { flexDirection: "row", alignSelf: "stretch" },
  metaValue: { fontFamily: fonts.monoMedium, fontSize: type.base },
  metaLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2 },
  playbackRow: { flexDirection: "row", gap: spacing.sm },
  smallBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: 14, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  smallPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  smallText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  recBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.lg },
  recActive: { backgroundColor: colors.tertiary, borderWidth: 1, borderColor: colors.borderStrong },
  recText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  settingsBtn: { alignItems: "center", paddingVertical: spacing.sm },
  settingsText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.base },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.6, textAlign: "center" },
});
