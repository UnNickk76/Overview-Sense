import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { observeWorldApi, mediaUrl, WorldObservation, WorldSection } from "@/src/lib/backend";

function Badges({ badges }: { badges: WorldObservation["world_badges"] }) {
  return (
    <View style={styles.badgeRow}>
      {badges.map((b) => (
        <View key={b.key} style={[styles.badge, b.key === "verified" && styles.badgeVerified, b.key === "rare" && styles.badgeRare]}>
          {b.key === "verified" ? <Ionicons name="shield-checkmark" size={10} color={colors.success} /> : null}
          {b.key === "rare" ? <Ionicons name="diamond" size={10} color={colors.blue} /> : null}
          <Text style={[styles.badgeTxt, b.key === "verified" && { color: colors.success }, b.key === "rare" && { color: colors.blue }]}>
            {b.label}{b.value != null ? ` ${b.value}` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function ObserveWorld() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [hero, setHero] = useState<WorldObservation | null>(null);
  const [sections, setSections] = useState<WorldSection[]>([]);
  const [full, setFull] = useState<{ title: string; items: WorldObservation[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    if (section) {
      observeWorldApi.section(String(section))
        .then((r) => setFull({ title: r.title, items: r.items }))
        .catch(() => setFull({ title: "Observe World", items: [] }))
        .finally(() => setLoading(false));
    } else {
      observeWorldApi.home()
        .then((r) => { setHero(r.hero); setSections(r.sections); })
        .catch(() => setSections([]))
        .finally(() => setLoading(false));
    }
  }, [section]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = (o: WorldObservation) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/observation-detail?id=${o.id}` as never); };
  const cardW = width * 0.62;

  // --- Full section grid view ---
  if (section) {
    const cell = (width - spacing.lg * 2 - spacing.md) / 2;
    return (
      <SpaceBackground>
        <ScreenHeader title={full?.title || "Observe World™"} subtitle="Ordinate per valore di realtà" />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} testID="world-section">
          {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["3xl"] }} /> : null}
          <View style={styles.grid}>
            {full?.items.map((o) => {
              const img = mediaUrl(o.image_url);
              return (
                <Pressable key={o.id} testID={`w-${o.id}`} style={[styles.gridCard, { width: cell }]} onPress={() => open(o)}>
                  <View style={[styles.thumb, { height: cell }]}>
                    {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="planet" size={30} color={colors.onSurfaceSecondary} />}
                    <View style={styles.realityChip}><Text style={styles.realityChipTxt}>{o.reality_score}</Text></View>
                  </View>
                  <Text style={styles.gridTitle} numberOfLines={1}>{o.title || o.caption || o.category}</Text>
                  <Text style={styles.gridMeta}>@{o.nickname}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SpaceBackground>
    );
  }

  // --- Museum home ---
  return (
    <SpaceBackground>
      <ScreenHeader title="Observe World™" subtitle="Il museo vivente della realtà" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} testID="observe-world-screen">
        <View style={styles.intro}>
          <Text style={styles.introTxt}>Niente like, niente popolarità. Solo realtà osservate, promosse per <Text style={{ color: colors.brand }}>valore scientifico</Text>, rarità e verifica.</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["3xl"] }} /> : null}

        {hero ? (
          <Pressable testID="world-hero" style={styles.hero} onPress={() => open(hero)}>
            {mediaUrl(hero.image_url) ? <Image source={{ uri: mediaUrl(hero.image_url)! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroContent}>
              <View style={styles.heroTag}><Ionicons name="star" size={11} color={colors.onBrand} /><Text style={styles.heroTagTxt}>OPERA IN EVIDENZA</Text></View>
              <Text style={styles.heroTitle} numberOfLines={2}>{hero.title || hero.caption || hero.category}</Text>
              <Text style={styles.heroBy}>di @{hero.nickname}</Text>
              <Badges badges={hero.world_badges} />
            </View>
          </Pressable>
        ) : null}

        {!loading && sections.length === 0 && !hero ? (
          <View style={styles.empty}>
            <Ionicons name="earth-outline" size={44} color={colors.brand} />
            <Text style={styles.emptyText}>Il museo è in costruzione. Le osservazioni con alto valore di realtà appariranno qui.</Text>
          </View>
        ) : null}

        {sections.map((sec) => (
          <View key={sec.key} style={styles.section}>
            <Pressable style={styles.secHead} testID={`sec-${sec.key}`} onPress={() => { Haptics.selectionAsync(); router.push(`/observe-world?section=${encodeURIComponent(sec.key)}` as never); }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.secTitle}>{sec.title}</Text>
                <Text style={styles.secSub}>{sec.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceSecondary} />
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {sec.items.map((o) => {
                const img = mediaUrl(o.image_url);
                return (
                  <Pressable key={o.id} testID={`card-${o.id}`} style={[styles.hCard, { width: cardW }]} onPress={() => open(o)}>
                    <View style={[styles.hThumb, { height: cardW * 0.72 }]}>
                      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="planet" size={30} color={colors.onSurfaceSecondary} />}
                      <View style={styles.realityChip}><Ionicons name="pulse" size={10} color={colors.brand} /><Text style={styles.realityChipTxt}>{o.reality_score}</Text></View>
                    </View>
                    <Text style={styles.hTitle} numberOfLines={1}>{o.title || o.caption || o.category}</Text>
                    <Text style={styles.hBy}>@{o.nickname}</Text>
                    <Badges badges={o.world_badges.filter((b) => b.key !== "reality")} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  introTxt: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  hero: { marginHorizontal: spacing.lg, height: 260, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.tertiary, marginBottom: spacing.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heroContent: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, gap: 6 },
  heroTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "flex-start" },
  heroTagTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  heroTitle: { color: "#fff", fontFamily: fonts.bold, fontSize: type["2xl"], lineHeight: 30 },
  heroBy: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  empty: { alignItems: "center", paddingTop: spacing["2xl"], gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  section: { marginBottom: spacing.xl },
  secHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  secTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  secSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  hCard: { gap: 5 },
  hThumb: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  hBy: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  realityChip: { position: "absolute", top: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  realityChipTxt: { color: colors.brand, fontFamily: fonts.mono, fontSize: 11 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 3 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  badgeVerified: { backgroundColor: "rgba(50,215,75,0.12)" },
  badgeRare: { backgroundColor: "rgba(10,132,255,0.12)" },
  badgeTxt: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  gridCard: { gap: 5 },
  thumb: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  gridTitle: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  gridMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
});
