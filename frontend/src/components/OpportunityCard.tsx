import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { Opportunity, Rarity } from "@/src/lib/opportunities";

const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Comune", color: colors.onSurfaceSecondary },
  notable: { label: "Interessante", color: colors.blue },
  rare: { label: "Raro", color: colors.brand },
  exceptional: { label: "Eccezionale", color: "#FF9F0A" },
};

export function OpportunityCard({ opp, compact }: { opp: Opportunity; compact?: boolean }) {
  const router = useRouter();
  const r = RARITY[opp.rarity];
  return (
    <Pressable
      testID={`opportunity-${opp.id}`}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/opportunity?id=${opp.id}` as never); }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.top}>
        <Text style={styles.emoji}>{opp.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.overline}>{opp.layerLabel}</Text>
          <Text style={styles.title} numberOfLines={2}>{opp.title}</Text>
        </View>
        <View style={[styles.badge, { borderColor: r.color }]}>
          <Text style={[styles.badgeText, { color: r.color }]}>{r.label}</Text>
        </View>
      </View>
      {!compact ? <Text style={styles.summary} numberOfLines={3}>{opp.summary}</Text> : null}
      {(opp.bestTime || opp.direction) ? (
        <View style={styles.chips}>
          {opp.bestTime ? (
            <View style={styles.chip}>
              <Ionicons name="time-outline" size={13} color={colors.onSurfaceSecondary} />
              <Text style={styles.chipText}>{opp.bestTime}</Text>
            </View>
          ) : null}
          {opp.direction ? (
            <View style={styles.chip}>
              <Ionicons name="compass-outline" size={13} color={colors.onSurfaceSecondary} />
              <Text style={styles.chipText}>{opp.direction}</Text>
            </View>
          ) : null}
          {opp.createObservation ? (
            <View style={[styles.chip, { borderColor: colors.brand }]}>
              <Ionicons name="camera-outline" size={13} color={colors.brand} />
              <Text style={[styles.chipText, { color: colors.brand }]}>Observation</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  emoji: { fontSize: 24, marginTop: 2 },
  overline: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 3, letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: 2 },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.medium, fontSize: type.sm - 3, letterSpacing: 0.3 },
  summary: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 2 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
});
