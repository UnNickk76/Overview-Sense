import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { MusicRef } from "@/src/lib/music";
import { musicApi } from "@/src/lib/music";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

// Plays the AUTHOR-CHOSEN track (trimmed segment). No auto-assignment: if the
// author picked no music, nothing renders. Gracefully handles removed tracks.
export function PublishedMusic({ music }: { music: MusicRef }) {
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const stopT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      if (stopT.current) clearTimeout(stopT.current);
      try { player.current?.remove(); } catch { /* ignore */ }
    };
  }, []);

  const stop = () => {
    if (stopT.current) { clearTimeout(stopT.current); stopT.current = null; }
    try { player.current?.pause(); } catch { /* ignore */ }
    setPlaying(false);
  };

  const resolveUrl = async (): Promise<string | null> => {
    if (music.audio_url) return music.audio_url;
    if (music.provider && music.provider_track_id) {
      try {
        const r = await musicApi.track(music.provider, music.provider_track_id);
        if (r.available && r.track?.audio_url) return r.track.audio_url;
      } catch { /* ignore */ }
    }
    return null;
  };

  const toggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playing) { stop(); return; }
    const url = await resolveUrl();
    if (!url) { setUnavailable(true); return; }
    try {
      try { player.current?.remove(); } catch { /* ignore */ }
      const p = createAudioPlayer({ uri: url });
      player.current = p;
      p.seekTo(music.start || 0);
      p.play();
      setPlaying(true);
      stopT.current = setTimeout(stop, (music.duration || 15) * 1000);
    } catch { setUnavailable(true); }
  };

  return (
    <View style={styles.wrap}>
      <Pressable testID="published-music" style={styles.bar} onPress={toggle} disabled={unavailable}>
        {music.cover_url ? <Image source={{ uri: music.cover_url }} style={styles.cover} contentFit="cover" /> : <View style={[styles.cover, styles.empty]}><Ionicons name="musical-notes" size={16} color={colors.brand} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{music.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{unavailable ? "Brano non più disponibile" : music.artist}</Text>
        </View>
        {!unavailable ? (
          <View style={styles.play}><Ionicons name={playing ? "pause" : "play"} size={16} color={colors.onBrand} /></View>
        ) : <Ionicons name="alert-circle-outline" size={20} color={colors.onSurfaceSecondary} />}
      </Pressable>
      {music.license_url ? (
        <Pressable hitSlop={6} onPress={() => Linking.openURL(music.license_url as string)}>
          <Text style={styles.license}>Creative Commons · {music.provider === "jamendo" ? "Jamendo" : music.provider} · licenza</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: 4 },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cover: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceTertiary },
  empty: { alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  artist: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  play: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  license: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 3, marginLeft: 4 },
});
