import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView, useWindowDimensions, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Line, G, Text as SvgText, Polygon } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { OpportunitiesSection } from "@/src/components/OpportunitiesSection";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver } from "@/src/hooks/useObserver";
import { useHeading, useMagnetometer, useAccelerometer } from "@/src/hooks/useSensors";
import { api, ISS } from "@/src/lib/api";
import { nf, compassPoint } from "@/src/lib/format";

export default function RealtaInvisibile() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const obs = useObserver();
  const heading = useHeading(true);
  const mag = useMagnetometer(true, 150);
  const accel = useAccelerometer(true, 150);
  const [iss, setIss] = useState<ISS | null>(null);

  useEffect(() => {
    api.iss().then(setIss).catch(() => {});
    const t = setInterval(() => api.iss().then(setIss).catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);

  const size = Math.min(width - spacing.lg * 2, 320);
  const c = size / 2;
  const r = c - 20;

  const tilt = useMemo(() => {
    const pitch = Math.atan2(accel.y, Math.hypot(accel.x, accel.z)) * (180 / Math.PI);
    const roll = Math.atan2(accel.x, Math.hypot(accel.y, accel.z)) * (180 / Math.PI);
    return { pitch, roll };
  }, [accel.x, accel.y, accel.z]);

  const ticks = Array.from({ length: 12 });
  const cardinals = [
    { l: "N", a: 0 }, { l: "E", a: 90 }, { l: "S", a: 180 }, { l: "W", a: 270 },
  ];

  // magnetic magnitude expected earth field 25-65 µT
  const magPct = Math.max(0, Math.min(1, (mag.magnitude - 20) / 60));

  return (
    <SpaceBackground>
      <ScreenHeader title="Realtà Invisibile" subtitle="Le forze che non vedi" />
      <ScrollView testID="invisible-screen" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <OpportunitiesSection layer="magnetic" />

        {/* GO INSIDE — immersive 3D field experience */}
        <Pressable testID="enter-invisible-3d" style={styles.enter3d}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/invisible-3d" as never); }}>
          <View style={styles.enter3dIcon}><Ionicons name="cube" size={22} color={colors.onBrand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.enter3dTitle}>Vivi la Realtà Invisibile in 3D</Text>
            <Text style={styles.enter3dSub}>Entra nel campo magnetico, nella gravità e nelle particelle — dai tuoi sensori reali.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.brand} />
        </Pressable>
        {Platform.OS === "web" ? (
          <GlassCard testID="web-notice">
            <Text style={styles.cardTitle}>Sensori non disponibili sul web</Text>
            <Text style={styles.hint}>{"Bussola, magnetometro e gravità richiedono un iPhone reale. Apri OverView sull'app per vedere i valori dal vivo."}</Text>
          </GlassCard>
        ) : null}
        <GlassCard testID="compass-card" style={{ alignItems: "center" }}>
          <Text style={styles.cardTitle}>Bussola magnetica</Text>
          <Svg width={size} height={size}>
            <Circle cx={c} cy={c} r={r} stroke={colors.border} strokeWidth={1} fill="none" />
            <Circle cx={c} cy={c} r={r - 14} stroke={colors.divider} strokeWidth={1} fill="none" />
            <G rotation={-heading} origin={`${c}, ${c}`}>
              {ticks.map((_, i) => {
                const a = (i * 30 * Math.PI) / 180;
                const x1 = c + (r - 4) * Math.sin(a);
                const y1 = c - (r - 4) * Math.cos(a);
                const x2 = c + r * Math.sin(a);
                const y2 = c - r * Math.cos(a);
                return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.borderStrong} strokeWidth={1.5} />;
              })}
              {cardinals.map((cd) => {
                const a = (cd.a * Math.PI) / 180;
                const x = c + (r - 30) * Math.sin(a);
                const y = c - (r - 30) * Math.cos(a) + 6;
                return (
                  <SvgText key={cd.l} x={x} y={y} fill={cd.l === "N" ? colors.brand : colors.onSurfaceSecondary} fontSize={18} fontWeight="bold" textAnchor="middle">{cd.l}</SvgText>
                );
              })}
              {/* North needle */}
              <Polygon points={`${c},${c - r + 18} ${c - 8},${c} ${c + 8},${c}`} fill={colors.brand} />
              <Polygon points={`${c},${c + r - 18} ${c - 8},${c} ${c + 8},${c}`} fill={colors.onSurfaceSecondary} />
            </G>
            <Circle cx={c} cy={c} r={5} fill={colors.onSurface} />
          </Svg>
          <Text style={styles.compassReadout}>{compassPoint(heading)} · {nf(heading, 0)}°</Text>
          <Text style={styles.hint}>Il Nord magnetico è indicato in oro</Text>
        </GlassCard>

        <View style={styles.row}>
          <GlassCard testID="mag-card" style={{ flex: 1 }}>
            <Text style={styles.miniTitle}>Campo magnetico</Text>
            <Text style={styles.bigVal}>{nf(mag.magnitude, 1)}<Text style={styles.unit}> µT</Text></Text>
            <View style={styles.bar}><View style={[styles.barFill, { width: `${magPct * 100}%` }]} /></View>
            <Text style={styles.mini}>x {nf(mag.x, 0)} · y {nf(mag.y, 0)} · z {nf(mag.z, 0)}</Text>
          </GlassCard>
          <GlassCard testID="gravity-card" style={{ flex: 1 }}>
            <Text style={styles.miniTitle}>Gravità / inclinaz.</Text>
            <Text style={styles.bigVal}>{nf(accel.magnitude, 2)}<Text style={styles.unit}> g</Text></Text>
            <Text style={styles.mini}>Beccheggio {nf(tilt.pitch, 0)}°</Text>
            <Text style={styles.mini}>Rollio {nf(tilt.roll, 0)}°</Text>
          </GlassCard>
        </View>

        <GlassCard testID="gps-card">
          <Text style={styles.cardTitle}>Posizione (GPS)</Text>
          {obs.status === "granted" ? (
            <View style={styles.metaGrid}>
              <Meta label="Latitudine" value={`${nf(obs.lat, 5)}°`} />
              <Meta label="Longitudine" value={`${nf(obs.lon, 5)}°`} />
              <Meta label="Altitudine" value={obs.altitude != null ? `${nf(obs.altitude, 0)} m` : "n/d"} />
              <Meta label="Precisione" value={obs.accuracy != null ? `±${nf(obs.accuracy, 0)} m` : "n/d"} />
            </View>
          ) : (
            <Text style={styles.hint}>Posizione non disponibile. Concedi il permesso in Qui e Ora.</Text>
          )}
        </GlassCard>

        <GlassCard testID="iss-overhead-card">
          <Text style={styles.cardTitle}>Satelliti · ISS</Text>
          {iss?.available ? (
            <>
              <Text style={styles.issText}>
                La Stazione Spaziale Internazionale è ora sopra{" "}
                {nf(iss.latitude!, 1)}°, {nf(iss.longitude!, 1)}°.
              </Text>
              <View style={styles.metaGrid}>
                <Meta label="Quota" value={`${nf(iss.altitude_km!, 0)} km`} />
                <Meta label="Velocità" value={`${nf(iss.velocity_kmh!, 0)} km/h`} />
              </View>
            </>
          ) : (
            <Text style={styles.hint}>Dati ISS non disponibili in questo momento.</Text>
          )}
        </GlassCard>

        <Text style={styles.disclaimer}>
          Bussola, campo magnetico e gravità provengono dai sensori reali del dispositivo. La posizione ISS è fornita da wheretheiss.at.
        </Text>
      </ScrollView>
    </SpaceBackground>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.md },
  miniTitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  compassReadout: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: type["2xl"], marginTop: spacing.md },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: spacing.xs, textAlign: "center" },
  row: { flexDirection: "row", gap: spacing.md },
  bigVal: { color: colors.onSurface, fontFamily: fonts.mono, fontSize: type["2xl"], marginTop: spacing.sm },
  unit: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.base },
  bar: { height: 6, backgroundColor: colors.tertiary, borderRadius: 3, marginTop: spacing.sm, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: colors.brand },
  mini: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1, marginTop: 4 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap" },
  meta: { width: "50%", paddingVertical: spacing.sm },
  metaLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  metaValue: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: type.lg, marginTop: 2 },
  issText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22, marginBottom: spacing.sm },
  disclaimer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, lineHeight: 16, opacity: 0.6, marginTop: spacing.sm },
  enter3d: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  enter3dIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand },
  enter3dTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  enter3dSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2, lineHeight: 16 },
});
