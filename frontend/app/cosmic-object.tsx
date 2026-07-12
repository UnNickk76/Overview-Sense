import React, { useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { getObject, formatDistanceKm, lightTravelTime, travelTime, TRAVEL_SPEEDS } from "@/src/lib/cosmos";

export default function CosmicObjectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const obj = id ? getObject(id) : undefined;
  const [speedIdx, setSpeedIdx] = useState(5); // light

  if (!obj) {
    return <SpaceBackground><ScreenHeader title="Oggetto" /><View style={styles.center}><Text style={styles.muted}>Oggetto non trovato.</Text></View></SpaceBackground>;
  }

  const speed = TRAVEL_SPEEDS[speedIdx];
  const nf = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 2 });

  return (
    <SpaceBackground>
      <ScreenHeader title={obj.name} subtitle={obj.type} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="cosmic-object">
        {obj.imageUrl ? (
          <Image source={{ uri: obj.imageUrl }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={[styles.image, styles.placeholder]}><Text style={{ fontSize: 60 }}>{obj.emoji}</Text></View>
        )}

        <Text style={styles.desc}>{obj.description}</Text>

        <View style={styles.dataCard}>
          <Row label="Distanza dalla Terra" value={obj.distanceLabel ?? formatDistanceKm(obj.distanceKm)} />
          {obj.distanceKm > 0 ? <Row label="Tempo-luce" value={lightTravelTime(obj.distanceKm)} /> : null}
          {obj.diameterKm ? <Row label="Diametro" value={`${nf(obj.diameterKm)} km`} /> : null}
          {obj.massKg ? <Row label="Massa" value={`${obj.massKg.toExponential(2)} kg`} /> : null}
          {obj.gravityMs2 ? <Row label="Gravità" value={`${nf(obj.gravityMs2)} m/s²`} /> : null}
          {obj.tempK ? <Row label="Temperatura" value={`${nf(obj.tempK - 273.15)} °C`} /> : null}
          {obj.orbitalPeriod ? <Row label="Periodo orbitale" value={obj.orbitalPeriod} /> : null}
        </View>

        {/* Travel Here */}
        {obj.distanceKm > 0 ? (
          <View style={styles.travelCard}>
            <View style={styles.travelHead}>
              <Ionicons name="rocket" size={16} color={colors.brand} />
              <Text style={styles.travelTitle}>TRAVEL HERE</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {TRAVEL_SPEEDS.map((s, i) => (
                <Pressable key={s.key} onPress={() => { Haptics.selectionAsync(); setSpeedIdx(i); }}
                  style={[styles.speedChip, i === speedIdx && styles.speedActive]}>
                  <Text style={[styles.speedText, i === speedIdx && { color: colors.onBrand }]}>{s.emoji} {s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Animated.Text key={speedIdx} entering={FadeIn.duration(300)} style={styles.travelResult}>
              {travelTime(obj.distanceKm, speed.kmh)}
            </Animated.Text>
            <Text style={styles.travelSub}>di viaggio {speed.label.toLowerCase()} per raggiungere {obj.name}.</Text>
          </View>
        ) : null}

        {obj.facts.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CURIOSITÀ</Text>
            {obj.facts.map((f, i) => (
              <View key={i} style={styles.factRow}>
                <View style={styles.dot} />
                <Text style={styles.fact}>{f}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable testID="cosmic-create-obs" style={styles.primary} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/cielo" as never); }}>
          <Ionicons name="camera" size={20} color={colors.onBrand} />
          <Text style={styles.primaryText}>Crea una Observation</Text>
        </Pressable>

        <Text style={styles.note}>Dati da fonti astronomiche pubbliche (NASA/ESA e cataloghi standard). Valori approssimati dove la natura stessa lo è.</Text>
      </ScrollView>
    </SpaceBackground>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  image: { width: "100%", aspectRatio: 16 / 10, borderRadius: radius.lg, backgroundColor: colors.tertiary },
  placeholder: { alignItems: "center", justifyContent: "center" },
  desc: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 24 },
  dataCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  rowValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flexShrink: 1, textAlign: "right" },
  travelCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  travelHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  travelTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  speedChip: { backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  speedActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  speedText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  travelResult: { color: colors.brand, fontFamily: fonts.bold, fontSize: type["2xl"] },
  travelSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  section: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  sectionTitle: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  factRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand, marginTop: 7 },
  fact: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21, flex: 1 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.6 },
});
