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
import { socialApi, mediaUrl, ActivityEvent } from "@/src/lib/backend";

const KIND_META: Record<ActivityEvent["kind"], { icon: keyof typeof Ionicons.glyphMap; color: string; verb: string }> = {
  observed: { icon: "eye", color: colors.blue, verb: "ha osservato la tua Observation" },
  discovery: { icon: "sparkles", color: colors.brand, verb: "l'ha segnata come Scoperta" },
  learned: { icon: "bulb", color: colors.brand, verb: "ha imparato dalla tua Observation" },
  comment: { icon: "chatbubble", color: colors.blue, verb: "ha commentato" },
  follow: { icon: "person-add", color: colors.brand, verb: "ha iniziato a seguirti" },
};

function relTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "ora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}g`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function Activity() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const res = await socialApi.activity();
      setItems(res.items);
    } catch { /* offline */ } finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const openEvent = (e: ActivityEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (e.kind === "follow") router.push(`/profile?id=${e.actor_id}` as never);
    else if (e.obs_id) router.push(`/observation-detail?id=${e.obs_id}` as never);
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Attività" subtitle="Chi ha reagito alle tue Observation" />
      {!user ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={54} color={colors.onSurfaceSecondary} />
          <Text style={styles.emptyTitle}>Accedi per vedere l&apos;attività</Text>
          <Pressable testID="activity-login" style={styles.cta} onPress={() => router.push("/login" as never)}>
            <Text style={styles.ctaText}>Accedi</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={54} color={colors.onSurfaceSecondary} />
          <Text style={styles.emptyTitle}>Nessuna attività per ora</Text>
          <Text style={styles.emptyText}>Quando la community reagisce alle tue Observation, lo vedrai qui.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
        >
          {items.map((e, i) => {
            const meta = KIND_META[e.kind];
            const avatar = mediaUrl(e.actor_avatar);
            return (
              <Pressable key={`${e.kind}-${e.actor_id}-${e.obs_id}-${i}`} testID={`activity-${i}`} style={styles.row} onPress={() => openEvent(e)}>
                <View style={styles.avatarWrap}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{(e.actor_nickname || "?").slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[styles.kindBadge, { backgroundColor: meta.color }]}>
                    <Ionicons name={meta.icon} size={11} color={colors.onBrand} />
                  </View>
                </View>
                <View style={styles.body}>
                  <Text style={styles.text} numberOfLines={2}>
                    <Text style={styles.nick}>{e.actor_nickname}</Text> {meta.verb}
                    {e.kind === "comment" && e.text ? <Text style={styles.comment}>: “{e.text}”</Text> : null}
                  </Text>
                  <Text style={styles.time}>{relTime(e.created_at)}</Text>
                </View>
                {e.obs_id || e.kind === "follow" ? <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <BottomNav active="activity" />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: 90 },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: spacing.sm },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.sm },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  avatarWrap: { width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.lg },
  kindBadge: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#05060A" },
  body: { flex: 1 },
  text: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  nick: { fontFamily: fonts.semibold, color: colors.onSurface },
  comment: { color: colors.onSurfaceTertiary, fontStyle: "italic" },
  time: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1, marginTop: 2 },
});
