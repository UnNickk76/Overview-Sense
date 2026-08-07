import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { BottomNav } from "@/src/components/BottomNav";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

/**
 * Ecoes World™ — second pillar scaffold (full Globe + Connections arrive in Fase 2).
 * Uses the SAME Earth as the rest of the app, but at a different layer of reality:
 * no states, borders or cities — only the planet, because thought belongs to humanity.
 */
export default function EcoesWorld() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withSequence(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
    ), -1, false);
  }, [pulse]);

  const ring = useAnimatedStyle(() => ({ opacity: 0.5 - pulse.value * 0.45, transform: [{ scale: 1 + pulse.value * 0.7 }] }));
  const dot = useAnimatedStyle(() => ({ opacity: 0.6 + pulse.value * 0.4 }));

  return (
    <SpaceBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Ecoes World™</Text>
          <Text style={styles.subtitle}>Le connessioni invisibili, rese visibili</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120, alignItems: "center", gap: spacing.xl, paddingTop: spacing.xl }}>
        {/* Clean planet — no borders, no cities. A living pulsation of an idea. */}
        <View style={styles.globeWrap}>
          <View style={styles.globe}>
            <Image source={require("@/assets/images/ecoes-icon.png")} style={styles.globeImg} contentFit="contain" />
          </View>
          <Animated.View style={[styles.pulseRing, ring]} pointerEvents="none" />
          <Animated.View style={[styles.pulseDot, dot]} pointerEvents="none" />
        </View>

        <View style={styles.toggleRow}>
          <View style={[styles.toggle, styles.toggleOn]}>
            <Ionicons name="planet" size={15} color={colors.onBrand} />
            <Text style={styles.toggleOnText}>Ecoes Globe</Text>
          </View>
          <View style={styles.toggle}>
            <Ionicons name="albums-outline" size={15} color={colors.onSurfaceSecondary} />
            <Text style={styles.toggleText}>My Ecoes</Text>
          </View>
        </View>

        <View style={styles.philosophy}>
          <Text style={styles.pTitle}>OverView non crea connessioni.</Text>
          <Text style={styles.pBody}>Le rileva e le rende visibili. Ecoes rende percepibili le risonanze tra pensieri, idee, osservazioni ed emozioni — senza follower, senza numeri, senza gara. Solo la vita di una Connection, raccontata da una pulsazione.</Text>
        </View>

        <View style={styles.soon}>
          <Ionicons name="sparkles" size={16} color={colors.brand} />
          <Text style={styles.soonText}>Le Connection appariranno qui quando l'AI rileverà una vera risonanza tra i tuoi contenuti e quelli dell'umanità.</Text>
        </View>
      </ScrollView>

      <BottomNav active="ecoes" />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  globeWrap: { width: 240, height: 240, alignItems: "center", justifyContent: "center" },
  globe: { width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(88,166,255,0.06)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  globeImg: { width: 120, height: 120, opacity: 0.9 },
  pulseRing: { position: "absolute", width: 180, height: 180, borderRadius: 90, borderWidth: 1.5, borderColor: colors.blue },
  pulseDot: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: colors.blue, top: 56, right: 62, shadowColor: colors.blue, shadowOpacity: 0.9, shadowRadius: 8 },
  toggleRow: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  toggleOn: { backgroundColor: colors.brand },
  toggleOnText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  toggleText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  philosophy: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" },
  pTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, textAlign: "center" },
  pBody: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22, textAlign: "center" },
  soon: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  soonText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, flex: 1, lineHeight: 18 },
});
