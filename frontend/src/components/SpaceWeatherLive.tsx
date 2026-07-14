import React, { useEffect, useMemo } from "react";
import { StyleSheet, View, Text, useWindowDimensions } from "react-native";
import Svg, { Circle, Path, Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSequence, Easing,
} from "react-native-reanimated";
import { colors, fonts, spacing, type } from "@/src/theme";

// "Meteo Spaziale vivo" — a living, real-data visualization of the Sun→Earth system.
// Every animation parameter is driven by NOAA SWPC values (Kp, solar wind, IMF Bz, flares).
interface Props {
  kp: number | null;
  windSpeed: number | null;      // km/s
  bz: number | null;             // nT
  flareActive: boolean;
  flareClass?: string | null;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mapRange = (v: number, inA: number, inB: number, outA: number, outB: number) =>
  outA + ((clamp(v, inA, inB) - inA) / (inB - inA)) * (outB - outA);

function auroraColors(kp: number | null): { a: string; b: string } {
  if (kp == null) return { a: "#39FF88", b: "#2ED0FF" };
  if (kp < 4) return { a: "#39FF88", b: "#2ED0FF" };
  if (kp < 6) return { a: "#7CFF5A", b: "#FFD60A" };
  return { a: "#FF6EC7", b: "#B98CFF" };
}

function WindParticle({ x0, x1, yBase, amp, duration, delay, color }: {
  x0: number; x1: number; yBase: number; amp: number; duration: number; delay: number; color: string;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
  }, [p, duration, delay]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const x = x0 + (x1 - x0) * t;
    const y = yBase + Math.sin(t * Math.PI * 2) * amp;
    const op = t < 0.12 ? t / 0.12 : t > 0.82 ? (1 - t) / 0.18 : 1;
    return { transform: [{ translateX: x }, { translateY: y }], opacity: op * 0.95 };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color, shadowColor: color }, style]} />;
}

export function SpaceWeatherLive({ kp, windSpeed, bz, flareActive, flareClass }: Props) {
  const { width } = useWindowDimensions();
  const W = Math.min(width - spacing.lg * 2, 520);
  const H = 236;
  const sunX = 52, sunY = H / 2, sunR = 34;
  const earthX = W - 58, earthY = H / 2, earthR = 22;

  const auroraIntensity = kp == null ? 0.28 : clamp(kp / 9, 0.1, 1);
  const ac = auroraColors(kp);
  const duration = Math.round(windSpeed ? mapRange(windSpeed, 280, 780, 2600, 900) : 1900);
  const bzNeg = bz != null && bz < 0; // southward IMF → stronger coupling

  // Sun pulse (breathing glow)
  const pulse = useSharedValue(0);
  const auroraPulse = useSharedValue(0);
  const flare = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true);
    auroraPulse.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse, auroraPulse]);
  useEffect(() => {
    if (flareActive) {
      flare.value = withRepeat(
        withSequence(withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }), withTiming(0, { duration: 1400 })),
        -1, false,
      );
    } else {
      flare.value = withTiming(0, { duration: 300 });
    }
  }, [flare, flareActive]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));
  const flareStyle = useAnimatedStyle(() => ({ opacity: flare.value, transform: [{ scale: 1 + flare.value * 0.6 }] }));
  const auroraStyle = useAnimatedStyle(() => ({
    opacity: auroraIntensity * (0.6 + auroraPulse.value * 0.4),
    transform: [{ scaleY: 0.9 + auroraPulse.value * 0.2 }],
  }));

  const particles = useMemo(() => {
    const n = 16;
    const x0 = sunX + sunR - 6;
    const x1 = earthX - earthR - 4;
    return Array.from({ length: n }).map((_, i) => ({
      key: i,
      x0, x1,
      yBase: sunY - 34 + (68 / (n - 1)) * i * 0.9 - 4,
      amp: 4 + (i % 4) * 3,
      duration: duration + (i % 5) * 130,
      delay: Math.round((i / n) * duration),
      color: bzNeg ? "#8FD0FF" : "#CFE8FF",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, duration, bzNeg]);

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      {/* Sun outer glow (animated) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.sunGlow, { left: sunX - 62, top: sunY - 62, width: 124, height: 124, borderRadius: 62 }, glowStyle]}
      />
      {/* Flare burst (only when a real X-ray flare is active) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.flareGlow, { left: sunX - 50, top: sunY - 50, width: 100, height: 100, borderRadius: 50 }, flareStyle]}
      />

      {/* Aurora arcs around Earth (animated opacity/scale by Kp) */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, auroraStyle]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="aur" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={ac.a} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={ac.b} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={earthX} cy={earthY} rx={earthR + 30} ry={earthR + 16} fill="url(#aur)" />
          <Path
            d={`M ${earthX - earthR - 16} ${earthY - earthR - 6} Q ${earthX} ${earthY - earthR - 34} ${earthX + earthR + 16} ${earthY - earthR - 6}`}
            stroke={ac.a} strokeWidth={3} fill="none" opacity={0.85}
          />
          <Path
            d={`M ${earthX - earthR - 20} ${earthY + earthR + 6} Q ${earthX} ${earthY + earthR + 34} ${earthX + earthR + 20} ${earthY + earthR + 6}`}
            stroke={ac.b} strokeWidth={3} fill="none" opacity={0.7}
          />
        </Svg>
      </Animated.View>

      {/* Solar wind particle stream (speed = real solar wind km/s) */}
      {particles.map((p) => (
        <WindParticle key={p.key} x0={p.x0} x1={p.x1} yBase={p.yBase} amp={p.amp} duration={p.duration} delay={p.delay} color={p.color} />
      ))}

      {/* Static bodies: Sun + Earth + magnetosphere */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="sun" cx="42%" cy="40%" r="65%">
            <Stop offset="0%" stopColor="#FFF3B0" stopOpacity={1} />
            <Stop offset="45%" stopColor="#FFD60A" stopOpacity={1} />
            <Stop offset="100%" stopColor="#FF7A00" stopOpacity={1} />
          </RadialGradient>
          <RadialGradient id="earth" cx="40%" cy="38%" r="70%">
            <Stop offset="0%" stopColor="#7FC8FF" stopOpacity={1} />
            <Stop offset="60%" stopColor="#2E7DE0" stopOpacity={1} />
            <Stop offset="100%" stopColor="#0B3B82" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        {/* magnetosphere — compressed on the sun side, elongated tail away */}
        <Ellipse
          cx={earthX + 6} cy={earthY} rx={earthR + 20} ry={earthR + 12}
          stroke={bzNeg ? "#FF6EC7" : "#5AB0FF"} strokeWidth={1.2} fill="none" opacity={0.4}
        />
        <Circle cx={sunX} cy={sunY} r={sunR} fill="url(#sun)" />
        <Circle cx={earthX} cy={earthY} r={earthR} fill="url(#earth)" />
      </Svg>

      {/* Labels */}
      <Text style={[styles.lbl, { left: sunX - 20, top: sunY + sunR + 8 }]}>SOLE</Text>
      <Text style={[styles.lbl, { left: earthX - 22, top: earthY + earthR + 12 }]}>TERRA</Text>
      {windSpeed != null ? (
        <View style={[styles.tag, { left: W / 2 - 52, top: 10 }]}>
          <Text style={styles.tagText}>vento {Math.round(windSpeed)} km/s →</Text>
        </View>
      ) : null}
      {flareActive && flareClass ? (
        <View style={[styles.flareTag, { left: sunX - 10, top: 10 }]}>
          <Text style={styles.flareTagText}>⚡ Flare {flareClass}</Text>
        </View>
      ) : null}
      <View style={[styles.tag, { left: earthX - 44, top: H - 26 }]}>
        <Text style={styles.tagText}>{kp != null ? `Aurore Kp ${kp.toFixed(1)}` : "aurore n/d"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center", borderRadius: 20, overflow: "hidden", backgroundColor: "#03060E", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sunGlow: { position: "absolute", backgroundColor: "#FFB020", shadowColor: "#FFB020", shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  flareGlow: { position: "absolute", backgroundColor: "#FF5A2C", shadowColor: "#FF5A2C", shadowOpacity: 1, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
  particle: { position: "absolute", left: 0, top: 0, width: 11, height: 3, borderRadius: 2, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  lbl: { position: "absolute", color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 1 },
  tag: { position: "absolute", backgroundColor: "rgba(10,16,26,0.7)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tagText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 3 },
  flareTag: { position: "absolute", backgroundColor: "rgba(255,90,44,0.22)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "#FF7A00" },
  flareTagText: { color: "#FFB020", fontFamily: fonts.semibold, fontSize: type.sm - 3 },
});
