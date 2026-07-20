import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, ScrollView, FlatList, ViewToken, ActivityIndicator, Pressable, RefreshControl, Modal, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ObservationCard } from "@/src/components/ObservationCard";
import { BottomNav } from "@/src/components/BottomNav";
import { LiveEarth } from "@/src/components/LiveEarth";
import { VerifiedEvents } from "@/src/components/VerifiedEvents";
import { SenseMark } from "@/src/components/SenseMark";
import { BrandName } from "@/src/components/Brand";
import { SnapSenseBar } from "@/src/components/SnapSenseBar";
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
  const observer = useObserver();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [scope, setScope] = useState("smart");
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<FeedObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [earthFull, setEarthFull] = useState(false);

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

  // ---- "Seen ≥3s" tracking: report observations the viewer actually dwelled on
  // (>=3s, >=60% visible) so the backend won't uselessly re-propose them. ----
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const seenBuffer = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSeen = useCallback(() => {
    const ids = Array.from(seenBuffer.current);
    seenBuffer.current.clear();
    if (!ids.length || !userRef.current) return;
    socialApi.markSeen(ids.map((id) => ({ id, dwell_ms: 3000 }))).catch(() => {});
  }, []);
  useEffect(() => () => { if (flushTimer.current) clearTimeout(flushTimer.current); flushSeen(); }, [flushSeen]);
  const viewabilityPairs = useRef([{
    viewabilityConfig: { itemVisiblePercentThreshold: 60, minimumViewTime: 3000 },
    onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const vt of viewableItems) {
        const id = (vt.item as FeedObservation | undefined)?.id;
        if (vt.isViewable && id) seenBuffer.current.add(id);
      }
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flushSeen, 1500);
    },
  }]);

  return (
    <SpaceBackground>
      {/* Top bar — Observe: the social flow of real observations */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.brandRow}>
          <SenseMark size={30} />
          <View>
            <BrandName name="Observe" style={styles.headerTitle} />
            <Text style={styles.headerSubtitle}>Cosa sta osservando il mondo, ora.</Text>
          </View>
        </View>
        <View style={styles.topActions}>
          <Pressable testID="feed-discover" hitSlop={10} style={styles.topActivity}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(user ? "/discover-people" as never : "/login" as never); }}>
            <Ionicons name="people-outline" size={24} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="feed-activity" hitSlop={10} style={styles.topActivity}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(user ? "/activity" as never : "/login" as never); }}>
            <Ionicons name="notifications-outline" size={24} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      {/* Pinned, always-alive Live Earth — the pulsing heart of OverView */}
      <View style={styles.pinnedEarth}>
        <LiveEarth variant="compact" size={132} onExpand={() => setEarthFull(true)} />
      </View>

      {/* SnapSense™ — 24h ephemeral stories */}
      <SnapSenseBar />

      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <ObservationCard obs={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
        viewabilityConfigCallbackPairs={viewabilityPairs.current}
        ListHeaderComponent={
          scope === "smart" && !category ? (
            <View style={{ gap: spacing.lg, marginBottom: spacing.lg }}>
              <Pressable testID="observe-world-entry" style={styles.worldBanner} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/observe-world" as never); }}>
                <View style={styles.worldIcon}><Ionicons name="earth" size={22} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.worldTitle}>Observe World™</Text>
                  <Text style={styles.worldSub}>Il museo vivente della realtà — niente like, solo valore</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceSecondary} />
              </Pressable>
              <VerifiedEvents />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["2xl"] }} />
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="planet-outline" size={40} color={colors.onSurfaceSecondary} />
              <Text style={styles.empty}>Ancora nessun Sense qui. Tocca “Make a Sense” e sii il primo a mostrare al mondo cosa stai osservando.</Text>
            </View>
          )
        }
      />

      <BottomNav active="feed" />

      {/* Full-screen Live Earth — the world navigation map + all filters */}
      <Modal visible={earthFull} animationType="slide" onRequestClose={() => setEarthFull(false)}>
        <SpaceBackground>
          <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>🌍 Live Earth</Text>
              <Text style={styles.headerSubtitle}>La mappa viva del mondo osservato</Text>
            </View>
            <Pressable testID="earth-close" style={styles.iconBtn} hitSlop={8} onPress={() => setEarthFull(false)}>
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
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
            <LiveEarth variant="full" size={Math.min(width - spacing.lg * 2, 340)} />
          </ScrollView>
        </SpaceBackground>
      </Modal>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  brandRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  topActivity: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  topActions: { flexDirection: "row", alignItems: "center" },
  pinnedEarth: { alignItems: "center", paddingBottom: spacing.sm },
  fab: { position: "absolute", right: spacing.lg, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  headerTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base + 1 },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm },
  headerSubtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2 },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  chipTextActive: { color: colors.onBrand },
  emptyWrap: { alignItems: "center", gap: spacing.md, marginTop: spacing["3xl"], paddingHorizontal: spacing.xl },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  worldBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  worldIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.1)" },
  worldTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  worldSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
});
