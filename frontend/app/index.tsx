import React, { useEffect } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, FadeInDown } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { colors, fonts, spacing, type } from "@/src/theme";

interface Module {
  key: string;
  route: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}

const MODULES: Module[] = [
  { key: "now", route: "/qui-e-ora", title: "Qui e Ora", subtitle: "Cosa accade attorno a te, adesso", icon: "pulse", accent: colors.brand },
  { key: "sky", route: "/cielo", title: "Cielo", subtitle: "Punta il cielo, leggi le stelle", icon: "telescope", accent: colors.blue },
  { key: "universe", route: "/universo", title: "Universo", subtitle: "Naviga il Sistema Solare", icon: "planet", accent: colors.brand },
  { key: "invisible", route: "/realta-invisibile", title: "Realtà Invisibile", subtitle: "Campi, forze e satelliti", icon: "magnet", accent: colors.blue },
  { key: "space-weather", route: "/meteo-spaziale", title: "Meteo Spaziale", subtitle: "Sole, tempeste, aurore", icon: "sunny", accent: colors.brand },
  { key: "audio", route: "/audio", title: "Sonificazione", subtitle: "Ascolta i dati reali", icon: "musical-notes", accent: colors.blue },
  { key: "timeline", route: "/timeline", title: "Timeline", subtitle: "Il cielo di qualsiasi data", icon: "time", accent: colors.brand },
  { key: "ai", route: "/assistant", title: "Assistente", subtitle: "Chiedi cosa stai osservando", icon: "sparkles", accent: colors.blue },
];

function Quote() {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 2600 }), withTiming(0.55, { duration: 2600 })), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.Text style={[styles.quote, style]}>
      The universe is constantly speaking.{"\n"}Overview lets you perceive more.
    </Animated.Text>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as never);
  };

  return (
    <SpaceBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.dot} />
          <Text style={styles.wordmark}>OVERVIEW</Text>
        </View>
        <Text style={styles.tagline}>the Invisible Sense</Text>
        <Quote />

        <View style={styles.grid}>
          {MODULES.map((m, i) => (
            <Animated.View key={m.key} entering={FadeInDown.delay(i * 60).springify().damping(18)} style={styles.cell}>
              <Pressable testID={`module-${m.key}`} onPress={() => go(m.route)}>
                <GlassCard style={styles.moduleCard}>
                  <View style={[styles.iconWrap, { borderColor: m.accent }]}>
                    <Ionicons name={m.icon} size={22} color={m.accent} />
                  </View>
                  <Text style={styles.moduleTitle}>{m.title}</Text>
                  <Text style={styles.moduleSub} numberOfLines={2}>{m.subtitle}</Text>
                </GlassCard>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.footer}>
          Ogni dato proviene da sensori del dispositivo o da fonti scientifiche pubbliche.
        </Text>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  wordmark: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl, letterSpacing: 6 },
  tagline: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.sm, letterSpacing: 3, textAlign: "center", marginBottom: spacing["2xl"], textTransform: "none", fontStyle: "italic" },
  quote: {
    color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.lg,
    textAlign: "center", lineHeight: 26, paddingHorizontal: spacing.xl, marginBottom: spacing["3xl"],
  },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.md },
  cell: { width: "47.5%" },
  moduleCard: { minHeight: 140, justifyContent: "flex-start" },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: spacing.md, backgroundColor: "rgba(0,0,0,0.3)",
  },
  moduleTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  moduleSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2, lineHeight: 17 },
  footer: {
    color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1,
    textAlign: "center", marginTop: spacing["2xl"], paddingHorizontal: spacing.xl, opacity: 0.6,
  },
});
