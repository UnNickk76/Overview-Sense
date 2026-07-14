import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { listObservations, Observation } from "@/src/lib/gallery";
import { useOpportunities } from "@/src/hooks/useOpportunities";
import { SenseMark } from "@/src/components/SenseMark";

const CARD_HEIGHT = 224;

// Two compact, side-by-side signature cards: Sense Vision + Today's Opportunities.
export function HomeTopCards() {
  const router = useRouter();
  const { all } = useOpportunities();
  const [last, setLast] = useState<Observation | null>(null);
  const top = all.slice(0, 4);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listObservations()
        .then((list) => { if (alive) setLast(list.find((o) => o.kind === "image") ?? null); })
        .catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  const makeSense = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/sense-vision" as never); };
  const openToday = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/today" as never); };

  return (
    <View style={styles.row}>
      {/* Sense Vision */}
      <Pressable testID="make-a-sense-home" style={styles.senseCard} onPress={makeSense}>
        {last ? (
          <Image source={{ uri: last.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tertiary }]} />
        )}
        <LinearGradient colors={["rgba(0,0,0,0.10)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.9)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.senseContent}>
          <View style={styles.badge}>
            <SenseMark size={13} />
            <Text style={styles.badgeText}>SENSE VISION™</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.slogan}>Rivela l&apos;invisibile.</Text>
          <View style={styles.senseBtn}>
            <SenseMark size={18} />
            <Text style={styles.senseBtnText}>MAKE A SENSE</Text>
          </View>
        </View>
      </Pressable>

      {/* Today's Opportunities */}
      <Pressable testID="today-opportunities-card" style={styles.todayCard} onPress={openToday}>
        <View style={styles.todayHead}>
          <Ionicons name="sparkles" size={14} color={colors.brand} />
          <Text style={styles.todayTitle}>OGGI</Text>
        </View>
        {top.length > 0 ? (
          <>
            <Text style={styles.count}>{all.length} opportunità</Text>
            <View style={styles.list}>
              {top.map((o) => (
                <View key={o.id} style={styles.item}>
                  <Text style={styles.itemEmoji}>{o.emoji}</Text>
                  <Text style={styles.itemText} numberOfLines={1}>{o.title}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.count}>Attiva la posizione per il briefing di oggi.</Text>
        )}
        <View style={{ flex: 1 }} />
        <View style={styles.todayFoot}>
          <Text style={styles.seeAll}>Vedi tutte</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.brand} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.xl },
  senseCard: { flex: 1, height: CARD_HEIGHT, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.brand },
  senseContent: { flex: 1, padding: spacing.md },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  badgeText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 1 },
  slogan: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.lg, lineHeight: 20, marginBottom: spacing.sm },
  senseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: spacing.sm },
  senseBtnText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm - 1, letterSpacing: 0.5 },
  todayCard: { flex: 1, height: CARD_HEIGHT, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  todayHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  todayTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 1.5 },
  count: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, marginTop: 4 },
  list: { gap: 7, marginTop: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: 7 },
  itemEmoji: { fontSize: 13 },
  itemText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm, flex: 1 },
  todayFoot: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3 },
  seeAll: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 1 },
});
