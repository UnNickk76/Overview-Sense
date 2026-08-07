import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, Modal } from "react-native";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { BlurView } from "expo-blur";
import { MiniSun, MiniOrrery, MiniField } from "@/src/components/MiniViz";
import { HomeTopCards } from "@/src/components/HomeTopCards";
import { BottomNav } from "@/src/components/BottomNav";
import { BrandName } from "@/src/components/Brand";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useAuth } from "@/src/context/AuthContext";
import { api, SpaceWeather } from "@/src/lib/api";
import { socialApi } from "@/src/lib/backend";
import { computeSky } from "@/src/lib/skyObjects";
import { dayNumber, sun, moon, toHorizontal, moonPhase, earthRotationSpeedKmh, sunLightMinutes, AU_KM, EARTH_RADIUS_KM } from "@/src/lib/astronomy";
import { loadSatrecs, hasSatrecs, satellitesOverhead } from "@/src/lib/satellites";
import { nf } from "@/src/lib/format";

const RING = require("@/assets/images/icon-ring.png");

type Viz = "sun" | "orrery" | "field" | null;
interface Item {
  key: string; route: string; title: string; teaser: string;
  icon: keyof typeof Ionicons.glyphMap; accent: string; viz: Viz;
}
interface Group {
  key: string; overline: string; title: string; teaser: string;
  icon: keyof typeof Ionicons.glyphMap; accent: string; items: Item[];
}

// EARTH — the place we are in, its environment and what we can't normally sense.
const EARTH_ITEMS: Item[] = [
  { key: "now", route: "/qui-e-ora", title: "Qui e Ora", teaser: "Scopri il tuo ambiente.", icon: "pulse", accent: colors.brand, viz: null },
  { key: "invisible", route: "/realta-invisibile", title: "Realtà Invisibile", teaser: "Ciò che gli altri non vedono.", icon: "magnet", accent: colors.blue, viz: "field" },
  { key: "space-weather", route: "/meteo-spaziale", title: "Meteo Spaziale", teaser: "Il Sole e lo spazio vicino.", icon: "sunny", accent: colors.brand, viz: "sun" },
  { key: "audio", route: "/audio", title: "Sonificazione", teaser: "Ascolta i dati reali.", icon: "musical-notes", accent: colors.blue, viz: null },
  { key: "timeline", route: "/timeline", title: "Timeline", teaser: "Il cielo di qualsiasi data.", icon: "time", accent: colors.brand, viz: null },
];
// EXPLORE — observation beyond the Earth.
const EXPLORE_ITEMS: Item[] = [
  { key: "sky", route: "/cielo", title: "Cielo", teaser: "Osserva oltre l'orizzonte.", icon: "telescope", accent: colors.blue, viz: null },
  { key: "universe", route: "/universo", title: "Universo", teaser: "Esplora il cosmo.", icon: "planet", accent: colors.brand, viz: "orrery" },
  { key: "satellite", route: "/earth-explorer", title: "Satelliti", teaser: "Viaggia sulla Terra.", icon: "earth", accent: colors.blue, viz: null },
];
// DISCOVER — AI-guided discovery tools.
const DISCOVER_ITEMS: Item[] = [
  { key: "guide", route: "/overview-guide", title: "Guidami", teaser: "Chiedi cosa osservare.", icon: "compass", accent: colors.brand, viz: null },
  { key: "ai", route: "/assistant", title: "Assistente", teaser: "Chiedi cosa stai osservando.", icon: "sparkles", accent: colors.blue, viz: null },
];

const GROUPS: Group[] = [
  { key: "earth", overline: "EARTH", title: "Earth", teaser: "Qui, ora e l'invisibile.", icon: "earth", accent: colors.brand, items: EARTH_ITEMS },
  { key: "explore", overline: "EXPLORE", title: "Explore", teaser: "Oltre la Terra.", icon: "telescope", accent: colors.blue, items: EXPLORE_ITEMS },
  { key: "discover", overline: "DISCOVER", title: "Discover", teaser: "Scoperta guidata dall'AI.", icon: "sparkles", accent: colors.brand, items: DISCOVER_ITEMS },
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const obs = useObserver();
  const now = useNow(1000);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(() => Math.floor(Math.random() * 8));
  const [satCount, setSatCount] = useState<number | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const [menu, setMenu] = useState<Group | null>(null);

  // Detect new Observations in the OverView Sense Universe since last visit.
  useEffect(() => {
    (async () => {
      try {
        const res = await socialApi.feed({ sort: "recent" });
        const newest = res.items.reduce((acc, o) => (o.created_at > acc ? o.created_at : acc), "");
        if (!newest) return;
        const seen = await AsyncStorage.getItem("osu_last_seen");
        setHasNew(!seen || newest > seen);
      } catch { /* offline: no badge */ }
    })();
  }, []);

  // Gentle pulse for the "new discoveries" gold dot.
  const dot = useSharedValue(1);
  useEffect(() => {
    if (hasNew) {
      dot.value = withRepeat(withSequence(
        withTiming(1.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ), -1, false);
    } else {
      dot.value = withTiming(1);
    }
  }, [hasNew, dot]);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));

  useEffect(() => {
    api.spaceWeather().then(setSpace).catch(() => {});
    if (!hasSatrecs()) {
      api.satellites().then((r) => { if (r.available && r.satellites?.length) loadSatrecs(r.satellites); }).catch(() => {});
    }
  }, []);
  useEffect(() => {
    if (obs.status === "granted" && hasSatrecs()) {
      try { setSatCount(satellitesOverhead(new Date(), obs.lat, obs.lon).length); } catch { /* ignore */ }
    }
  }, [obs.status, obs.lat, obs.lon]);

  const live = useMemo(() => {
    const d = dayNumber(now);
    const ph = moonPhase(d);
    const s = sun(d);
    const m = moon(d);
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
      moonDistKm: m.dist * EARTH_RADIUS_KM,
    };
  }, [now, obs.status, obs.lat, obs.lon]);

  const phrases = useMemo(() => {
    const list: string[] = [
      "🌍 In questo momento viaggi a circa 107.000 km/h insieme alla Terra attorno al Sole.",
      `☀️ La luce del Sole impiega circa ${nf(live.lightMin, 1)} minuti per raggiungerti.`,
      "🌍 La Terra ruota a circa 1.670 km/h all'equatore.",
      "✨ In questo preciso istante l'Universo sta cambiando, anche se non possiamo accorgercene.",
      "🌌 Il Sistema Solare sta orbitando attorno al centro della Via Lattea a circa 828.000 km/h.",
      "📡 La ISS completa un'orbita completa della Terra in circa 90 minuti.",
      "🌠 Ogni giorno migliaia di piccoli frammenti cosmici entrano nell'atmosfera terrestre.",
      "🔬 In questo istante miliardi di neutrini solari stanno attraversando il tuo corpo.",
    ];
    list.push(`🌙 La Luna dista in questo momento circa ${nf(live.moonDistKm, 0)} km da te.`);
    if (live.rotKmh) list.push(`🧭 Alla tua latitudine la rotazione terrestre ti trascina a circa ${nf(live.rotKmh, 0)} km/h.`);
    if (live.hasLoc) list.push(`🔭 In questo momento ${live.upCount} corpi celesti sono sopra il tuo orizzonte.`);
    if (satCount != null && satCount > 0) list.push(`🛰️ In questo momento ${satCount} satelliti stanno transitando sopra di te.`);
    return list;
  }, [live, satCount]);

  useEffect(() => {
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % Math.max(1, phrases.length)), 5000);
    return () => clearInterval(t);
  }, [phrases.length]);

  const go = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as never);
  };

  return (
    <SpaceBackground>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.dot} />
          <BrandName name="OverView" style={styles.wordmark} />
          <View style={styles.brandActions}>
            <Pressable testID="home-activity" style={styles.brandIcon} hitSlop={10}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(user ? "/activity" as never : "/login" as never); }}>
              <Ionicons name="notifications-outline" size={24} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="home-profile" style={styles.brandIcon} hitSlop={10}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(user ? `/profile?id=${user.id}` as never : "/login" as never); }}>
              <Ionicons name={user ? "person-circle" : "person-circle-outline"} size={28} color={user ? colors.brand : colors.onSurface} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.tagline}>The Invisible Sense</Text>
        <Text style={styles.motto}>The Universe is constantly changing. Don&apos;t miss today&apos;s opportunities.</Text>
        <View style={styles.phraseWrap}>
          <Animated.Text key={phraseIdx} entering={FadeIn.duration(800)} style={styles.phrase}>
            {phrases[phraseIdx % phrases.length]}
          </Animated.Text>
        </View>

        <HomeTopCards />

        <Text style={styles.sectionLabel}>ESPLORA LA REALTÀ</Text>

        <View style={styles.grid}>
          {GROUPS.map((g, i) => (
            <Animated.View key={g.key} entering={FadeInDown.delay(i * 55).springify().damping(18)} style={styles.cell}>
              <Pressable testID={`group-${g.key}`} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMenu(g); }}>
                <View style={styles.card}>
                  <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.cardTint} />
                  <View style={styles.cardIcon}>
                    <View style={[styles.iconWrap, { borderColor: g.accent }]}>
                      <Ionicons name={g.icon} size={19} color={g.accent} />
                    </View>
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.overline} numberOfLines={1}>{g.overline} · {g.items.length}</Text>
                    <Text style={styles.title} numberOfLines={1}>{g.title}</Text>
                    <Text style={styles.caption} numberOfLines={1}>{g.teaser}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={colors.onSurfaceSecondary} />
                </View>
              </Pressable>
            </Animated.View>
          ))}

          {/* Pulse — daily observational challenges */}
          <Animated.View entering={FadeInDown.delay(GROUPS.length * 55).springify().damping(18)} style={styles.cell}>
            <Pressable testID="module-pulse" onPress={() => go("/challenges")}>
              <View style={styles.card}>
                <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.cardTint} />
                <View style={styles.cardIcon}>
                  <View style={[styles.iconWrap, { borderColor: colors.brand }]}>
                    <Ionicons name="flash" size={19} color={colors.brand} />
                  </View>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.overline} numberOfLines={1}>PULSE™</Text>
                  <BrandName name="Pulse" style={styles.title} />
                  <Text style={styles.caption} numberOfLines={1}>Sfide per osservare.</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Observe — the social layer stays independent */}
          <Animated.View entering={FadeInDown.delay((GROUPS.length + 1) * 55).springify().damping(18)} style={styles.cell}>
            <Pressable testID="module-feed" onPress={() => go("/feed")}>
              <View style={styles.card}>
                <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.cardTint} />
                <View style={styles.cardIcon}>
                  <View>
                    <Image source={RING} style={styles.ringIcon} contentFit="cover" />
                    {hasNew && <Animated.View style={[styles.cardNewDot, dotStyle]} pointerEvents="none" />}
                  </View>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.overline} numberOfLines={1}>OBSERVE</Text>
                  <Text style={styles.title} numberOfLines={1}>Observe</Text>
                  <Text style={styles.caption} numberOfLines={1}>Cosa osservano gli altri.</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Gallery — personal collection, independent */}
          <Animated.View entering={FadeInDown.delay((GROUPS.length + 2) * 55).springify().damping(18)} style={styles.cell}>
            <Pressable testID="module-gallery" onPress={() => go("/observations")}>
              <View style={styles.card}>
                <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.cardTint} />
                <View style={styles.cardIcon}>
                  <View style={[styles.iconWrap, { borderColor: colors.brand }]}>
                    <Ionicons name="images" size={19} color={colors.brand} />
                  </View>
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.overline} numberOfLines={1}>I TUOI SENSHOT</Text>
                  <Text style={styles.title} numberOfLines={1}>Galleria</Text>
                  <Text style={styles.caption} numberOfLines={1}>Le tue scoperte.</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </View>

        <Pressable testID="home-observe-world" style={styles.worldBanner} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/observe-world" as never); }}>
          <View style={styles.worldIcon}><Ionicons name="earth" size={22} color={colors.brand} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.worldTitle}>Observe World™</Text>
            <Text style={styles.worldSub}>Il museo vivente della realtà — niente like, solo valore</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceSecondary} />
        </Pressable>

        <Pressable testID="home-ecoes-world" style={styles.ecoesBanner} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/ecoes-world" as never); }}>
          <View style={styles.ecoesIcon}>
            <Image source={require("@/assets/images/ecoes-icon.png")} style={{ width: 30, height: 30 }} contentFit="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ecoesTitle}>Ecoes World™</Text>
            <Text style={styles.worldSub}>Le connessioni invisibili tra i pensieri, rese visibili</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceSecondary} />
        </Pressable>

        <Pressable testID="home-signature" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/about" as never); }} style={styles.signatureWrap}>
          <View style={styles.sigRule} />
          <Text style={styles.signature}>&ldquo;OverView doesn&apos;t create reality. It reveals it.&rdquo;</Text>
          <View style={styles.sigRule} />
          <Text style={styles.copyright}>© Fabio Andreola</Text>
        </Pressable>

        <Text style={styles.footer}>
          Ogni dato proviene da sensori del dispositivo o da fonti scientifiche pubbliche. Mai inventato.
        </Text>
      </ScrollView>

      {/* Group menu — opens sub-sections without leaving Home */}
      <Modal visible={!!menu} transparent animationType="slide" onRequestClose={() => setMenu(null)}>
        <Pressable style={styles.menuScrim} onPress={() => setMenu(null)}>
          <Pressable style={[styles.menuSheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={styles.menuHandle} />
            <View style={styles.menuHead}>
              <View style={[styles.iconWrap, { borderColor: menu?.accent ?? colors.brand }]}>
                <Ionicons name={menu?.icon ?? "planet"} size={20} color={menu?.accent ?? colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.overline}>{menu?.overline}</Text>
                <Text style={styles.menuTitle}>{menu?.title}</Text>
              </View>
              <Pressable testID="menu-close" hitSlop={10} onPress={() => setMenu(null)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            {menu?.items.map((it) => (
              <Pressable key={it.key} testID={`menu-item-${it.key}`} style={styles.menuItem}
                onPress={() => { setMenu(null); go(it.route); }}>
                <View style={styles.menuItemIcon}>
                  {it.viz === "sun" ? <MiniSun size={38} kp={space?.kp_index?.value ?? 0} />
                    : it.viz === "orrery" ? <MiniOrrery size={38} />
                    : it.viz === "field" ? <MiniField size={38} />
                    : (
                      <View style={[styles.iconWrap, { borderColor: it.accent }]}>
                        <Ionicons name={it.icon} size={18} color={it.accent} />
                      </View>
                    )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>{it.title}</Text>
                  <Text style={styles.menuItemTeaser}>{it.teaser}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <BottomNav active="home" />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand },
  wordmark: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl, letterSpacing: 1.5 },
  brandActions: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  brandIcon: { alignItems: "center", justifyContent: "center" },
  ringIcon: { width: 42, height: 42, borderRadius: 21 },
  cardNewDot: { position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand, borderWidth: 1.5, borderColor: "#000" },
  tagline: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, letterSpacing: 3, textAlign: "center", marginTop: spacing.xs },
  motto: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.sm, fontStyle: "italic", textAlign: "center", marginTop: spacing.sm, paddingHorizontal: spacing.xl, lineHeight: 18 },
  phraseWrap: { minHeight: 66, justifyContent: "center", paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.lg },
  phrase: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.lg, textAlign: "center", lineHeight: 25 },
  sectionLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1, letterSpacing: 1.5, textAlign: "center", marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: spacing.md },
  cell: { width: "47.5%" },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.lg, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(26,29,36,0.75)" },
  cardIcon: { width: 40, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  overline: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 4, letterSpacing: 0.8 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, marginTop: 1 },
  caption: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 2 },
  footer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, textAlign: "center", marginTop: spacing["2xl"], paddingHorizontal: spacing.xl, opacity: 0.55 },
  signatureWrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl, marginTop: spacing.lg },
  worldBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand, marginHorizontal: spacing.lg, marginTop: spacing.lg },
  worldIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.1)" },
  worldTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  worldSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  ecoesBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.blue, marginHorizontal: spacing.lg, marginTop: spacing.md },
  ecoesIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(88,166,255,0.12)" },
  ecoesTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  sigRule: { width: 100, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  signature: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.lg, fontStyle: "italic", textAlign: "center", opacity: 0.8, paddingHorizontal: spacing.xl },
  copyright: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, opacity: 0.7 },
  universeShortcut: { position: "absolute", left: spacing.lg, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  menuScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  menuSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  menuHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  menuHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, marginBottom: spacing.sm },
  menuTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  menuItemIcon: { width: 40, alignItems: "center", justifyContent: "center" },
  menuItemTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  menuItemTeaser: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
});
