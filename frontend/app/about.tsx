import React from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const CONTACT_EMAIL = "[email protected]";

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(delay)} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Animated.View>
  );
}

function Chip({ label }: { label: string }) {
  return <View style={styles.chip}><Text style={styles.chipText}>{label}</Text></View>;
}

export default function About() {
  const insets = useSafeAreaInsets();

  return (
    <SpaceBackground>
      <ScreenHeader title="About Overview" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["3xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="about-screen">
        <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
          <View style={styles.dot} />
          <Text style={styles.wordmark}>OVERVIEW</Text>
          <Text style={styles.tagline}>The Invisible Sense</Text>
          <Text style={styles.intro}>
            Overview è un&apos;esperienza che unisce scienza, tecnologia, osservazione e curiosità per aiutare le persone a
            scoprire ciò che normalmente rimane invisibile. Ogni dato mostrato proviene da fonti reali, sensori del
            dispositivo o calcoli astronomici verificabili.
          </Text>
        </Animated.View>

        <Section title="CREATOR" delay={80}>
          <Text style={styles.big}>Fabio Andreola</Text>
          <Text style={styles.body}>Concept · Design · Original Idea · Project Direction</Text>
          <Text style={styles.muted}>© Tutti i diritti riservati.</Text>
        </Section>

        <Section title="SPECIAL THANKS" delay={140}>
          <Text style={styles.body}>Ringraziamenti speciali agli strumenti e ai sistemi di Intelligenza Artificiale che hanno reso possibile lo sviluppo del progetto.</Text>
          <View style={styles.pair}><Text style={styles.pairKey}>Emergent</Text><Text style={styles.muted}>piattaforma di sviluppo full-stack con AI che ha reso possibile la realizzazione dell&apos;app</Text></View>
          <View style={styles.pair}><Text style={styles.pairKey}>OpenAI · GPT-5.5</Text><Text style={styles.muted}>supporto creativo, sviluppo funzionale, analisi tecnica, brainstorming</Text></View>
          <View style={styles.pair}><Text style={styles.pairKey}>Claude</Text><Text style={styles.muted}>supporto progettuale</Text></View>
          <Text style={styles.muted}>(altri strumenti potranno essere aggiunti in futuro)</Text>
        </Section>

        <Section title="DATA SOURCES" delay={200}>
          <View style={styles.chips}>
            {["NASA", "ESA", "NOAA SWPC", "Open-Meteo", "CelesTrak", "TLE / SGP4", "CoreLocation", "CoreMotion", "Compass", "Camera", "Audio"].map((s) => <Chip key={s} label={s} />)}
          </View>
        </Section>

        <Section title="PRIVACY" delay={260}>
          <Text style={styles.body}>L&apos;app utilizza esclusivamente i permessi necessari alle funzioni richieste dall&apos;utente. Nessun dato viene raccolto senza autorizzazione.</Text>
        </Section>

        <Section title="DISCLAIMER" delay={320}>
          <Text style={styles.body}>Overview non interpreta fenomeni paranormali. L&apos;app rappresenta esclusivamente dati fisici, astronomici e ambientali realmente misurabili. Ogni eventuale interpretazione personale rimane completamente libera e soggettiva.</Text>
        </Section>

        <Section title="VERSION" delay={380}>
          <View style={styles.row}><Text style={styles.rowLabel}>Versione</Text><Text style={styles.rowValue}>1.0.0</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Build</Text><Text style={styles.rowValue}>2026.06</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Ultimo aggiornamento</Text><Text style={styles.rowValue}>Giugno 2026</Text></View>
        </Section>

        <Section title="ROADMAP · COMING SOON" delay={440}>
          {["🌌 Universe Explorer — mappa navigabile e viaggio tra le scale", "🛰️ Satellite Observation — scoperte dai dati satellitari", "🌍 Satellite Intelligence Layer — Then/Now e What Changed", "🗺️ Mappa globale delle Observation", "🏅 Sfide e badge"].map((r) => (
            <View key={r} style={styles.soonRow}><Ionicons name="ellipse" size={6} color={colors.brand} /><Text style={styles.body}>{r}</Text></View>
          ))}
        </Section>

        <Section title="CONTACT" delay={500}>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
            <Ionicons name="mail-outline" size={18} color={colors.brand} /><Text style={styles.link}>{CONTACT_EMAIL}</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://overview.app")}>
            <Ionicons name="globe-outline" size={18} color={colors.brand} /><Text style={styles.link}>overview.app</Text>
          </Pressable>
        </Section>

        <Animated.View entering={FadeInDown.duration(600).delay(560)} style={styles.signatureWrap}>
          <View style={styles.rule} />
          <Text style={styles.signature}>&ldquo;Overview doesn&apos;t create reality. It reveals it.&rdquo;</Text>
          <View style={styles.rule} />
          <Text style={styles.copyright}>© Fabio Andreola</Text>
        </Animated.View>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  wordmark: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type["2xl"], letterSpacing: 7 },
  tagline: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, letterSpacing: 3 },
  intro: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22, textAlign: "center", marginTop: spacing.md },
  section: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  sectionTitle: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.8 },
  big: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  body: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  muted: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  pair: { gap: 2, marginTop: spacing.xs },
  pairKey: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  chip: { backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  rowLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  rowValue: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: type.base },
  soonRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  link: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.base },
  signatureWrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  rule: { width: 120, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  signature: { color: colors.brand, fontFamily: fonts.regular, fontSize: type.lg, fontStyle: "italic", textAlign: "center", opacity: 0.85 },
  copyright: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
});
