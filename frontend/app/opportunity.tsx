import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import Animated, { FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { getCachedOpportunity, getFavorites, toggleFavorite } from "@/src/lib/opportunityStore";
import { Opportunity } from "@/src/lib/opportunities";
import { aiApi } from "@/src/lib/backend";
import { SenseActionBar } from "@/src/components/SenseActionBar";

const IT_PLANET_TO_ID: Record<string, string> = {
  Mercurio: "mercury", Venere: "venus", Terra: "earth", Marte: "mars",
  Giove: "jupiter", Saturno: "saturn", Urano: "uranus", Nettuno: "neptune", Plutone: "pluto",
};

// Map an opportunity to its GO INSIDE destination (immersive exploration).
function goInsideFor(opp: Opportunity): { cosmic?: string; journey?: string; earth?: boolean } | null {
  if (opp.id === "milkyway") return { cosmic: "milkyway", journey: "inside-milkyway" };
  if (opp.id === "moon") return { cosmic: "moon" };
  if (opp.id === "iss-pass") return { cosmic: "iss" };
  if (opp.id.startsWith("planet-")) {
    const idc = IT_PLANET_TO_ID[opp.id.slice("planet-".length)];
    if (idc) return { cosmic: idc };
  }
  if (opp.layer === "universe" || opp.layer === "sky") return { cosmic: "milkyway" };
  if (opp.layer === "earth" || opp.layer === "solar") return { earth: true };
  return null;
}

export default function OpportunityDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [opp] = useState<Opportunity | undefined>(() => (id ? getCachedOpportunity(id) : undefined));
  const [explanation, setExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (id) getFavorites().then((f) => setFav(f.includes(id)));
  }, [id]);

  useEffect(() => {
    if (!opp) return;
    setAiLoading(true);
    aiApi.explainOpportunity(opp.title, opp.facts, opp.layer)
      .then((r) => setExplanation(r.text))
      .catch(() => setExplanation(null))
      .finally(() => setAiLoading(false));
  }, [opp]);

  if (!opp) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Opportunity" />
        <View style={styles.center}>
          <Text style={styles.empty}>Opportunità non più disponibile. Torna a Today's Opportunities.</Text>
        </View>
      </SpaceBackground>
    );
  }

  const onFav = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFav(await toggleFavorite(opp.id));
  };
  const onShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const text = `${opp.emoji} ${opp.title}\n${opp.summary}\n\nvia Overview • The Invisible Sense`;
    if (await Sharing.isAvailableAsync()) {
      try { await Sharing.shareAsync("data:text/plain," + encodeURIComponent(text)); } catch { /* ignore */ }
    }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title={opp.layerLabel} right={
        <Pressable testID="opp-favorite" onPress={onFav} hitSlop={10}>
          <Ionicons name={fav ? "bookmark" : "bookmark-outline"} size={22} color={fav ? colors.brand : colors.onSurface} />
        </Pressable>
      } />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="opportunity-detail">
        <View style={styles.hero}>
          <Text style={styles.emoji}>{opp.emoji}</Text>
          <Text style={styles.title}>{opp.title}</Text>
          <Text style={styles.summary}>{opp.summary}</Text>
        </View>

        {(opp.bestTime || opp.direction) ? (
          <View style={styles.metaRow}>
            {opp.bestTime ? <Meta icon="time-outline" label="Momento migliore" value={opp.bestTime} /> : null}
            {opp.direction ? <Meta icon="compass-outline" label="Dove guardare" value={opp.direction} /> : null}
          </View>
        ) : null}

        {/* Scientific data */}
        <Section title="DATI SCIENTIFICI" icon="flask">
          {opp.facts.map((f, i) => (
            <View key={i} style={styles.factRow}>
              <View style={styles.dot} />
              <Text style={styles.factText}>{f}</Text>
            </View>
          ))}
        </Section>

        {/* AI explanation */}
        <Section title="SPIEGAZIONE" icon="sparkles">
          {aiLoading ? (
            <ActivityIndicator color={colors.brand} style={{ alignSelf: "flex-start" }} />
          ) : explanation ? (
            <Animated.Text entering={FadeIn.duration(400)} style={styles.aiText}>{explanation}</Animated.Text>
          ) : (
            <Text style={styles.aiText}>Spiegazione non disponibile ora. I dati scientifici sopra restano validi.</Text>
          )}
        </Section>

        {opp.tips.length ? (
          <Section title="CONSIGLI PRATICI" icon="bulb">
            {opp.tips.map((t, i) => (
              <View key={i} style={styles.factRow}>
                <Ionicons name="chevron-forward" size={14} color={colors.brand} style={{ marginTop: 3 }} />
                <Text style={styles.factText}>{t}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {(() => {
          const dest = goInsideFor(opp);
          return (
            <SenseActionBar
              onLookUp={() => router.push("/cielo" as never)}
              onGoInside={dest ? () => {
                if (dest.cosmic) router.push(`/universe-explorer?focus=${dest.cosmic}` as never);
                else if (dest.earth) router.push("/satellite-explore" as never);
              } : undefined}
              onGuidedJourney={dest?.journey ? () => router.push(`/universe-explorer?journey=${dest.journey}` as never) : undefined}
            />
          );
        })()}

        <Pressable style={styles.secondary} onPress={onShare}>
          <Ionicons name="share-outline" size={18} color={colors.onSurface} />
          <Text style={styles.secondaryText}>Condividi opportunità</Text>
        </Pressable>

        <Text style={styles.note}>Ogni dato deriva da calcoli astronomici, sensori del dispositivo o fonti scientifiche pubbliche. L'AI trasforma solo dati verificati in spiegazioni: non inventa mai valori o fenomeni.</Text>
      </ScrollView>
    </SpaceBackground>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={15} color={colors.brand} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function Meta({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metaCard}>
      <Ionicons name={icon} size={16} color={colors.brand} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center" },
  hero: { gap: spacing.sm },
  emoji: { fontSize: 40 },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"], lineHeight: 30 },
  summary: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 24 },
  metaRow: { flexDirection: "row", gap: spacing.md },
  metaCard: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  metaLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 4 },
  metaValue: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  section: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  factRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand, marginTop: 7 },
  factText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21, flex: 1 },
  aiText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  secondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  secondaryText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.6 },
});
