import React, { useEffect } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing, FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { EarthLimb } from "@/src/components/EarthLimb";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function Welcome() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const logoOpacity = useSharedValue(0.7);
  const earthY = useSharedValue(20);

  useEffect(() => {
    // if already logged in, skip straight to home
    if (user) { router.replace("/feed"); return; }
    logoOpacity.value = withRepeat(withSequence(withTiming(1, { duration: 1600 }), withTiming(0.75, { duration: 1600 })), -1, true);
    earthY.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [logoOpacity, earthY, user, router]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const earthStyle = useAnimatedStyle(() => ({ transform: [{ translateY: earthY.value }] }));

  const go = (path: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(path as never); };

  return (
    <SpaceBackground glow={false}>
      <View style={[styles.content, { paddingTop: insets.top + spacing["3xl"], paddingBottom: insets.bottom + spacing.xl }]}>
        <Animated.View style={[styles.brandBlock, logoStyle]}>
          <View style={styles.brandRow}>
            <View style={styles.dot} />
            <Text style={styles.wordmark}>OVERVIEW</Text>
          </View>
          <Text style={styles.tagline}>The Invisible Sense</Text>
          <View style={styles.betaPill}><Text style={styles.betaPillText}>BETA · IN SVILUPPO</Text></View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(700).delay(300)} style={styles.copy}>
          <Text style={styles.lead}>Reality has always been around you.{"\n"}You simply couldn&apos;t see it.</Text>
          <Text style={styles.signature}>&ldquo;Overview doesn&apos;t create reality. It reveals it.&rdquo;</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(700).delay(500)} style={styles.actions}>
          <Pressable testID="welcome-register" style={styles.primary} onPress={() => go("/register")}>
            <Text style={styles.primaryText}>Crea un account</Text>
          </Pressable>
          <Pressable testID="welcome-login" style={styles.secondary} onPress={() => go("/login")}>
            <Text style={styles.secondaryText}>Accedi</Text>
          </Pressable>
          <Pressable testID="welcome-guest" style={styles.guest} onPress={() => router.replace("/feed")}>
            <Text style={styles.guestText}>Esplora come ospite</Text>
          </Pressable>
        </Animated.View>
      </View>

      <Animated.View style={[styles.earth, earthStyle]} pointerEvents="none">
        <EarthLimb width={width * 1.4} height={220} />
      </Animated.View>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  brandBlock: { alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  wordmark: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type["2xl"], letterSpacing: 8 },
  tagline: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.base, letterSpacing: 4, textAlign: "center", marginTop: spacing.sm, fontStyle: "italic" },
  betaPill: { marginTop: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 3 },
  betaPillText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 3, letterSpacing: 2 },
  copy: { alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.xl },
  lead: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 26, textAlign: "center", letterSpacing: 1 },
  signature: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.base, fontStyle: "italic", textAlign: "center", opacity: 0.85 },
  actions: { width: "100%", paddingHorizontal: spacing.xl, gap: spacing.md },
  primary: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center" },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  secondary: { backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  secondaryText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  guest: { alignItems: "center", paddingVertical: spacing.sm },
  guestText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  earth: { position: "absolute", bottom: -20, left: "-20%", right: "-20%", alignItems: "center", opacity: 0.5 },
});
