import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { BottomNav } from "@/src/components/BottomNav";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { dmApi, mediaUrl, Conversation } from "@/src/lib/backend";

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "ora";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}g`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function Messages() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try { const r = await dmApi.list(); setItems(r.items); }
    catch { /* offline */ } finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <SpaceBackground>
      <ScreenHeader title="Messaggi" subtitle="Direct Message" />
      {!user ? (
        <View style={styles.center}>
          <Ionicons name="chatbubble-ellipses-outline" size={54} color={colors.onSurfaceSecondary} />
          <Text style={styles.emptyTitle}>Accedi per i messaggi</Text>
          <Pressable testID="dm-login" style={styles.cta} onPress={() => router.push("/login" as never)}>
            <Text style={styles.ctaText}>Accedi</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubble-ellipses-outline" size={54} color={colors.onSurfaceSecondary} />
          <Text style={styles.emptyTitle}>Nessuna conversazione</Text>
          <Text style={styles.emptyText}>Apri il profilo di un esploratore e tocca “Messaggio” per iniziare a condividere Senshot e osservazioni.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 110, gap: spacing.xs }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
        >
          {items.map((c) => {
            const avatar = mediaUrl(c.other.avatar);
            return (
              <Pressable key={c.id} testID={`conv-${c.id}`} style={styles.row}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/chat?id=${c.id}&name=${encodeURIComponent(c.other.display_name || c.other.nickname)}&avatar=${encodeURIComponent(c.other.avatar || "")}` as never); }}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{(c.other.nickname || "?").slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>{c.other.display_name || c.other.nickname}</Text>
                  <Text style={[styles.preview, c.unread > 0 && styles.previewUnread]} numberOfLines={1}>{c.last_message || "Nuova conversazione"}</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.time}>{relTime(c.last_at)}</Text>
                  {c.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{c.unread}</Text></View> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <BottomNav active="dm" />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: 90 },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.xl },
  body: { flex: 1, gap: 2 },
  name: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  preview: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  previewUnread: { color: colors.onSurface, fontFamily: fonts.medium },
  meta: { alignItems: "flex-end", gap: 5 },
  time: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  badge: { backgroundColor: colors.brand, minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm - 2 },
});
