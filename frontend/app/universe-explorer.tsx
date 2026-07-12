import React, { useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { COSMIC_OBJECTS, formatDistanceKm, CosmicObject, ObjType } from "@/src/lib/cosmos";

const FILTERS: { key: ObjType | "all"; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "planet", label: "Pianeti" },
  { key: "star", label: "Stelle" },
  { key: "galaxy", label: "Galassie" },
  { key: "nebula", label: "Nebulose" },
  { key: "blackhole", label: "Buchi neri" },
  { key: "comet", label: "Comete" },
  { key: "spacecraft", label: "Missioni" },
];

export default function UniverseExplorer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<ObjType | "all">("all");
  const objects = filter === "all" ? COSMIC_OBJECTS : COSMIC_OBJECTS.filter((o) => o.type === filter);

  return (
    <SpaceBackground>
      <ScreenHeader title="Universe Explorer" subtitle="Non limitarti a guardare l'Universo. Esploralo." />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="universe-explorer">
        <Pressable testID="open-scale" style={styles.scaleCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/scale" as never); }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scaleOverline}>SCALE</Text>
            <Text style={styles.scaleTitle}>Viaggia tra le scale della realtà</Text>
            <Text style={styles.scaleSub}>Dal quark all&apos;Universo osservabile, senza interruzioni.</Text>
          </View>
          <Ionicons name="resize" size={30} color={colors.brand} />
        </Pressable>

        <Text style={styles.sectionLabel}>OGGETTI DELL&apos;UNIVERSO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ gap: spacing.md }}>
          {objects.map((o, i) => <ObjectRow key={o.id} obj={o} index={i} />)}
        </View>
      </ScrollView>
    </SpaceBackground>
  );
}

function ObjectRow({ obj, index }: { obj: CosmicObject; index: number }) {
  const router = useRouter();
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify().damping(18)}>
      <Pressable testID={`cosmic-${obj.id}`} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/cosmic-object?id=${obj.id}` as never); }}>
        <Text style={styles.rowEmoji}>{obj.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>{obj.name}</Text>
          <Text style={styles.rowMeta}>{obj.distanceLabel ?? formatDistanceKm(obj.distanceKm)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scaleCard: { flexDirection: "row", alignItems: "center", gap: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.brand },
  scaleOverline: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 2 },
  scaleTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: 2 },
  scaleSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2 },
  sectionLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 1.5 },
  chip: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  chipTextActive: { color: colors.onBrand },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowEmoji: { fontSize: 26 },
  rowName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  rowMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm, marginTop: 1 },
});
