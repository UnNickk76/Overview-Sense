import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { SenseMark } from "@/src/components/SenseMark";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

export const SEEN_INTRO_KEY = "overview_seen_intro";

const CONTENT = {
  it: {
    switch: "EN",
    title: "BEFORE YOU BEGIN",
    paragraphs: [
      "Overview è progettata per rivelare informazioni reali che normalmente rimangono al di fuori della percezione umana quotidiana.",
      "L'app non inventa dati, non crea fenomeni immaginari e non afferma di rilevare ciò che non può essere realmente misurato.",
      "Ogni visualizzazione viene generata utilizzando informazioni reali disponibili attraverso il tuo dispositivo, calcoli scientifici, fonti dati affidabili o sensori compatibili.",
      "L'Intelligenza Artificiale ha il compito di interpretare e rappresentare graficamente queste informazioni per renderle più comprensibili, ma non sostituisce mai dati scientifici né inventa fenomeni.",
      "Alcune funzionalità dipendono dalle capacità hardware del dispositivo utilizzato.",
      "Per questo motivo qualità, precisione e disponibilità di alcune visualizzazioni possono variare da uno smartphone all'altro.",
      "Alcune funzioni potrebbero non essere disponibili su tutti i dispositivi oppure richiedere hardware di nuova generazione o accessori compatibili.",
      "Quando un'informazione non può essere realmente misurata o verificata, Overview semplicemente non la mostra.",
      "La fotocamera, il microfono, i sensori e gli altri permessi vengono utilizzati esclusivamente quando richiesti dall'utente per le funzionalità corrispondenti.",
      "La realtà è molto più ricca di quanto i nostri sensi riescano normalmente a percepire. Overview nasce per aiutarti a scoprirla.",
      "Proseguendo, accetti che ogni visualizzazione rappresenti informazioni reali e misurabili, elaborate graficamente per renderle più comprensibili, senza mai inventare dati o fenomeni inesistenti.",
    ],
    accept: "Ho capito, procedi",
    close: "Chiudi",
  },
  en: {
    switch: "IT",
    title: "BEFORE YOU BEGIN",
    paragraphs: [
      "Overview is designed to reveal real information that normally remains outside everyday human perception.",
      "The app does not invent data, create fictional phenomena or claim to detect anything that cannot be measured.",
      "Every visualization is generated from real information available through your device, scientific calculations, trusted data sources or compatible sensors.",
      "Some features depend on the hardware capabilities of your device.",
      "For this reason, certain visualizations may vary in quality, precision or availability from one device to another.",
      "Some functions may not be available on every smartphone or may require future hardware or supported external accessories.",
      "Whenever data cannot be measured or verified, Overview simply does not display it.",
      "Our goal is simple: not to create another reality, but to reveal more of the one that already exists.",
      "By continuing, you acknowledge that every visualization represents real measurable information interpreted graphically, never invented facts.",
    ],
    accept: "I understand, continue",
    close: "Close",
  },
};

const CLOSING = ["Explore your reality.", "Discover the invisible.", "Overview — The Invisible Sense"];

export default function BeforeYouBegin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const isAbout = from === "about";
  const [lang, setLang] = useState<"it" | "en">("it");
  const c = CONTENT[lang];

  const proceed = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isAbout) { router.back(); return; }
    try { await AsyncStorage.setItem(SEEN_INTRO_KEY, "1"); } catch { /* ignore */ }
    router.replace("/welcome");
  };

  return (
    <SpaceBackground>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        {isAbout ? (
          <Pressable testID="intro-close" hitSlop={12} style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
        <Pressable testID="intro-lang" hitSlop={12} style={styles.langBtn} onPress={() => { Haptics.selectionAsync(); setLang((l) => (l === "it" ? "en" : "it")); }}>
          <Ionicons name="language" size={14} color={colors.brand} />
          <Text style={styles.langText}>{c.switch}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="before-you-begin">
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <SenseMark size={54} />
          <Text style={styles.title}>{c.title}</Text>
          <View style={styles.rule} />
        </Animated.View>

        {c.paragraphs.map((p, i) => (
          <Animated.Text key={`${lang}-${i}`} entering={FadeInDown.delay(120 + i * 70).duration(500)} style={styles.para}>
            {p}
          </Animated.Text>
        ))}

        <Animated.View entering={FadeIn.delay(400).duration(700)} style={styles.closing}>
          <View style={styles.rule} />
          <Text style={styles.closeLine}>{CLOSING[0]}</Text>
          <Text style={styles.closeLine}>{CLOSING[1]}</Text>
          <Text style={styles.brand}>{CLOSING[2]}</Text>
        </Animated.View>

        <Pressable testID="intro-accept" style={styles.cta} onPress={proceed}>
          <Text style={styles.ctaText}>{isAbout ? c.close : c.accept}</Text>
          {!isAbout ? <Ionicons name="arrow-forward" size={18} color={colors.onBrand} /> : null}
        </Pressable>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  langBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  langText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1 },
  header: { alignItems: "center", gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"], letterSpacing: 3, textAlign: "center" },
  rule: { width: 60, height: 2, borderRadius: 1, backgroundColor: colors.brand, opacity: 0.7 },
  para: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 23, textAlign: "center" },
  closing: { alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  closeLine: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, fontStyle: "italic", textAlign: "center" },
  brand: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base, letterSpacing: 1, marginTop: spacing.sm, textAlign: "center" },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.lg, marginTop: spacing.lg },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
});
