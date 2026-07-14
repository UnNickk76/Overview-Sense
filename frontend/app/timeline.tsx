import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import BottomSheet from "@gorhom/bottom-sheet";
import Svg, { Circle, Line, G, Text as SvgText } from "react-native-svg";
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

// Play (time-lapse) speeds: milliseconds of sky-time advanced per ~100ms tick.
const SPEEDS: { label: string; ms: number }[] = [
  { label: "1 min/s", ms: 6000 },
  { label: "15 min/s", ms: 90000 },
  { label: "1 ora/s", ms: 360000 },
  { label: "6 ore/s", ms: 2160000 },
];
const TICK_MS = 100;

export default function Timeline() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const obs = useObserver();
  const [date, setDate] = useState(new Date());
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2);
  const sheetRef = useRef<BottomSheet>(null);
  const [selected, setSelected] = useState<SkyObject | null>(null);

  // Automated Play — advances the clock continuously, animating the sky like a time-lapse.
  useEffect(() => {
    if (!playing) return;
    const perTick = SPEEDS[speedIdx].ms;
    const t = setInterval(() => setDate((d) => new Date(d.getTime() + perTick)), TICK_MS);
    return () => clearInterval(t);
  }, [playing, speedIdx]);

  const togglePlay = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPlaying((p) => !p); };

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
          <Pressable testID="now-button" style={styles.nowBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPlaying(false); setDate(new Date()); }}>
            <Ionicons name="time" size={16} color={colors.onBrand} />
            <Text style={styles.nowText}>Adesso</Text>
          </Pressable>

          {/* PLAY — automated time-lapse of the sky */}
          <View style={styles.playRow}>
            <Pressable testID="timeline-play" style={styles.playBtn} onPress={togglePlay}>
              <Ionicons name={playing ? "pause" : "play"} size={20} color={colors.onBrand} />
              <Text style={styles.playText}>{playing ? "Pausa" : "Play"}</Text>
            </Pressable>
            <View style={styles.speedRow}>
              {SPEEDS.map((s, i) => (
                <Pressable key={s.label} testID={`timeline-speed-${i}`} onPress={() => { Haptics.selectionAsync(); setSpeedIdx(i); }}
                  style={[styles.speedChip, i === speedIdx && styles.speedChipOn]}>
                  <Text style={[styles.speedText, i === speedIdx && { color: colors.onBrand }]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </GlassCard>

        {/* Sky dome — objects arc across as Play advances the clock */}
        <GlassCard testID="timeline-dome-card" style={{ alignItems: "center" }}>
          <Text style={styles.section}>Cupola celeste {playing ? "· in riproduzione" : ""}</Text>
          {obs.status !== "granted" ? (
            <Text style={styles.hint}>Concedi la posizione per vedere la volta celeste della tua località.</Text>
          ) : (
            <SkyDome objects={objects} size={Math.min(width - spacing.lg * 4, 300)} onPick={open} />
          )}
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

// Polar sky map: zenith at center, horizon at the rim. Objects arc as time advances.
function SkyDome({ objects, size, onPick }: { objects: SkyObject[]; size: number; onPick: (o: SkyObject) => void }) {
  const c = size / 2;
  const R = c - 8;
  const cardinals: { l: string; az: number }[] = [
    { l: "N", az: 0 }, { l: "E", az: 90 }, { l: "S", az: 180 }, { l: "W", az: 270 },
  ];
  const pos = (az: number, alt: number) => {
    const r = (1 - Math.max(0, Math.min(90, alt)) / 90) * R;
    const a = (az * Math.PI) / 180;
    return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
  };
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={R} stroke={colors.border} strokeWidth={1} fill="rgba(90,176,255,0.04)" />
      <Circle cx={c} cy={c} r={R * 0.66} stroke={colors.divider} strokeWidth={0.6} fill="none" />
      <Circle cx={c} cy={c} r={R * 0.33} stroke={colors.divider} strokeWidth={0.6} fill="none" />
      <Line x1={c - R} y1={c} x2={c + R} y2={c} stroke={colors.divider} strokeWidth={0.5} />
      <Line x1={c} y1={c - R} x2={c} y2={c + R} stroke={colors.divider} strokeWidth={0.5} />
      {cardinals.map((cd) => {
        const p = pos(cd.az, 0);
        return <SvgText key={cd.l} x={p.x} y={p.y + (cd.l === "N" ? -4 : cd.l === "S" ? 12 : 4)} fill={cd.l === "N" ? colors.brand : colors.onSurfaceSecondary} fontSize={12} fontWeight="bold" textAnchor="middle">{cd.l}</SvgText>;
      })}
      {objects.map((o) => {
        const p = pos(o.az, o.alt);
        const rad = o.kind === "sun" ? 9 : o.kind === "moon" ? 7 : o.kind === "planet" ? 5 : 3;
        return (
          <G key={o.id} onPress={() => onPick(o)}>
            <Circle cx={p.x} cy={p.y} r={rad + 3} fill={o.color} opacity={0.18} />
            <Circle cx={p.x} cy={p.y} r={rad} fill={o.color} />
          </G>
        );
      })}
    </Svg>
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
  playRow: { alignSelf: "stretch", marginTop: spacing.lg, gap: spacing.sm },
  playBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.md },
  playText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 0.5 },
  speedRow: { flexDirection: "row", gap: spacing.xs, justifyContent: "center", flexWrap: "wrap" },
  speedChip: { backgroundColor: colors.tertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  speedChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  speedText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  section: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.sm },
  moonText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  dot: { width: 12, height: 12, borderRadius: 6 },
  itemName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flex: 1 },
  itemMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
  disclaimer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, lineHeight: 16, opacity: 0.6, marginTop: spacing.sm },
});
