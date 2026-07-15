import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import ViewShot, { captureRef } from "react-native-view-shot";
import Svg, { Circle, Line, Ellipse, G, Polygon, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withRepeat, withTiming, withDelay, Easing,
} from "react-native-reanimated";
import { useObserver } from "@/src/hooks/useObserver";
import { useHeading, useMagnetometer, useAccelerometer } from "@/src/hooks/useSensors";
import { nf, compassPoint } from "@/src/lib/format";
import { colors, fonts, spacing, type } from "@/src/theme";
import { OverviewShortcut } from "@/src/components/OverviewShortcut";
import { SnapshotStudio, SnapshotInput } from "@/src/components/SnapshotStudio";

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type LayerKey = "magnetic" | "gravity" | "particles";

// A single drifting field particle flowing outward along the magnetic azimuth.
function FieldParticle({ cx, cy, angleRad, reach, duration, delay, color }: {
  cx: number; cy: number; angleRad: number; reach: number; duration: number; delay: number; color: string;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
  }, [p, duration, delay]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const d = t * reach;
    const x = cx + Math.cos(angleRad) * d;
    const y = cy + Math.sin(angleRad) * d;
    const op = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
    return { transform: [{ translateX: x }, { translateY: y }], opacity: op * 0.9 };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color, shadowColor: color }, style]} />;
}

export default function Invisible3D() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const obs = useObserver();
  const heading = useHeading(true, 120);
  const mag = useMagnetometer(true, 120);
  const accel = useAccelerometer(true, 120);

  const sceneRef = useRef<ViewShot>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ magnetic: true, gravity: true, particles: true });
  const [explainOpen, setExplainOpen] = useState(true);
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapInput, setSnapInput] = useState<SnapshotInput | null>(null);
  const [busy, setBusy] = useState(false);

  const cx = width / 2;
  const cy = height * 0.46;

  // Real magnetic vector → azimuth (screen orientation of the field) + normalized strength.
  const magAzimuth = useMemo(() => Math.atan2(mag.y, mag.x), [mag.x, mag.y]);
  const magAzDeg = (magAzimuth * 180) / Math.PI;
  const magNorm = clamp((mag.magnitude - 20) / 60, 0, 1); // Earth field ~25-65 µT
  // Device tilt (gravity) → 3D parallax of the grid.
  const pitch = useMemo(() => Math.atan2(accel.y, Math.hypot(accel.x, accel.z)) * (180 / Math.PI), [accel.x, accel.y, accel.z]);
  const roll = useMemo(() => Math.atan2(accel.x, Math.hypot(accel.y, accel.z)) * (180 / Math.PI), [accel.x, accel.y, accel.z]);
  // Gravity arrow direction on screen (points where "down" is relative to the device).
  const gravLen = clamp(Math.hypot(accel.x, accel.y), 0, 1) * (Math.min(width, height) * 0.28);
  const gravAngle = Math.atan2(-accel.y, accel.x); // screen y is inverted
  // Magnetic inclination (dip): how steeply the field points down/up, in degrees.
  const dip = useMemo(() => Math.atan2(Math.abs(mag.z), Math.hypot(mag.x, mag.y)) * (180 / Math.PI), [mag.x, mag.y, mag.z]);

  const fieldColor = magNorm > 0.66 ? "#FF6EC7" : magNorm > 0.33 ? colors.brand : "#5AB0FF";

  // Flowing field loops (animated dash offset).
  const flow = useSharedValue(0);
  useEffect(() => {
    flow.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
  }, [flow]);
  const dashProps = useAnimatedProps(() => ({ strokeDashoffset: -flow.value * 80 }));

  // Grid parallax transform from real device tilt.
  const gridStyle = {
    transform: [
      { perspective: 900 },
      { rotateX: `${clamp(60 - pitch * 0.4, 35, 82)}deg` },
      { rotateZ: `${clamp(roll * 0.5, -25, 25)}deg` },
    ] as const,
  };

  const particles = useMemo(() => {
    const n = 16;
    const reach = Math.min(width, height) * 0.42;
    return Array.from({ length: n }).map((_, i) => {
      const spread = (i / n) * Math.PI * 2;
      // Bias particles toward the magnetic azimuth (two opposite poles).
      const pole = i % 2 === 0 ? magAzimuth : magAzimuth + Math.PI;
      const angle = pole + Math.sin(spread) * 0.5;
      return {
        key: i, angle, reach: reach * (0.6 + (i % 4) * 0.12),
        duration: 2400 - magNorm * 1000 + (i % 5) * 120,
        delay: Math.round((i / n) * 1600),
      };
    });
  }, [width, height, magAzimuth, magNorm]);

  const compassTicks = Array.from({ length: 12 });
  const compassR = Math.min(width, height) * 0.16;

  // --- Senshot capture of the invisible field ---
  const captureSenshot = async () => {
    if (busy) return;
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const uri = await captureRef(sceneRef, { format: "png", quality: 0.95, result: "tmpfile" });
      let base64: string | undefined;
      try { base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); } catch { /* web */ }
      setSnapInput({
        uri, base64,
        title: "Realtà Invisibile · Campo magnetico",
        layerName: `Campo ${nf(mag.magnitude, 0)} µT · ${compassPoint(heading)}`,
        source: "OverView · sensori reali del dispositivo (magnetometro, accelerometro)",
        hashtags: ["RealtaInvisibile", "CampoMagnetico", "InvisibleFields"],
        dataLines: [
          { icon: "🧲", label: `Campo magnetico ${nf(mag.magnitude, 1)} µT` },
          { icon: "🌍", label: `Gravità ${nf(accel.magnitude, 2)} g · beccheggio ${nf(pitch, 0)}°` },
          { icon: "🧭", label: `${compassPoint(heading)} ${nf(heading, 0)}°` },
        ],
        socialSource: "reality",
        snapKind: "invisible",
        data: {
          from: "invisible-3d",
          lat: obs.status === "granted" ? obs.lat : undefined,
          lon: obs.status === "granted" ? obs.lon : undefined,
          magnetic: { magnitude: mag.magnitude, x: mag.x, y: mag.y, z: mag.z },
          gravity: { magnitude: accel.magnitude, pitch, roll },
          heading,
        },
      });
      setSnapOpen(true);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const toggle = (k: LayerKey) => { Haptics.selectionAsync(); setLayers((s) => ({ ...s, [k]: !s[k] })); };

  return (
    <View style={styles.root}>
      <ViewShot ref={sceneRef} style={StyleSheet.absoluteFill} options={{ format: "png", quality: 0.95 }}>
        <View style={styles.scene}>
          {/* Depth grid (tilts with real gravity) */}
          <View style={[StyleSheet.absoluteFill, styles.gridWrap]} pointerEvents="none">
            <Animated.View style={[styles.grid, gridStyle]}>
              <Svg width={width} height={height * 0.6}>
                {Array.from({ length: 11 }).map((_, i) => {
                  const y = (i / 10) * height * 0.6;
                  return <Line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} stroke={colors.brand} strokeWidth={0.6} opacity={0.14} />;
                })}
                {Array.from({ length: 13 }).map((_, i) => {
                  const x = (i / 12) * width;
                  return <Line key={`v${i}`} x1={x} y1={0} x2={x} y2={height * 0.6} stroke={colors.brand} strokeWidth={0.6} opacity={0.14} />;
                })}
              </Svg>
            </Animated.View>
          </View>

          {/* Magnetic field loops — real azimuth + strength, animated flow */}
          {layers.magnetic ? (
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <RadialGradient id="core" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={fieldColor} stopOpacity={0.5 + magNorm * 0.4} />
                  <Stop offset="100%" stopColor={fieldColor} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={cx} cy={cy} r={compassR * (1.1 + magNorm)} fill="url(#core)" />
              <G rotation={magAzDeg} origin={`${cx}, ${cy}`}>
                {[0.55, 0.75, 0.95, 1.15].map((k, i) => (
                  <AnimatedEllipse
                    key={i}
                    cx={cx} cy={cy}
                    rx={compassR * 2.6 * k}
                    ry={compassR * 1.05 * k}
                    stroke={fieldColor}
                    strokeWidth={1.6}
                    fill="none"
                    opacity={0.25 + magNorm * 0.45}
                    strokeDasharray="10 14"
                    animatedProps={dashProps}
                  />
                ))}
              </G>
            </Svg>
          ) : null}

          {/* Particles flowing along the field */}
          {layers.particles ? particles.map((p) => (
            <FieldParticle key={p.key} cx={cx} cy={cy} angleRad={p.angle} reach={p.reach} duration={p.duration} delay={p.delay} color={fieldColor} />
          )) : null}

          {/* Gravity vector + compass ring */}
          <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <G rotation={-heading} origin={`${cx}, ${cy}`}>
              <Circle cx={cx} cy={cy} r={compassR} stroke={colors.border} strokeWidth={1} fill="none" opacity={0.6} />
              {compassTicks.map((_, i) => {
                const a = (i * 30 * Math.PI) / 180;
                return (
                  <Line key={i}
                    x1={cx + (compassR - 5) * Math.sin(a)} y1={cy - (compassR - 5) * Math.cos(a)}
                    x2={cx + compassR * Math.sin(a)} y2={cy - compassR * Math.cos(a)}
                    stroke={colors.borderStrong} strokeWidth={1.4} opacity={0.7} />
                );
              })}
              <Polygon points={`${cx},${cy - compassR + 6} ${cx - 5},${cy} ${cx + 5},${cy}`} fill={colors.brand} />
            </G>
            {layers.gravity ? (
              <>
                <Line x1={cx} y1={cy} x2={cx + Math.cos(gravAngle) * gravLen} y2={cy + Math.sin(gravAngle) * gravLen}
                  stroke="#FFD60A" strokeWidth={3} opacity={0.9} />
                <Circle cx={cx + Math.cos(gravAngle) * gravLen} cy={cy + Math.sin(gravAngle) * gravLen} r={6} fill="#FFD60A" />
              </>
            ) : null}
            <Circle cx={cx} cy={cy} r={4} fill={colors.onSurface} />
          </Svg>
        </View>
      </ViewShot>

      {/* Explanatory panel — turns the animation into an understandable reading */}
      <View style={[styles.explain, { bottom: insets.bottom + 92 }]} pointerEvents="box-none">
        <Pressable style={styles.explainHead} onPress={() => { Haptics.selectionAsync(); setExplainOpen((v) => !v); }}>
          <Text style={styles.readMag}>{nf(mag.magnitude, 1)}<Text style={styles.readUnit}> µT</Text></Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.explainSub}>{compassPoint(heading)} {nf(heading, 0)}° · inclinazione ~{nf(dip, 0)}° · gravità {nf(accel.magnitude, 2)} g</Text>
          </View>
          <Ionicons name={explainOpen ? "chevron-down" : "information-circle-outline"} size={20} color={colors.brand} />
        </Pressable>
        {explainOpen ? (
          <View style={styles.explainBody}>
            <Text style={styles.explainText}>
              Il campo magnetico qui è di {nf(mag.magnitude, 1)} µT, orientato verso {compassPoint(heading)} ({nf(heading, 0)}°) e inclinato di circa {nf(dip, 0)}°. Invisibile a occhio nudo: lo stai vedendo dai sensori reali del tuo dispositivo.
            </Text>
            <Text style={styles.legendTitle}>Cosa stai osservando</Text>
            {layers.magnetic ? (
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: fieldColor }]} />
                <Text style={styles.legendText}>Anelli — le linee del campo magnetico attorno a te</Text>
              </View>
            ) : null}
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
              <Text style={styles.legendText}>Ago della bussola — il Nord magnetico</Text>
            </View>
            {layers.gravity ? (
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: "#FFD60A" }]} />
                <Text style={styles.legendText}>Freccia gialla — la direzione del &quot;basso&quot; (gravità)</Text>
              </View>
            ) : null}
            {layers.particles ? (
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: fieldColor }]} />
                <Text style={styles.legendText}>Puntini — particelle stimate lungo il campo (non misurate una a una)</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Top controls */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Pressable testID="i3d-back" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.titlePill}>
          <Ionicons name="magnet" size={13} color={colors.brand} />
          <Text style={styles.titleText}>REALTÀ INVISIBILE 3D</Text>
        </View>
        <OverviewShortcut size={26} />
      </View>

      {/* Layer toggles */}
      <View style={[styles.layerBar, { top: insets.top + 52 }]} pointerEvents="box-none">
        {([["magnetic", "Magnetico", "magnet"], ["gravity", "Gravità", "arrow-down"], ["particles", "Particelle", "sparkles"]] as [LayerKey, string, keyof typeof Ionicons.glyphMap][]).map(([k, label, icon]) => (
          <Pressable key={k} testID={`i3d-layer-${k}`} onPress={() => toggle(k)}
            style={[styles.layerChip, layers[k] && styles.layerChipOn]}>
            <Ionicons name={icon} size={13} color={layers[k] ? colors.onBrand : "#fff"} />
            <Text style={[styles.layerText, layers[k] && { color: colors.onBrand }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Web notice */}
      {Platform.OS === "web" ? (
        <View style={[styles.webNote, { bottom: insets.bottom + 96 }]} pointerEvents="none">
          <Text style={styles.webNoteText}>I sensori (magnetometro, gravità, bussola) sono disponibili solo su iPhone reale. In anteprima web i valori sono a zero.</Text>
        </View>
      ) : null}

      {/* Senshot */}
      <Pressable testID="i3d-senshot" style={[styles.senshotBtn, { bottom: insets.bottom + 24 }, busy && { opacity: 0.7 }]} onPress={captureSenshot} disabled={busy}>
        <Ionicons name="camera" size={20} color={colors.onBrand} />
        <Text style={styles.senshotText}>SENSHOT</Text>
      </Pressable>

      <SnapshotStudio visible={snapOpen} input={snapInput} onClose={() => setSnapOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#02040A" },
  scene: { flex: 1, backgroundColor: "#02040A" },
  gridWrap: { justifyContent: "flex-end" },
  grid: { alignItems: "center", justifyContent: "flex-end" },
  particle: { position: "absolute", left: 0, top: 0, width: 5, height: 5, borderRadius: 3, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  readout: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  readMag: { color: "#fff", fontFamily: fonts.mono, fontSize: type["2xl"] ?? 28, letterSpacing: 0.5 },
  readUnit: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.base },
  readSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1, marginTop: 4 },
  explain: { position: "absolute", left: spacing.lg, right: spacing.lg, backgroundColor: "rgba(8,12,20,0.86)", borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  explainHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  explainSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  explainBody: { marginTop: spacing.sm, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  explainText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 20 },
  legendTitle: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.8, marginTop: 4 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,16,26,0.6)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  titlePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,16,26,0.6)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  titleText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 1.2 },
  layerBar: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  layerChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(10,16,26,0.65)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  layerChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  layerText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 2 },
  webNote: { position: "absolute", left: spacing.xl, right: spacing.xl, alignItems: "center" },
  webNoteText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, textAlign: "center", lineHeight: 17, opacity: 0.75 },
  senshotBtn: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  senshotText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 1.5 },
});
