import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { MiniSun, MiniOrrery, MiniField } from "@/src/components/MiniViz";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { api, Weather, SpaceWeather, ISS } from "@/src/lib/api";
import { computeSky } from "@/src/lib/skyObjects";
import { dayNumber, sun, toHorizontal, moonPhase, earthRotationSpeedKmh, sunLightMinutes, AU_KM } from "@/src/lib/astronomy";
import { nf } from "@/src/lib/format";

type Viz = "sun" | "orrery" | "field" | null;
interface Layer {
  key: string; route: string; overline: string; title: string;
  icon: keyof typeof Ionicons.glyphMap; accent: string; viz: Viz;
}

const LAYERS: Layer[] = [
  { key: "now", route: "/qui-e-ora", overline: "EARTH LAYER", title: "Qui e Ora", icon: "pulse", accent: colors.brand, viz: null },
  { key: "sky", route: "/cielo", overline: "SKY LAYER", title: "Cielo", icon: "telescope", accent: colors.blue, viz: null },
  { key: "universe", route: "/universo", overline: "UNIVERSE LAYER", title: "Universo", icon: "planet", accent: colors.brand, viz: "orrery" },
  { key: "invisible", route: "/realta-invisibile", overline: "MAGNETIC LAYER", title: "Realtà Invisibile", icon: "magnet", accent: colors.blue, viz: "field" },
  { key: "space-weather", route: "/meteo-spaziale", overline: "SOLAR LAYER", title: "Meteo Spaziale", icon: "sunny", accent: colors.brand, viz: "sun" },
  { key: "audio", route: "/audio", overline: "SIGNAL LAYER", title: "Sonificazione", icon: "musical-notes", accent: colors.blue, viz: null },
  { key: "timeline", route: "/timeline", overline: "TIME LAYER", title: "Timeline", icon: "time", accent: colors.brand, viz: null },
  { key: "ai", route: "/assistant", overline: "GUIDE", title: "Assistente", icon: "sparkles", accent: colors.blue, viz: null },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const obs = useObserver();
  const now = useNow(1000);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const [iss, setIss] = useState<ISS | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    api.spaceWeather().then(setSpace).catch(() => {});
    api.iss().then(setIss).catch(() => {});
  }, []);
  useEffect(() => {
    if (obs.status === "granted") api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  const live = useMemo(() => {
    const d = dayNumber(now);
    const ph = moonPhase(d);
    const s = sun(d);
    const hasLoc = obs.status === "granted";
    const sunHz = hasLoc ? toHorizontal(s.ra, s.dec, obs.lat, obs.lon, d) : null;
    const objs = hasLoc ? computeSky(now, obs.lat, obs.lon) : [];
    const up = objs.filter((o) => o.alt > 3);
    const upCount = up.length;
    const planets = up.filter((o) => o.kind === "planet").sort((a, b) => a.magnitude - b.magnitude);
    const stars = up.filter((o) => o.kind === "star").sort((a, b) => a.magnitude - b.magnitude);
    const moonUp = up.find((o) => o.kind === "moon");
    let highlight = "Punta il cielo";
    if (sunHz && sunHz.alt > 5) highlight = "Sole alto in cielo";
    else if (planets[0]) highlight = `${planets[0].name} visibile`;
    else if (moonUp) highlight = "Luna visibile";
    else if (stars[0]) highlight = `${stars[0].name} visibile`;
    return {
      phase: ph, sunAlt: sunHz ? sunHz.alt : null, hasLoc, upCount, highlight,
      rotKmh: hasLoc ? earthRotationSpeedKmh(obs.lat) : null,
      lightMin: sunLightMinutes(s.dist), sunDistM: (s.dist * AU_KM) / 1e6,
    };
  }, [now, obs.status, obs.lat, obs.lon]);

  const phrases = useMemo(() => {
    const list: string[] = [
      "In questo momento viaggi a circa 107.000 km/h insieme alla Terra attorno al Sole.",
      `La luce che ti illumina è partita dal Sole circa ${nf(live.lightMin, 1)} minuti fa.`,
      "In questo istante miliardi di neutrini solari stanno attraversando il tuo corpo.",
    ];
    if (live.rotKmh) list.push(`La Terra ruota sotto i tuoi piedi a circa ${nf(live.rotKmh, 0)} km/h.`);
    if (live.hasLoc) list.push(`In questo momento ${live.upCount} corpi celesti sono sopra il tuo orizzonte.`);
    if (iss?.available) list.push("La Stazione Spaziale sta orbitando la Terra a circa 27.600 km/h.");
    return list;
  }, [live, iss]);

  useEffect(() => {
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % Math.max(1, phrases.length)), 5000);
    return () => clearInterval(t);
  }, [phrases.length]);

  const captionFor = (key: string): string => {
    switch (key) {
      case "now": {
        const t = weather?.temperature_c != null ? `${nf(weather.temperature_c, 0)}°` : "—";
        const sunTxt = live.sunAlt != null ? ` · Sole ${nf(live.sunAlt, 0)}°` : "";
        return `${t} · ${live.phase.emoji} ${nf(live.phase.illumination * 100, 0)}%${sunTxt}`;
      }
      case "sky": return live.highlight;
      case "space-weather": return space?.kp_index?.available ? `Kp ${nf(space.kp_index.value ?? 0, 1)} · ${space.kp_index.level}` : "NOAA · in ascolto";
      case "invisible": return iss?.available ? "ISS + campi in tempo reale" : "Campi, forze e satelliti";
      case "universe": return "Sistema Solare in movimento";
      case "audio": return "Ascolta i dati reali";
      case "timeline": return "Il cielo di qualsiasi data";
      case "ai": return "Chiedi cosa stai osservando";
      default: return "";
    }
  };

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
        <View style={styles.phraseWrap}>
          <Animated.Text key={phraseIdx} entering={FadeIn.duration(800)} style={styles.phrase}>
            {phrases[phraseIdx]}
          </Animated.Text>
        </View>

        <Text style={styles.sectionLabel}>ACCENDI UNO STRATO DELLA REALTÀ</Text>

        <View style={styles.grid}>
          {LAYERS.map((l, i) => (
            <Animated.View key={l.key} entering={FadeInDown.delay(i * 55).springify().damping(18)} style={styles.cell}>
              <Pressable testID={`module-${l.key}`} onPress={() => go(l.route)}>
                <GlassCard style={styles.card}>
                  <View style={styles.cardTop}>
                    {l.viz === "sun" ? <MiniSun size={42} kp={space?.kp_index?.value ?? 0} />
                      : l.viz === "orrery" ? <MiniOrrery size={42} />
                      : l.viz === "field" ? <MiniField size={42} />
                      : (
                        <View style={[styles.iconWrap, { borderColor: l.accent }]}>
                          <Ionicons name={l.icon} size={20} color={l.accent} />
                        </View>
                      )}
                  </View>
                  <Text style={styles.overline}>{l.overline}</Text>
                  <Text style={styles.title}>{l.title}</Text>
                  <Text style={styles.caption} numberOfLines={2}>{captionFor(l.key)}</Text>
                </GlassCard>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.footer}>
          Ogni dato proviene da sensori del dispositivo o da fonti scientifiche pubbliche. Mai inventato.
        </Text>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand },
  wordmark: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl, letterSpacing: 6 },
  phraseWrap: { minHeight: 66, justifyContent: "center", paddingHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.xl },
  phrase: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.lg, textAlign: "center", lineHeight: 25 },
  sectionLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1, letterSpacing: 1.5, textAlign: "center", marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.md },
  cell: { width: "47.5%" },
  card: { minHeight: 150, justifyContent: "flex-start" },
  cardTop: { height: 46, marginBottom: spacing.sm },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  overline: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 3, letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: 2 },
  caption: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1, marginTop: 4, lineHeight: 16 },
  footer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, textAlign: "center", marginTop: spacing["2xl"], paddingHorizontal: spacing.xl, opacity: 0.55 },
});
