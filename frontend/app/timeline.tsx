import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import BottomSheet from "@gorhom/bottom-sheet";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { ObjectSheet } from "@/src/components/ObjectSheet";
import { OpportunitiesSection } from "@/src/components/OpportunitiesSection";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver } from "@/src/hooks/useObserver";
import { dayNumber, moonPhase } from "@/src/lib/astronomy";
import { computeSky, SkyObject } from "@/src/lib/skyObjects";
import { compassPoint } from "@/src/lib/format";

const STEPS: { label: string; ms: number }[] = [
  { label: "−1 g", ms: -86400000 },
  { label: "−1 h", ms: -3600000 },
  { label: "+1 h", ms: 3600000 },
  { label: "+1 g", ms: 86400000 },
];

export default function Timeline() {
  const insets = useSafeAreaInsets();
  const obs = useObserver();
  const [date, setDate] = useState(new Date());
  const sheetRef = useRef<BottomSheet>(null);
  const [selected, setSelected] = useState<SkyObject | null>(null);

  const step = (ms: number) => {
    Haptics.selectionAsync();
    setDate((d) => new Date(d.getTime() + ms));
  };
  const stepMonth = (n: number) => {
    Haptics.selectionAsync();
    setDate((d) => { const nd = new Date(d); nd.setMonth(nd.getMonth() + n); return nd; });
  };
  const stepYear = (n: number) => {
    Haptics.selectionAsync();
    setDate((d) => { const nd = new Date(d); nd.setFullYear(nd.getFullYear() + n); return nd; });
  };

  const phase = useMemo(() => moonPhase(dayNumber(date)), [date]);

  const objects = useMemo(() => {
    if (obs.status !== "granted") return [];
    return computeSky(date, obs.lat, obs.lon).filter((o) => o.alt > 0).sort((a, b) => b.alt - a.alt);
  }, [date, obs.lat, obs.lon, obs.status]);

  const open = (o: SkyObject) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(o);
    sheetRef.current?.snapToIndex(0);
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Timeline" subtitle="Il cielo di qualsiasi data" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <OpportunitiesSection layer="time" />
        <GlassCard testID="datetime-card" style={{ alignItems: "center" }}>
          <Text style={styles.bigDate}>{date.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "long", year: "numeric" })}</Text>
          <Text style={styles.bigTime}>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>

          <View style={styles.stepRow}>
            <StepBtn label="−1 a" onPress={() => stepYear(-1)} />
            <StepBtn label="−1 m" onPress={() => stepMonth(-1)} />
            <StepBtn label="+1 m" onPress={() => stepMonth(1)} />
            <StepBtn label="+1 a" onPress={() => stepYear(1)} />
          </View>
          <View style={styles.stepRow}>
            {STEPS.map((s) => <StepBtn key={s.label} label={s.label} onPress={() => step(s.ms)} />)}
          </View>
          <Pressable testID="now-button" style={styles.nowBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDate(new Date()); }}>
            <Ionicons name="time" size={16} color={colors.onBrand} />
            <Text style={styles.nowText}>Adesso</Text>
          </Pressable>
        </GlassCard>

        <GlassCard testID="timeline-moon-card">
          <Text style={styles.section}>Luna in quella data {phase.emoji}</Text>
          <Text style={styles.moonText}>{phase.name} · illuminata al {Math.round(phase.illumination * 100)}%</Text>
        </GlassCard>

        <GlassCard testID="timeline-sky-card">
          <Text style={styles.section}>{`Sopra l'orizzonte (${objects.length})`}</Text>
          {obs.status !== "granted" ? (
            <Text style={styles.hint}>Concedi la posizione per ricostruire il cielo della tua località.</Text>
          ) : objects.length === 0 ? (
            <Text style={styles.hint}>{"Nessun oggetto principale sopra l'orizzonte in questo istante."}</Text>
          ) : (
            objects.map((o) => (
              <Pressable key={o.id} testID={`timeline-item-${o.id}`} style={styles.item} onPress={() => open(o)}>
                <View style={[styles.dot, { backgroundColor: o.color }]} />
                <Text style={styles.itemName}>{o.name}</Text>
                <Text style={styles.itemMeta}>{compassPoint(o.az)} · {o.alt.toFixed(0)}°</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
              </Pressable>
            ))
          )}
        </GlassCard>

        <Text style={styles.disclaimer}>
          {"Le posizioni sono ricalcolate per la data e l'ora selezionate con l'algoritmo di Schlyter. Le eclissi e gli eventi rari non sono ancora inclusi."}
        </Text>
      </ScrollView>
      <ObjectSheet ref={sheetRef} object={selected} onClose={() => setSelected(null)} />
    </SpaceBackground>
  );
}

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable testID={`step-${label}`} style={styles.stepBtn} onPress={onPress}>
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bigDate: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl, textAlign: "center" },
  bigTime: { color: colors.brand, fontFamily: fonts.mono, fontSize: type["3xl"], marginVertical: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  stepBtn: { flex: 1, backgroundColor: colors.tertiary, borderRadius: 12, paddingVertical: spacing.md, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stepText: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: type.base },
  nowBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.lg },
  nowText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  section: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.sm },
  moonText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  dot: { width: 12, height: 12, borderRadius: 6 },
  itemName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flex: 1 },
  itemMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
  disclaimer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, lineHeight: 16, opacity: 0.6, marginTop: spacing.sm },
});
