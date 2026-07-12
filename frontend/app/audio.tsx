import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useMagnetometer } from "@/src/hooks/useSensors";
import { api, SpaceWeather } from "@/src/lib/api";
import { nf } from "@/src/lib/format";

const NOTE_SOURCES = [
  require("@/assets/audio/n0.wav"),
  require("@/assets/audio/n1.wav"),
  require("@/assets/audio/n2.wav"),
  require("@/assets/audio/n3.wav"),
  require("@/assets/audio/n4.wav"),
  require("@/assets/audio/n5.wav"),
  require("@/assets/audio/n6.wav"),
  require("@/assets/audio/n7.wav"),
];
const NOTE_NAMES = ["A3", "C4", "D4", "E4", "G4", "A4", "C5", "E5"];

type Mode = "mag" | "solar";

function Bar({ active }: { active: boolean }) {
  const h = useSharedValue(6);
  useEffect(() => { h.value = withTiming(active ? 60 : 10, { duration: 300 }); }, [active, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, style, { backgroundColor: active ? colors.brand : colors.tertiary }]} />;
}

export default function AudioModule() {
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<Mode>("mag");
  const [note, setNote] = useState(0);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const players = useRef<AudioPlayer[]>([]);
  const mag = useMagnetometer(playing && mode === "mag", 200);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    players.current = NOTE_SOURCES.map((src) => {
      const p = createAudioPlayer(src);
      p.loop = true;
      p.volume = 0;
      return p;
    });
    return () => { players.current.forEach((p) => p.release()); };
  }, []);

  useEffect(() => {
    if (mode === "solar") api.spaceWeather().then(setSpace).catch(() => {});
  }, [mode]);

  // derive target note from data
  const targetNote = useMemo(() => {
    if (mode === "mag") {
      const pct = Math.max(0, Math.min(1, (mag.magnitude - 20) / 60));
      return Math.min(7, Math.floor(pct * 8));
    }
    const kp = space?.kp_index?.value ?? 0;
    return Math.min(7, Math.floor((kp / 9) * 8));
  }, [mode, mag.magnitude, space]);

  useEffect(() => {
    if (!playing) return;
    if (targetNote !== note) {
      setNote(targetNote);
      Haptics.selectionAsync();
    }
  }, [targetNote, playing, note]);

  useEffect(() => {
    if (!players.current.length) return;
    players.current.forEach((p, i) => {
      p.volume = playing && i === note ? 0.6 : 0;
    });
  }, [note, playing]);

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (playing) {
      players.current.forEach((p) => p.pause());
      setPlaying(false);
    } else {
      players.current.forEach((p) => { p.play(); p.volume = 0; });
      players.current[note] && (players.current[note].volume = 0.6);
      setPlaying(true);
    }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Sonificazione" subtitle="Ascolta i dati reali" />
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.segment}>
          {(["mag", "solar"] as const).map((m) => (
            <Pressable key={m} testID={`mode-${m}`} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segActive]}>
              <Text style={[styles.segText, mode === m && styles.segTextActive]}>{m === "mag" ? "Campo magnetico" : "Attività solare"}</Text>
            </Pressable>
          ))}
        </View>

        <GlassCard testID="sonification-card" style={{ flex: 1, justifyContent: "space-between" }}>
          <View>
            <Text style={styles.desc}>
              {mode === "mag"
                ? "Il campo magnetico misurato dal tuo dispositivo viene tradotto in note: più intenso è il campo, più alta è la nota."
                : "L'indice geomagnetico Kp (NOAA) diventa suono: cieli tranquilli suonano gravi, le tempeste geomagnetiche suonano acute."}
            </Text>
            <Text style={styles.reading}>
              {mode === "mag"
                ? `${nf(mag.magnitude, 1)} µT`
                : space?.kp_index?.available ? `Kp ${nf(space.kp_index.value ?? 0, 1)}` : "Kp n/d"}
            </Text>
          </View>

          <View style={styles.bars}>
            {NOTE_NAMES.map((n, i) => (
              <View key={n} style={styles.barCol}>
                <Bar active={playing && i === note} />
                <Text style={[styles.barLabel, i === note && playing && { color: colors.brand }]}>{n}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.nowPlaying}>
            {playing ? `Sta suonando: ${NOTE_NAMES[note]}` : "In pausa"}
          </Text>
        </GlassCard>

        <Pressable testID="play-toggle" style={[styles.playBtn, playing && styles.playBtnActive]} onPress={toggle}>
          <Ionicons name={playing ? "pause" : "play"} size={26} color={playing ? colors.onSurface : colors.onBrand} />
          <Text style={[styles.playText, playing && { color: colors.onSurface }]}>{playing ? "Ferma" : "Ascolta"}</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Questa è una sonificazione: i suoni sono generati a partire da dati reali, non sono registrazioni di onde. Muovi il telefono vicino a un oggetto metallico per sentire cambiare la nota.
        </Text>
      </View>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: colors.tertiary, borderRadius: 999, padding: 4 },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 999, alignItems: "center" },
  segActive: { backgroundColor: colors.brand },
  segText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.base },
  segTextActive: { color: colors.onBrand },
  desc: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  reading: { color: colors.onSurface, fontFamily: fonts.mono, fontSize: type["3xl"], marginTop: spacing.lg },
  bars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 90, marginVertical: spacing.lg },
  barCol: { alignItems: "center", gap: spacing.xs },
  bar: { width: 18, borderRadius: 6 },
  barLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  nowPlaying: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.base, textAlign: "center" },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.lg },
  playBtnActive: { backgroundColor: colors.tertiary, borderWidth: 1, borderColor: colors.borderStrong },
  playText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  disclaimer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.6 },
});
