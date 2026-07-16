import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withSequence, withTiming } from "react-native-reanimated";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { socialApi, mediaUrl, FeedObservation } from "@/src/lib/backend";
import { VoicePlayer } from "@/src/components/Voice";
import { ShareHub } from "@/src/components/ShareHub";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

export default function PulseView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [obs, setObs] = useState<FeedObservation | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const heart = useSharedValue(0);

  useEffect(() => {
    if (!id) return;
    socialApi.observation(id).then((o) => { setObs(o); setLikes(o.observed || 0); }).catch(() => {});
  }, [id]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => { try { player.current?.remove(); } catch { /* ignore */ } };
  }, []);

  const heartStyle = useAnimatedStyle(() => ({ opacity: heart.value, transform: [{ scale: 0.8 + heart.value * 0.4 }] }));

  const appreciate = useCallback(async () => {
    if (!user) { router.push("/login" as never); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    heart.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 700 }));
    try { await socialApi.interact(obs!.id, "observed"); } catch { /* revert silently */ }
  }, [user, liked, obs, router, heart]);

  const toggleAudio = useCallback(() => {
    const src = obs?.music?.audio_url;
    if (!src) return;
    if (audioOn) { try { player.current?.pause(); } catch { /* ignore */ } setAudioOn(false); return; }
    try {
      try { player.current?.remove(); } catch { /* ignore */ }
      const p = createAudioPlayer({ uri: src });
      player.current = p;
      p.seekTo(obs?.music?.start || 0);
      p.loop = true;
      p.play();
      setAudioOn(true);
    } catch { /* ignore */ }
  }, [obs, audioOn]);

  const doShare = useCallback(() => {
    setMenuOpen(false);
    setShareOpen(true);
  }, []);

  const doRepost = useCallback(async () => {
    if (!user) { router.push("/login" as never); return; }
    Haptics.selectionAsync();
    setReposted((v) => !v);
    try { await socialApi.repost(obs!.id); } catch { /* ignore */ }
  }, [user, obs, router]);

  const doSave = useCallback(async () => {
    if (!user) { router.push("/login" as never); return; }
    Haptics.selectionAsync();
    setSaved((v) => !v);
    try { await socialApi.save(obs!.id); } catch { /* ignore */ }
  }, [user, obs, router]);

  if (!obs) {
    return <View style={styles.loading}><ActivityIndicator color={colors.brand} /></View>;
  }
  const uri = mediaUrl(obs.image_url);
  const hasAudio = !!obs.music?.audio_url;

  const menuItems: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean; show?: boolean }[] = [
    { key: "observe", icon: "planet", label: "Apri Observe™", onPress: () => { setMenuOpen(false); router.push(`/observation-detail?id=${obs.id}` as never); }, show: true },
    { key: "share", icon: "share-outline", label: "Condividi", onPress: () => { setMenuOpen(false); doShare(); }, show: true },
    { key: "repost", icon: "repeat", label: "RePost", onPress: () => { doRepost(); }, active: reposted, show: true },
    { key: "like", icon: liked ? "eye" : "eye-outline", label: "Apprezza", onPress: () => { appreciate(); }, active: liked, show: true },
    { key: "audio", icon: audioOn ? "volume-high" : "volume-mute", label: audioOn ? "Audio ON" : "Audio OFF", onPress: () => { toggleAudio(); }, active: audioOn, show: hasAudio },
    { key: "save", icon: saved ? "bookmark" : "bookmark-outline", label: "Salva", onPress: () => { doSave(); }, active: saved, show: true },
  ];

  return (
    <View style={styles.root}>
      {/* Pure Sense — the photo fills the screen, no scientific panels */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} /> : null}
      </Pressable>

      {/* Close */}
      <Pressable testID="pulse-close" style={[styles.close, { top: insets.top + 8 }]} hitSlop={10} onPress={() => router.back()}>
        <Ionicons name="chevron-down" size={26} color="#fff" />
      </Pressable>

      {/* Likes — top-left, subtle transparent animation */}
      <View style={[styles.likes, { top: insets.top + 10 }]} pointerEvents="none">
        <Animated.View style={[styles.heart, heartStyle]}><Ionicons name="eye" size={40} color="rgba(212,175,55,0.9)" /></Animated.View>
        {likes > 0 ? <Text style={styles.likeCount}>{likes}</Text> : null}
      </View>

      {/* Author (minimal, transparent) */}
      <View style={[styles.author, { top: insets.top + 8 }]} pointerEvents="none">
        <Text style={styles.authorName}>{obs.nickname}</Text>
        {obs.title ? <Text style={styles.authorSub} numberOfLines={1}>{obs.title}</Text> : null}
      </View>

      {/* Voice message — the author's spoken explanation */}
      {obs.voice ? (
        <View style={[styles.voiceWrap, { bottom: insets.bottom + 92 }]}>
          <VoicePlayer voice={obs.voice} compact />
        </View>
      ) : null}

      {/* Floating transparent menu button — bottom right */}
      <View style={[styles.fabWrap, { bottom: insets.bottom + 24 }]}>
        {menuOpen ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.menu}>
            {menuItems.filter((m) => m.show !== false).map((m) => (
              <Pressable key={m.key} testID={`pulse-menu-${m.key}`} style={styles.menuItem} onPress={m.onPress}>
                <Ionicons name={m.icon} size={20} color={m.active ? colors.brand : "#fff"} />
                <Text style={[styles.menuText, m.active && { color: colors.brand }]}>{m.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}
        <Pressable testID="pulse-fab" style={styles.fab} onPress={() => { Haptics.selectionAsync(); setMenuOpen((v) => !v); }}>
          <Ionicons name={menuOpen ? "close" : "ellipsis-horizontal"} size={24} color="#fff" />
        </Pressable>
      </View>

      {shareOpen ? <ShareHub obs={obs} reposted={reposted} onReposted={setReposted} onClose={() => setShareOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  loading: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", right: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  likes: { position: "absolute", left: spacing.lg, flexDirection: "row", alignItems: "center", gap: 6 },
  heart: { },
  likeCount: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.semibold, fontSize: type.base },
  author: { position: "absolute", left: spacing.lg + 56, right: 60 },
  authorName: { color: "#fff", fontFamily: fonts.bold, fontSize: type.base, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  authorSub: { color: "rgba(255,255,255,0.8)", fontFamily: fonts.regular, fontSize: type.sm, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  fabWrap: { position: "absolute", right: spacing.lg, alignItems: "flex-end", gap: spacing.sm },
  voiceWrap: { position: "absolute", left: spacing.lg, right: 88 },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(20,22,28,0.55)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.5)", alignItems: "center", justifyContent: "center" },
  menu: { backgroundColor: "rgba(16,18,24,0.82)", borderRadius: radius.lg, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)", minWidth: 190 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  menuText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.base },
});
