import React, { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/src/theme";

function TwinkleStar({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const o = useSharedValue(0.2);
  React.useEffect(() => {
    o.value = withDelay(delay, withRepeat(withTiming(0.9, { duration: 2200 }), -1, true));
  }, [o, delay]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      style={[
        { position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size, backgroundColor: "#FFFFFF" },
        style,
      ]}
    />
  );
}

export function SpaceBackground({ children }: { children?: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(
    () =>
      Array.from({ length: 44 }).map((_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8 + 0.6,
        delay: Math.random() * 2200,
        key: i,
      })),
    [width, height],
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#05060A", "#000000", "#04070E"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {stars.map((s) => (
          <TwinkleStar key={s.key} x={s.x} y={s.y} size={s.size} delay={s.delay} />
        ))}
      </View>
      {/* subtle gold glow bottom */}
      <LinearGradient
        colors={["transparent", "rgba(212,175,55,0.06)"]}
        style={styles.glow}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  glow: { position: "absolute", left: 0, right: 0, bottom: 0, height: 260 },
});
