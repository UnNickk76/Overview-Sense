import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { GEO_LEVELS } from "@/src/lib/geoPrivacy";
import type { GeoPrecision } from "@/src/lib/backend";

interface Props {
  value: GeoPrecision;
  onChange: (v: GeoPrecision) => void;
  suggested?: GeoPrecision | null;   // auto-protection recommendation
  reason?: string | null;            // why it's suggested
}

// Reusable 4-level location sharing selector (publish + post-publish edit).
export function GeoPrivacyPicker({ value, onChange, suggested, reason }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Condivisione della posizione</Text>
      <Text style={styles.sub}>Go There™ permette agli altri di vivere il tuo punto di vista. Scegli quanta posizione condividere.</Text>
      {suggested && reason ? (
        <View style={styles.protect}>
          <Ionicons name="shield-checkmark" size={15} color={colors.brand} />
          <Text style={styles.protectText}>{reason}</Text>
        </View>
      ) : null}
      {GEO_LEVELS.map((lvl) => {
        const on = value === lvl.key;
        const isSug = suggested === lvl.key;
        return (
          <Pressable key={lvl.key} testID={`geo-${lvl.key}`} onPress={() => { Haptics.selectionAsync(); onChange(lvl.key); }}
            style={[styles.row, on && styles.rowOn]}>
            <Text style={styles.emoji}>{lvl.emoji}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.rowHead}>
                <Text style={[styles.label, on && { color: colors.brand }]}>{lvl.label}</Text>
                {isSug ? <View style={styles.sugTag}><Text style={styles.sugTagText}>Consigliato</Text></View> : null}
              </View>
              <Text style={styles.desc}>{lvl.desc}</Text>
            </View>
            <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.brand : colors.onSurfaceSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17 },
  protect: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: "rgba(212,175,55,0.10)", borderRadius: radius.sm, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  protectText: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowOn: { borderColor: colors.brand },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  emoji: { fontSize: 20 },
  label: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  desc: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 16, marginTop: 1 },
  sugTag: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  sugTagText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm - 3 },
});
