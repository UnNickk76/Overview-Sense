import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Alert, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import {
  useAudioRecorder, RecordingPresets, AudioModule,
  createAudioPlayer, setAudioModeAsync, type AudioPlayer,
} from "expo-audio";
import { socialApi, mediaUrl } from "@/src/lib/backend";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const MAX_SECONDS = 60;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface VoiceRef { media_id: string; duration: number; url: string }

// ── Composer: record / preview / attach a short voice message ────────────────
export function VoiceRecorder({ value, onChange }: { value: VoiceRef | null; onChange: (v: VoiceRef | null) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
    try { player.current?.remove(); } catch { /* ignore */ }
  }, []);

  const start = useCallback(async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert("Microfono disattivato", "Attiva il microfono nelle Impostazioni per registrare un messaggio vocale.",
          [{ text: "Annulla", style: "cancel" }, { text: "Apri Impostazioni", onPress: () => Linking.openSettings() }]);
      }
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRecording(true); setElapsed(0);
      tick.current = setInterval(() => setElapsed((e) => {
        if (e + 1 >= MAX_SECONDS) { stop(); return MAX_SECONDS; }
        return e + 1;
      }), 1000);
    } catch { /* ignore */ }
  }, [recorder]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(async () => {
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    setRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      const dur = elapsed || 1;
      setUploading(true);
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const r = await socialApi.uploadAudio(b64, dur);
      onChange({ media_id: r.id, duration: dur, url: r.url });
    } catch { Alert.alert("Errore", "Registrazione non riuscita. Riprova."); }
    finally { setUploading(false); }
  }, [recorder, elapsed, onChange]);

  const preview = useCallback(async () => {
    if (!value) return;
    if (playing) { try { player.current?.pause(); } catch { /* ignore */ } setPlaying(false); return; }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      try { player.current?.remove(); } catch { /* ignore */ }
      const p = createAudioPlayer({ uri: mediaUrl(value.url) as string });
      player.current = p; p.play(); setPlaying(true);
      setTimeout(() => { setPlaying(false); }, (value.duration + 0.5) * 1000);
    } catch { /* ignore */ }
  }, [value, playing]);

  if (value) {
    return (
      <View style={styles.card}>
        <Pressable testID="voice-preview" style={styles.play} onPress={preview}>
          <Ionicons name={playing ? "pause" : "play"} size={18} color={colors.onBrand} />
        </Pressable>
        <View style={styles.wave}>
          {Array.from({ length: 22 }).map((_, i) => (
            <View key={i} style={[styles.bar, { height: 6 + ((i * 7) % 20) }]} />
          ))}
        </View>
        <Text style={styles.dur}>{fmt(value.duration)}</Text>
        <Pressable testID="voice-remove" hitSlop={8} onPress={() => { Haptics.selectionAsync(); onChange(null); }}>
          <Ionicons name="close-circle" size={22} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable testID="voice-record" style={[styles.record, recording && styles.recordOn]} onPress={recording ? stop : start} disabled={uploading}>
      <Ionicons name={recording ? "stop-circle" : "mic"} size={20} color={recording ? "#fff" : colors.brand} />
      <Text style={[styles.recordText, recording && { color: "#fff" }]}>
        {uploading ? "Carico…" : recording ? `Registrazione… ${fmt(elapsed)} · tocca per fermare` : "Registra un messaggio vocale"}
      </Text>
    </Pressable>
  );
}

// ── Viewer: play an attached voice message ───────────────────────────────────
export function VoicePlayer({ voice, compact }: { voice: { url: string; duration: number }; compact?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const stopT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { if (stopT.current) clearTimeout(stopT.current); try { player.current?.remove(); } catch { /* ignore */ } };
  }, []);

  const toggle = () => {
    if (playing) { try { player.current?.pause(); } catch { /* ignore */ } setPlaying(false); if (stopT.current) clearTimeout(stopT.current); return; }
    try {
      try { player.current?.remove(); } catch { /* ignore */ }
      const p = createAudioPlayer({ uri: mediaUrl(voice.url) as string });
      player.current = p; p.play(); setPlaying(true);
      stopT.current = setTimeout(() => setPlaying(false), (voice.duration + 0.5) * 1000);
    } catch { /* ignore */ }
  };

  return (
    <Pressable testID="voice-play" style={[styles.card, compact && styles.cardCompact]} onPress={toggle}>
      <View style={styles.play}><Ionicons name={playing ? "pause" : "play"} size={18} color={colors.onBrand} /></View>
      <View style={styles.wave}>
        {Array.from({ length: compact ? 14 : 22 }).map((_, i) => (
          <View key={i} style={[styles.bar, { height: 6 + ((i * 7) % 20) }]} />
        ))}
      </View>
      <Ionicons name="mic" size={14} color={colors.brand} />
      <Text style={styles.dur}>{fmt(voice.duration)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  record: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  recordOn: { backgroundColor: "#C0392B", borderColor: "#C0392B" },
  recordText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardCompact: { backgroundColor: "rgba(20,22,28,0.6)", borderColor: "rgba(255,255,255,0.14)" },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  wave: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3, height: 26 },
  bar: { width: 3, borderRadius: 2, backgroundColor: colors.brand, opacity: 0.7 },
  dur: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
});
