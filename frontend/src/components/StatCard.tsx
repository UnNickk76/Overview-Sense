import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "./GlassCard";
import { colors, fonts, spacing, type } from "@/src/theme";

interface Props {
  label: string;
  value: string;
  unit?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  note?: string;
  accent?: string;
  testID?: string;
}

export function StatCard({ label, value, unit, icon, note, accent = colors.brand, testID }: Props) {
  return (
    <GlassCard style={styles.card} testID={testID}>
      <View style={styles.top}>
        {icon ? <Ionicons name={icon} size={16} color={accent} /> : null}
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  label: {
    color: colors.onSurfaceSecondary, fontFamily: fonts.medium,
    fontSize: type.sm, textTransform: "uppercase", letterSpacing: 0.5, flex: 1,
  },
  valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  value: { color: colors.onSurface, fontFamily: fonts.mono, fontSize: type["2xl"] },
  unit: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.base, marginBottom: 3 },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: spacing.xs },
});
