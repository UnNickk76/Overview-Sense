import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { SENSE_TRACKS, matchTrack, trackById, SenseTrack } from "@/src/lib/senseMatch";

// Sense Match™ — a small soundtrack bar. Auto-matches a track to the scene and
// lets the user preview/switch. All tracks are royalty-free / CC0 / public domain.
interface Props {
  hint?: string;          // scene keywords (category, layer, origin…)
  trackId?: string | null; // author's chosen track (overrides auto-match)
  onPick?: (id: string) => void;
  autoPlay?: boolean;
}

export function SenseMatchBar({ hint, trackId, onPick, autoPlay = false }: Props) {
  const [track, setTrack] = useState<SenseTrack>(() => trackById(trackId) ?? matchTrack(hint));
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const trackRef = useRef<SenseTrack>(track);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { try { playerRef.current?.remove(); } catch { /* ignore */ } playerRef.current = null; };
  }, []);

  const ensurePlayer = (t: SenseTrack) => {
    if (playerRef.current && trackRef.current.id === t.id) return playerRef.current;
    try { playerRef.current?.remove(); } catch { /* ignore */ }
    const p = createAudioPlayer(t.src);
    p.loop = true;
    p.volume = 0.9;
    playerRef.current = p;
    trackRef.current = t;
    return p;
  };

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const p = ensurePlayer(track);
    if (playing) { try { p.pause(); } catch { /* ignore */ } setPlaying(false); }
    else { try { p.play(); } catch { /* ignore */ } setPlaying(true); }
  };

  const pick = (t: SenseTrack) => {
    Haptics.selectionAsync();
    setTrack(t);
    onPick?.(t.id);
    const p = ensurePlayer(t);
    if (playing) { try { p.play(); } catch { /* ignore */ } }
  };

  useEffect(() => {
    if (autoPlay && !playing) { const p = ensurePlayer(track); try { p.play(); } catch { /* ignore */ } setPlaying(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable testID="sensematch-toggle" style={styles.playBtn} onPress={toggle}>
          <Ionicons name={playing ? "pause" : "play"} size={20} color={colors.onBrand} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.headRow}>
            <Ionicons name="musical-notes" size={12} color={colors.brand} />
            <Text style={styles.head}>SENSE MATCH™</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.license} numberOfLines={1}>{track.license}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SENSE_TRACKS.map((t) => (
          <Pressable key={t.id} testID={`sensematch-track-${t.id}`} onPress={() => pick(t)}
            style={[styles.chip, t.id === track.id && styles.chipOn]}>
            <Text style={[styles.chipText, t.id === track.id && { color: colors.onBrand }]} numberOfLines={1}>{t.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  headRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  head: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 1.5 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, marginTop: 1 },
  license: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  chip: { maxWidth: 160, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
});
