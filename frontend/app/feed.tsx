import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ObservationCard } from "@/src/components/ObservationCard";
import { LiveEarth } from "@/src/components/LiveEarth";
import { VerifiedEvents } from "@/src/components/VerifiedEvents";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { socialApi, FeedObservation, FeedFilters } from "@/src/lib/backend";
import { useObserver } from "@/src/hooks/useObserver";
import { useAuth } from "@/src/context/AuthContext";

type Chip = { key: string; label: string; apply: (base: FeedFilters, obs: { lat: number; lon: number; ok: boolean }) => FeedFilters };

const SCOPE: Chip[] = [
  { key: "smart", label: "Tutte", apply: (b) => ({ ...b, sort: "smart", window: undefined, following: undefined, lat: undefined, lon: undefined }) },
  { key: "following", label: "Chi seguo", apply: (b) => ({ ...b, following: true }) },
  { key: "nearby", label: "Vicinanze", apply: (b, o) => (o.ok ? { ...b, lat: o.lat, lon: o.lon } : b) },
  { key: "today", label: "Oggi", apply: (b) => ({ ...b, window: "today" }) },
  { key: "week", label: "Settimana", apply: (b) => ({ ...b, window: "week" }) },
  { key: "recent", label: "Più recenti", apply: (b) => ({ ...b, sort: "recent" }) },
  { key: "observed", label: "Più Observed", apply: (b) => ({ ...b, sort: "observed" }) },
  { key: "discovery", label: "Più Discovery", apply: (b) => ({ ...b, sort: "discovery" }) },
  { key: "learned", label: "Più Learned", apply: (b) => ({ ...b, sort: "learned" }) },
  { key: "scientific", label: "Scientific Value", apply: (b) => ({ ...b, sort: "scientific" }) },
  { key: "img", label: "Solo foto", apply: (b) => ({ ...b, media_type: "image" }) },
  { key: "listening", label: "Listening", apply: (b) => ({ ...b, source: "listening" }) },
];

const CATEGORIES = ["Astronomia", "Atmosfera", "Meteo", "Sole", "Luna", "Pianeti", "Costellazioni", "Via Lattea", "ISS", "Satelliti", "Aurore", "Campo magnetico"];

export default function Feed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const observer = useObserver();
  const { user } = useAuth();
  const [scope, setScope] = useState("smart");
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<FeedObservation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let f: FeedFilters = { sort: "smart" };
    const chip = SCOPE.find((c) => c.key === scope);
    if (chip) f = chip.apply(f, { lat: observer.lat, lon: observer.lon, ok: observer.status === "granted" });
    if (category) f.category = category;
    try {
      const res = await socialApi.feed(f);
      setItems(res.items);
      // Track the newest observation seen so Home can flag new discoveries.
      const newest = res.items.reduce((acc, o) => (o.created_at > acc ? o.created_at : acc), "");
      if (newest) await AsyncStorage.setItem("osu_last_seen", newest);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [scope, category, observer.lat, observer.lon, observer.status]);

  useEffect(() => { load(); }, [load]);

  return (
    <SpaceBackground>
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="feed-back" style={styles.iconBtn} hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>🌍 Overview Sense Universe™</Text>
          <Text style={styles.headerSubtitle}>The social universe of real discoveries.</Text>
        </View>
        <Pressable testID="feed-profile" style={styles.iconBtn} hitSlop={10}
          onPress={() => router.push(user ? `/profile?id=${user.id}` as never : "/login" as never)}>
          <Ionicons name="person-circle-outline" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SCOPE.map((c) => (
            <Pressable key={c.key} testID={`feed-scope-${c.key}`} onPress={() => setScope(c.key)}
              style={[styles.chip, scope === c.key && styles.chipActive]}>
              <Text style={[styles.chipText, scope === c.key && styles.chipTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setCategory(null)} style={[styles.chip, !category && styles.chipActive]}>
            <Text style={[styles.chipText, !category && styles.chipTextActive]}>Tutti i fenomeni</Text>
          </Pressable>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`feed-cat-${c}`} onPress={() => setCategory(category === c ? null : c)}
              style={[styles.chip, category === c && styles.chipActive]}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {scope === "smart" && !category ? (
          <>
            <LiveEarth />
            <VerifiedEvents />
          </>
        ) : null}
        {loading && items.length === 0 ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["2xl"] }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="planet-outline" size={40} color={colors.onSurfaceSecondary} />
            <Text style={styles.empty}>Nessuna Observation con questi filtri. Sii il primo a condividerne una dalla fotocamera Cielo.</Text>
          </View>
        ) : (
          items.map((o) => <ObservationCard key={o.id} obs={o} />)
        )}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base + 1, textAlign: "center" },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm },
  headerSubtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2, textAlign: "center" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  chipTextActive: { color: colors.onBrand },
  emptyWrap: { alignItems: "center", gap: spacing.md, marginTop: spacing["3xl"], paddingHorizontal: spacing.xl },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
});
