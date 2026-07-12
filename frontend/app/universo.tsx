import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import BottomSheet from "@gorhom/bottom-sheet";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ObjectSheet } from "@/src/components/ObjectSheet";
import { OpportunitiesSection } from "@/src/components/OpportunitiesSection";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { dayNumber, planetHeliocentric, earthHeliocentric } from "@/src/lib/astronomy";
import { BODIES, PLANET_ORDER } from "@/src/lib/bodies";
import { computeSky, SkyObject } from "@/src/lib/skyObjects";

const INNER = ["Mercury", "Venus", "Mars"];

export default function Universo() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const obs = useObserver();
  const now = useNow(30000);
  const [scope, setScope] = useState<"inner" | "all">("all");
  const sheetRef = useRef<BottomSheet>(null);
  const [selected, setSelected] = useState<SkyObject | null>(null);

  const size = width - spacing.lg * 2;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 26;
  const minR = 34;

  const planets = useMemo(() => {
    const d = dayNumber(now);
    const list = scope === "inner" ? INNER : PLANET_ORDER;
    const maxA = Math.sqrt(BODIES[list[list.length - 1]].a_au);
    const minA = Math.sqrt(BODIES[list[0]].a_au);
    const scale = (a: number) =>
      minR + ((Math.sqrt(a) - minA) / (maxA - minA || 1)) * (maxR - minR);

    const items = list.map((name) => {
      const h = planetHeliocentric(name, d);
      const rr = scale(BODIES[name].a_au);
      return { name, lon: h.lon, r: rr, color: BODIES[name].color };
    });

    // Earth
    const e = earthHeliocentric(d);
    const earthR = scale(1);
    return { items, earth: { lon: e.lon, r: earthR } };
  }, [now, scope, minR, maxR]);

  const openBody = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const found = obs.status === "granted"
      ? computeSky(now, obs.lat, obs.lon).find((o) => o.id === name.toLowerCase())
      : undefined;
    const fallback: SkyObject = {
      id: name.toLowerCase(), name: BODIES[name].name, kind: "planet",
      alt: 0, az: 0, magnitude: 0, color: BODIES[name].color,
      subtitle: BODIES[name].type, facts: BODIES[name].facts,
      distanceStr: BODIES[name].distanceNote, lightAgeLy: null,
    };
    setSelected(found ?? fallback);
    sheetRef.current?.snapToIndex(0);
  };

  const pos = (lon: number, r: number) => ({
    x: cx + r * Math.cos((lon * Math.PI) / 180),
    y: cy - r * Math.sin((lon * Math.PI) / 180),
  });

  return (
    <SpaceBackground>
      <ScreenHeader title="Universo" subtitle="Sistema Solare · posizioni reali" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"] }} showsVerticalScrollIndicator={false}>
        <OpportunitiesSection layer="universe" />
        <View style={styles.segment}>
          {(["inner", "all"] as const).map((s) => (
            <Pressable key={s} testID={`scope-${s}`} onPress={() => setScope(s)} style={[styles.segBtn, scope === s && styles.segActive]}>
              <Text style={[styles.segText, scope === s && styles.segTextActive]}>{s === "inner" ? "Pianeti interni" : "Tutti"}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ width: size, height: size, alignSelf: "center" }}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="sun" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFE9A8" />
                <Stop offset="100%" stopColor="#FFB800" />
              </RadialGradient>
            </Defs>
            {/* orbit rings */}
            {planets.items.map((p) => (
              <Circle key={`ring-${p.name}`} cx={cx} cy={cy} r={p.r} stroke={colors.border} strokeWidth={1} fill="none" />
            ))}
            <Circle cx={cx} cy={cy} r={planets.earth.r} stroke={colors.blue} strokeWidth={1} strokeOpacity={0.4} fill="none" />
            {/* Sun */}
            <Circle cx={cx} cy={cy} r={16} fill="url(#sun)" />
            {/* Earth */}
            {(() => { const p = pos(planets.earth.lon, planets.earth.r); return <Circle cx={p.x} cy={p.y} r={5} fill={colors.blue} />; })()}
            {/* planets */}
            {planets.items.map((p) => {
              const c = pos(p.lon, p.r);
              return <Circle key={`pl-${p.name}`} cx={c.x} cy={c.y} r={p.name === "Jupiter" || p.name === "Saturn" ? 7 : 5} fill={p.color} />;
            })}
          </Svg>
          {/* tappable overlays */}
          {planets.items.map((p) => {
            const c = pos(p.lon, p.r);
            return (
              <Pressable key={`hit-${p.name}`} testID={`planet-${p.name.toLowerCase()}`} onPress={() => openBody(p.name)} style={[styles.hit, { left: c.x - 18, top: c.y - 26 }]} hitSlop={6}>
                <Text style={styles.planetLabel}>{BODIES[p.name].name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.caption}>
          {"Le posizioni angolari dei pianeti sono calcolate per l'istante attuale (longitudine eclittica eliocentrica reale). Le distanze dei binari sono in scala compressa per leggibilità."}
        </Text>

        <View style={styles.legend}>
          {PLANET_ORDER.map((name) => (
            <Pressable key={name} testID={`legend-${name.toLowerCase()}`} style={styles.legendItem} onPress={() => openBody(name)}>
              <View style={[styles.legendDot, { backgroundColor: BODIES[name].color }]} />
              <Text style={styles.legendText}>{BODIES[name].name}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <ObjectSheet ref={sheetRef} object={selected} onClose={() => setSelected(null)} />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: colors.tertiary, borderRadius: 999, padding: 4, marginBottom: spacing.xl, alignSelf: "center" },
  segBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: 999 },
  segActive: { backgroundColor: colors.brand },
  segText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.base },
  segTextActive: { color: colors.onBrand },
  hit: { position: "absolute", width: 36, alignItems: "center" },
  planetLabel: { color: "#fff", fontFamily: fonts.regular, fontSize: type.sm - 2, textShadowColor: "#000", textShadowRadius: 3 },
  caption: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 18, marginTop: spacing.xl, opacity: 0.7 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "45%" },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base },
});
