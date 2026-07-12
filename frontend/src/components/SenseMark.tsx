import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, cancelAnimation,
} from "react-native-reanimated";
import { colors } from "@/src/theme";

// The official Sense Vision mark — the universal symbol of "Make a Sense".
const SENSE_ICON = require("@/assets/images/sense-mark.png");

interface Props {
  size?: number;
  active?: boolean;   // animate (glow + pulse + slow rotation) while sensing
  style?: ViewStyle;
}

export function SenseMark({ size = 40, active = false, style }: Props) {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.4);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
      glow.value = withRepeat(withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
      spin.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(pulse); cancelAnimation(glow); cancelAnimation(spin);
      pulse.value = withTiming(1); glow.value = withTiming(0.4); spin.value = withTiming(0);
    }
    return () => { cancelAnimation(pulse); cancelAnimation(glow); cancelAnimation(spin); };
  }, [active, pulse, glow, spin]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: glow.value,
  }));
  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, wrapStyle, style]}>
      <Animated.View style={[{ width: size, height: size }, imgStyle]}>
        <Image source={SENSE_ICON} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      </Animated.View>
      <View style={[styles.ring, { borderRadius: size / 2 }]} pointerEvents="none" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center", justifyContent: "center", overflow: "visible",
    shadowColor: colors.brand, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8,
    backgroundColor: "#000",
  },
  ring: { ...StyleSheet.absoluteFillObject, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
});
