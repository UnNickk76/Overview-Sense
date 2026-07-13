import React from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { SENSE_LAYER_META, layerMeta } from "@/src/lib/senseLayers";
import { SenseMark } from "@/src/components/SenseMark";
import type { SenseVisualLayer } from "@/src/components/SenseCanvas";

interface Props {
  value: SenseVisualLayer;
  onChange: (v: SenseVisualLayer) => void;
  compact?: boolean;
  recommended?: SenseVisualLayer[];
}

// The universal Sense Vision toggle — reused wherever the app creates an image.
export function SenseLayerBar({ value, onChange, compact, recommended }: Props) {
  const active = layerMeta(value);
  return (
    <View style={styles.wrap}>
      {!compact ? (
        <View style={styles.head}>
          <SenseMark size={16} />
          <Text style={styles.headText}>SENSE VISION · rivela la parte invisibile</Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SENSE_LAYER_META.map((m) => {
          const on = m.key === value;
          const rec = recommended?.includes(m.key);
          return (
            <Pressable
              key={m.key}
              testID={`sense-layer-${m.key}`}
              onPress={() => { Haptics.selectionAsync(); onChange(m.key); }}
              style={[styles.chip, on && styles.chipActive, !on && rec && styles.chipRec]}
            >
              {rec && !on ? <View style={styles.recDot} /> : null}
              <Text style={styles.chipEmoji}>{m.emoji}</Text>
              <Text style={[styles.chipText, on && styles.chipTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.reveals}>{active.reveals}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  headText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2, letterSpacing: 0.8 },
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipRec: { borderColor: colors.brand },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  chipEmoji: { fontSize: 13 },
  chipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  chipTextActive: { color: colors.onBrand },
  reveals: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 16, minHeight: 32 },
});
