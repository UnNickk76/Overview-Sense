import React, { useCallback, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, RefreshControl,
  ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { pulseApi, mediaUrl, FeedObservation, GlobalPulse } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";

export default function PulseGlobal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pulse, setPulse] = useState<GlobalPulse | null>(null);
  const [items, setItems] = useState<FeedObservation[]>([]);
  const [participants, setParticipants] = useState(0);
  const [countries, setCountries] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = await pulseApi.globalActive().catch(() => null);
      if (active?.pulse) setPulse(active.pulse);
      if (id) {
        const r = await pulseApi.globalFeed(id);
        setItems(r.items);
        setParticipants(r.participants);
        setCountries(r.countries);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const answer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) { router.push("/login" as never); return; }
    const p = pulse;
    if (!p) { router.push("/sense-vision" as never); return; }
    const q = `pulse=${encodeURIComponent(p.id)}&gTitle=${encodeURIComponent(p.title)}&gTheme=${encodeURIComponent(p.theme)}&gPrompt=${encodeURIComponent(p.prompt)}`;
    router.push(`/sense-vision?${q}` as never);
  };

  const col = (width - spacing.lg * 2 - spacing.sm * 2) / 3;

  return (
    <SpaceBackground>
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="pg-back" hitSlop={10} style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Pulse Globale</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        <View style={styles.hero}>
          <Text style={styles.globe}>🌍</Text>
          <Text style={styles.heroTitle}>{pulse?.title ?? "Pulse Globale"}</Text>
          {pulse?.prompt ? <Text style={styles.heroPrompt}>{pulse.prompt}</Text> : null}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{participants}</Text>
              <Text style={styles.statLabel}>{participants === 1 ? "osservatore" : "osservatori"}</Text>
            </View>
            {countries > 0 ? (
              <View style={styles.stat}>
                <Text style={styles.statNum}>{countries}</Text>
                <Text style={styles.statLabel}>{countries === 1 ? "paese" : "paesi"}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.honest}>
            {participants === 0
              ? "Sii il primo osservatore al mondo a partecipare."
              : "La stessa realtà, interpretata da prospettive diverse in tutto il mondo."}
          </Text>
          <Pressable testID="pg-answer" style={styles.answerBtn} onPress={answer}>
            <Ionicons name="camera" size={18} color={colors.onBrand} />
            <Text style={styles.answerText}>Partecipa con Sense Vision</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Le osservazioni dal mondo</Text>
        {loading && items.length === 0 ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🌐</Text>
            <Text style={styles.empty}>Ancora nessuna partecipazione. Apri la sfida al mondo.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((o) => {
              const uri = mediaUrl(o.image_url);
              return (
                <Pressable key={o.id} testID={`pg-item-${o.id}`} style={[styles.gridItem, { width: col }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/observation-detail?id=${o.id}` as never); }}>
                  {uri ? <Image source={{ uri }} style={styles.gridImg} contentFit="cover" transition={150} />
                    : <View style={[styles.gridImg, styles.gridPlaceholder]}><Ionicons name="image-outline" size={20} color={colors.onSurfaceSecondary} /></View>}
                  <Text style={styles.gridNick} numberOfLines={1}>{o.nickname}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary },
  topTitle: { flex: 1, textAlign: "center", color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  hero: { alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(212,175,55,0.06)", borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.brand },
  globe: { fontSize: 48 },
  heroTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"], textAlign: "center" },
  heroPrompt: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 22 },
  statsRow: { flexDirection: "row", gap: spacing["2xl"], marginTop: spacing.sm },
  stat: { alignItems: "center" },
  statNum: { color: colors.brand, fontFamily: fonts.bold, fontSize: type["3xl"] },
  statLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  honest: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontStyle: "italic", fontSize: type.sm, textAlign: "center", marginTop: spacing.xs, lineHeight: 19 },
  answerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  answerText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridItem: { gap: 4 },
  gridImg: { width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  gridPlaceholder: { alignItems: "center", justifyContent: "center" },
  gridNick: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
  emptyWrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40 },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", paddingHorizontal: spacing.xl },
});
