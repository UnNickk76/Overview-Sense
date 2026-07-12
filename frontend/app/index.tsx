import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing, FadeIn,
} from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { EarthLimb } from "@/src/components/EarthLimb";
import { colors, fonts, spacing, type } from "@/src/theme";

const STEPS = [
  "Lettura dei sensori…",
  "Calcolo delle posizioni astronomiche…",
  "Sincronizzazione con il cielo sopra di te…",
];

export default function Splash() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [step, setStep] = useState(0);

  const logoOpacity = useSharedValue(0);
  const earthRot = useSharedValue(0);
  const earthY = useSharedValue(20);

  useEffect(() => {
    logoOpacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0.7, { duration: 1400 })),
      -1, true,
    );
    earthY.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) });
    earthRot.value = withDelay(1600, withTiming(4, { duration: 1600, easing: Easing.inOut(Easing.ease) }));

    const t1 = setTimeout(() => setStep(1), 1000);
    const t2 = setTimeout(() => setStep(2), 2100);
    const t3 = setTimeout(() => router.replace("/home"), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [logoOpacity, earthRot, earthY, router]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const earthStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: earthY.value }, { rotate: `${earthRot.value}deg` }],
  }));

  return (
    <SpaceBackground glow={false}>
      <View style={styles.center}>
        <Animated.View style={logoStyle}>
          <View style={styles.brandRow}>
            <View style={styles.dot} />
            <Text style={styles.wordmark}>OVERVIEW</Text>
          </View>
          <Text style={styles.tagline}>The Invisible Sense</Text>
        </Animated.View>
        <Animated.Text key={step} entering={FadeIn.duration(500)} style={styles.status}>
          {STEPS[step]}
        </Animated.Text>
      </View>

      <Animated.View style={[styles.earth, earthStyle]}>
        <EarthLimb width={width * 1.4} height={240} />
      </Animated.View>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 120 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  wordmark: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type["2xl"], letterSpacing: 8 },
  tagline: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.base, letterSpacing: 4, textAlign: "center", marginTop: spacing.sm, fontStyle: "italic" },
  status: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: spacing["3xl"], letterSpacing: 0.5 },
  earth: { position: "absolute", bottom: -20, left: "-20%", right: "-20%", alignItems: "center" },
});
