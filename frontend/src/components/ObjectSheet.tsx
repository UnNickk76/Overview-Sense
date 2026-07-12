import React, { forwardRef, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, type } from "@/src/theme";
import { SkyObject } from "@/src/lib/skyObjects";
import { compassPoint, lightAgeStr } from "@/src/lib/format";

interface Props { object: SkyObject | null; onClose: () => void }

export const ObjectSheet = forwardRef<BottomSheet, Props>(({ object, onClose }, ref) => {
  const snapPoints = useMemo(() => ["55%", "85%"], []);
  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={(p) => (
        <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
      )}
    >
      {object ? (
        <BottomSheetScrollView contentContainerStyle={styles.content} testID="object-sheet">
          <View style={styles.header}>
            <View style={[styles.swatch, { backgroundColor: object.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{object.name}</Text>
              <Text style={styles.subtitle}>{object.subtitle}</Text>
            </View>
          </View>

          <View style={styles.dataRow}>
            <Data label="Altezza" value={`${object.alt.toFixed(0)}°`} />
            <Data label="Direzione" value={`${compassPoint(object.az)} ${object.az.toFixed(0)}°`} />
            <Data label="Visibile" value={object.alt > 0 ? "Sì" : "No"} accent={object.alt > 0 ? colors.success : colors.onSurfaceSecondary} />
          </View>

          <Row icon="resize" label="Distanza" value={object.distanceStr} />
          {object.lightAgeLy && object.lightAgeLy > 0.00001 ? (
            <Row icon="time" label="Età della luce osservata" value={lightAgeStr(object.lightAgeLy)} />
          ) : null}
          <Row icon="star" label="Magnitudine" value={object.magnitude.toFixed(2)} />

          <Text style={styles.factsTitle}>Curiosità</Text>
          {object.facts.map((f, i) => (
            <View key={i} style={styles.factRow}>
              <View style={styles.bullet} />
              <Text style={styles.factText}>{f}</Text>
            </View>
          ))}
          <Text style={styles.src}>Posizione calcolata per la tua località e ora esatta.</Text>
        </BottomSheetScrollView>
      ) : null}
    </BottomSheet>
  );
});
ObjectSheet.displayName = "ObjectSheet";

function Data({ label, value, accent = colors.onSurface }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.data}>
      <Text style={[styles.dataValue, { color: accent }]}>{value}</Text>
      <Text style={styles.dataLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: "#0B0C10", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  handle: { backgroundColor: colors.borderStrong, width: 44 },
  content: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  swatch: { width: 46, height: 46, borderRadius: 23 },
  name: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"] },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, marginTop: 2 },
  dataRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  data: { flex: 1, backgroundColor: colors.tertiary, borderRadius: 14, paddingVertical: spacing.md, alignItems: "center" },
  dataValue: { fontFamily: fonts.monoMedium, fontSize: type.lg },
  dataLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  infoLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, flex: 1 },
  infoValue: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: type.base },
  factsTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  factRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, marginTop: 7 },
  factText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22, flex: 1 },
  src: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: spacing.lg, opacity: 0.6 },
});
