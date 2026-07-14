import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, type } from "@/src/theme";
import { FeedObservation, socialApi } from "@/src/lib/backend";
import { BASE } from "@/src/lib/client";
import { useAuth } from "@/src/context/AuthContext";

export function ActionBar({ obs, onComment }: { obs: FeedObservation; onComment?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(obs.my_saved);
  const [savesCount, setSavesCount] = useState(obs.saves_count);
  const [reposts, setReposts] = useState(obs.repost_count);
  const [reposted, setReposted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const requireAuth = () => { if (!user) { router.push("/login" as never); return false; } return true; };

  const onSave = async () => {
    if (!requireAuth() || busy) return;
    setBusy("save"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { const r = await socialApi.save(obs.id); setSaved(r.saved); setSavesCount((c) => c + (r.saved ? 1 : -1)); }
    catch { /* ignore */ } finally { setBusy(null); }
  };
  const onRepost = async () => {
    if (!requireAuth() || busy) return;
    setBusy("repost"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { const r = await socialApi.repost(obs.id); setReposted(r.reposted); setReposts((c) => c + (r.reposted ? 1 : -1)); }
    catch { /* ignore */ } finally { setBusy(null); }
  };
  const onShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = `${BASE}/api/observations/${obs.id}`;
    try {
      await Share.share({
        message: `${obs.category} · Scientific Value ${obs.scientific_value}\n${obs.caption || "Un'Observation su OverView"}\n${url}`,
      });
    } catch { /* ignore */ }
  };

  return (
    <View style={styles.row}>
      <Pressable testID={`action-comment-${obs.id}`} style={styles.item} onPress={onComment}>
        <Ionicons name="chatbubble-outline" size={18} color={colors.onSurfaceSecondary} />
        <Text style={styles.count}>{obs.comments_count}</Text>
      </Pressable>
      <Pressable testID={`action-repost-${obs.id}`} style={styles.item} onPress={onRepost}>
        <Ionicons name="repeat" size={20} color={reposted ? "#32D74B" : colors.onSurfaceSecondary} />
        <Text style={[styles.count, reposted && { color: "#32D74B" }]}>{reposts}</Text>
      </Pressable>
      <Pressable testID={`action-save-${obs.id}`} style={styles.item} onPress={onSave}>
        <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={saved ? colors.brand : colors.onSurfaceSecondary} />
        <Text style={[styles.count, saved && { color: colors.brand }]}>{savesCount}</Text>
      </Pressable>
      <Pressable testID={`action-share-${obs.id}`} style={styles.item} onPress={onShare}>
        <Ionicons name="share-outline" size={18} color={colors.onSurfaceSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xl, flexWrap: "wrap" },
  item: { flexDirection: "row", alignItems: "center", gap: 5 },
  count: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
});
