import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, TextInput, Pressable, FlatList, RefreshControl, ActivityIndicator, useWindowDimensions, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { BottomNav } from "@/src/components/BottomNav";
import { SenseQuickView } from "@/src/components/SenseQuickView";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { socialApi, FeedObservation, mediaUrl } from "@/src/lib/backend";

const COLS = 5;
const SUGGESTIONS = ["tramonti", "Luna", "costellazioni", "montagne di notte", "fenomeni atmosferici", "vicino Roma", "osservazioni rare questa settimana"];

export default function Search() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<FeedObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [quick, setQuick] = useState<number | null>(null);
  const seq = useRef(0);

  const gap = 2;
  const cell = Math.floor((width - gap * (COLS - 1)) / COLS);

  const run = useCallback(async (query: string, mode: "replace" | "refresh" | "more") => {
    const id = ++seq.current;
    if (mode === "replace") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode === "more") setLoadingMore(true);
    try {
      const offset = mode === "more" ? items.length : 0;
      const r = await socialApi.search(query, offset, 30);
      if (id !== seq.current) return;
      setItems((prev) => (mode === "more" ? [...prev, ...r.items] : r.items));
      setHasMore(r.has_more);
    } catch { if (id === seq.current) { if (mode !== "more") setItems([]); setHasMore(false); } }
    finally {
      if (id === seq.current) { setLoading(false); setRefreshing(false); setLoadingMore(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Debounced search as the user types (and initial Explore load with empty q).
  useEffect(() => {
    const t = setTimeout(() => run(q.trim(), "replace"), q.trim() ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <SpaceBackground>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.onSurfaceSecondary} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder="Cerca Sense, luoghi, oggetti, o scrivi una frase…"
            placeholderTextColor={colors.onSurfaceSecondary}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {q.length > 0 ? (
            <Pressable hitSlop={10} testID="search-clear" onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          ) : null}
        </View>
        {q.trim().length === 0 ? (
          <FlatList
            horizontal
            data={SUGGESTIONS}
            keyExtractor={(s) => s}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.sm }}
            renderItem={({ item }) => (
              <Pressable testID={`sugg-${item}`} style={styles.chip} onPress={() => { Haptics.selectionAsync(); setQ(item); }}>
                <Text style={styles.chipText}>{item}</Text>
              </Pressable>
            )}
          />
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          key={COLS}
          numColumns={COLS}
          keyExtractor={(it) => it.id}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ gap, paddingBottom: insets.bottom + 96 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => run(q.trim(), "refresh")} tintColor={colors.brand} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (hasMore && !loadingMore) run(q.trim(), "more"); }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="telescope-outline" size={40} color={colors.onSurfaceSecondary} />
              <Text style={styles.emptyText}>Nessun Sense trovato per «{q.trim()}».</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.lg }} /> : null}
          renderItem={({ item, index }) => {
            const uri = mediaUrl(item.image_url);
            return (
              <Pressable testID={`grid-${item.id}`} style={{ width: cell, height: cell }}
                onPress={() => { Haptics.selectionAsync(); setQuick(index); }}>
                {uri ? <Image source={{ uri }} style={{ width: cell, height: cell }} contentFit="cover" transition={120} />
                  : <View style={[styles.ph, { width: cell, height: cell }]}><Ionicons name="image" size={20} color={colors.onSurfaceSecondary} /></View>}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={quick !== null} animationType="fade" onRequestClose={() => setQuick(null)}>
        {quick !== null ? (
          <SenseQuickView
            items={items}
            index={quick}
            onClose={() => setQuick(null)}
            onOpenFull={(id) => { setQuick(null); router.push(`/observation-detail?id=${id}` as never); }}
          />
        ) : null}
      </Modal>

      <BottomNav active="search" />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, padding: 0 },
  chip: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: type.sm },
  ph: { backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: spacing.md, paddingTop: spacing["3xl"] ?? 48, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center" },
});
