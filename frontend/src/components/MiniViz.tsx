import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { colors } from "@/src/theme";

// Pulsing Sun whose colour shifts with geomagnetic/solar activity (Kp 0-9).
export function MiniSun({ size = 44, kp = 0 }: { size?: number; kp?: number | null }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [p]);
  const active = Math.max(0, Math.min(1, (kp ?? 0) / 8));
  const core = active < 0.5 ? "#FFC93C" : active < 0.75 ? "#FF9A3C" : "#FF5C3C";
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + p.value * 0.14 }],
    opacity: 0.85 + p.value * 0.15,
  }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2 }, style]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill={core} opacity={0.25} />
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 13} fill={core} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Slowly rotating mini solar system.
export function MiniOrrery({ size = 44 }: { size?: number }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1, false);
  }, [rot]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const c = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={size * 0.22} stroke={colors.border} strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={size * 0.38} stroke={colors.border} strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={4} fill={colors.brand} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <Svg width={size} height={size}>
          <Circle cx={c + size * 0.22} cy={c} r={2.5} fill={colors.blue} />
          <Circle cx={c - size * 0.38} cy={c} r={3} fill="#C1440E" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Shimmering magnetic field lines (dipole-ish arcs).
export function MiniField({ size = 44 }: { size?: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o]);
  const c = size / 2;
  const style = useAnimatedStyle(() => ({ opacity: 0.4 + o.value * 0.6 }));
  const arc = (dx: number) =>
    `M ${c} 6 C ${c + dx} ${c}, ${c + dx} ${c}, ${c} ${size - 6}`;
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Path d={arc(16)} stroke={colors.blue} strokeWidth={1.5} fill="none" />
        <Path d={arc(9)} stroke="#5AB0FF" strokeWidth={1.5} fill="none" />
        <Path d={arc(-9)} stroke="#5AB0FF" strokeWidth={1.5} fill="none" />
        <Path d={arc(-16)} stroke={colors.blue} strokeWidth={1.5} fill="none" />
        <Circle cx={c} cy={c} r={2.5} fill={colors.onSurface} />
      </Svg>
    </Animated.View>
  );
}
