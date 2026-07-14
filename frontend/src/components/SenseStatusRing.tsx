import React, { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, withRepeat, useDerivedValue, Easing,
} from "react-native-reanimated";
import { colors, fonts, type } from "@/src/theme";
import type { SenseState } from "@/src/lib/guidance";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * SenseStatusRing — the signature circular indicator of Sense Vision.
 * A converging golden reticle that reflects, in real time, what Sense Vision is
 * doing: searching → approaching → locked/tracking (+ optional AF/AE status).
 * Built to grow (extra states/labels) without a rewrite.
 */
export function SenseStatusRing({
  size = 140,
  proximity = 0,
  state = "idle",
  status,
  color = colors.brand,
}: {
  size?: number;
  proximity?: number; // 0..1
  state?: SenseState;
  status?: string; // e.g. "AUTOFOCUS", "TRACKING", "STABILIZZO"
  color?: string;
}) {
  const c = size / 2;
  const outerR = size / 2 - 6;
  const minR = size * 0.11;

  const prox = useSharedValue(proximity);
  const spin = useSharedValue(0);

  useEffect(() => { prox.value = withTiming(proximity, { duration: 260 }); }, [proximity, prox]);
  useEffect(() => {
    if (state === "searching" || state === "idle") {
      spin.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false);
    } else {
      spin.value = withTiming(0, { duration: 300 });
    }
  }, [state, spin]);

  // Converging reticle radius: far => outer, centred => minR.
  const ringProps = useAnimatedProps(() => ({
    r: outerR - (outerR - minR) * prox.value,
    opacity: 0.55 + 0.45 * prox.value,
    strokeWidth: 2 + 1.6 * prox.value,
  }));

  const glowProps = useAnimatedProps(() => ({ opacity: prox.value * 0.9 }));
  const rotate = useDerivedValue(() => `${spin.value * 360}deg`);

  const locked = state === "locked" || state === "tracking";
  const tick = size * 0.09;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
      <Svg width={size} height={size}>
        {/* fixed outer guide */}
        <Circle cx={c} cy={c} r={outerR} stroke={color} strokeOpacity={0.18} strokeWidth={1.5} fill="none" />
        {/* converging reticle */}
        <AnimatedCircle cx={c} cy={c} stroke={color} fill="none" animatedProps={ringProps} />
        {/* lock glow */}
        <AnimatedCircle cx={c} cy={c} r={minR + 3} stroke={color} strokeWidth={5} strokeOpacity={0.25} fill="none" animatedProps={glowProps} />
        {/* crosshair */}
        <Line x1={c} y1={c - tick} x2={c} y2={c - tick / 2.2} stroke={color} strokeWidth={1.5} />
        <Line x1={c} y1={c + tick} x2={c} y2={c + tick / 2.2} stroke={color} strokeWidth={1.5} />
        <Line x1={c - tick} y1={c} x2={c - tick / 2.2} y2={c} stroke={color} strokeWidth={1.5} />
        <Line x1={c + tick} y1={c} x2={c + tick / 2.2} y2={c} stroke={color} strokeWidth={1.5} />
        <Circle cx={c} cy={c} r={locked ? 3.5 : 2} fill={color} />
      </Svg>
      {/* rotating search accents */}
      {(state === "searching" || state === "idle") ? (
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", transform: [{ rotate: rotate as unknown as string }] }]}>
          <Svg width={size} height={size}>
            <Circle cx={c} cy={c} r={outerR} stroke={color} strokeOpacity={0.5} strokeWidth={2}
              strokeDasharray={`${size * 0.12} ${size * 0.9}`} fill="none" strokeLinecap="round" />
          </Svg>
        </Animated.View>
      ) : null}
      {status ? (
        <View style={styles.statusChip}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statusChip: { position: "absolute", bottom: -6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { color: colors.brand, fontFamily: fonts.mono, fontSize: type.sm - 4, letterSpacing: 1 },
});
