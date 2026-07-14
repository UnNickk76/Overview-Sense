import React from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { SCALE_LEVELS } from "@/src/lib/cosmos";

function fmtMeters(m: number): string {
  if (m >= 9.4607e15) return `${(m / 9.4607e15).toLocaleString("it-IT", { maximumFractionDigits: 2 })} anni luce`;
  if (m >= 1000) return `${(m / 1000).toLocaleString("it-IT", { maximumFractionDigits: 0 })} km`;
  if (m >= 1) return `${m.toLocaleString("it-IT", { maximumFractionDigits: 2 })} m`;
  if (m >= 1e-3) return `${(m * 1e3).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mm`;
  if (m >= 1e-6) return `${(m * 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} µm`;
  if (m >= 1e-9) return `${(m * 1e9).toLocaleString("it-IT", { maximumFractionDigits: 1 })} nm`;
  return `${m.toExponential(1)} m`;
}

export default function Scale() {
  const insets = useSafeAreaInsets();
  // largest at top → smallest at bottom (zoom in as you scroll down)
  const levels = [...SCALE_LEVELS].reverse();

  return (
    <SpaceBackground>
      <ScreenHeader title="Scale" subtitle="Una vera OverView della realtà" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"] }} showsVerticalScrollIndicator={false} testID="scale-screen">
        <Text style={styles.intro}>Scorri per viaggiare tra le scale dell&apos;Universo, dai confini del cosmo fino ai limiti della materia.</Text>
        <View style={styles.line} />
        {levels.map((l, i) => {
          const isYou = l.name === "Tu";
          return (
            <Animated.View key={l.name} entering={FadeInDown.delay(i * 30)} style={styles.item}>
              <View style={styles.railCol}>
                <View style={[styles.node, isYou && styles.nodeYou]} />
                {i < levels.length - 1 ? <View style={styles.rail} /> : null}
              </View>
              <View style={[styles.card, isYou && styles.cardYou]}>
                <View style={styles.cardHead}>
                  <Text style={styles.emoji}>{l.emoji}</Text>
                  <Text style={[styles.name, isYou && { color: colors.brand }]}>{l.name}</Text>
                  <Text style={styles.size}>{fmtMeters(l.meters)}</Text>
                </View>
                <Text style={styles.note}>{l.note}</Text>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21, marginBottom: spacing.lg },
  line: { height: 1, backgroundColor: colors.divider, marginBottom: spacing.md },
  item: { flexDirection: "row", gap: spacing.md },
  railCol: { alignItems: "center", width: 18 },
  node: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.borderStrong, marginTop: spacing.lg },
  nodeYou: { backgroundColor: colors.brand, width: 16, height: 16, borderRadius: 8 },
  rail: { flex: 1, width: 2, backgroundColor: colors.divider, marginVertical: 2 },
  card: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.xs },
  cardYou: { borderColor: colors.brand, backgroundColor: colors.surfaceSecondary },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  emoji: { fontSize: 20 },
  name: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, flex: 1 },
  size: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
  note: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
});
