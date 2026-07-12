import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { OpportunityCard } from "@/src/components/OpportunityCard";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useOpportunities } from "@/src/hooks/useOpportunities";
import { useAuth } from "@/src/context/AuthContext";
import { aiApi } from "@/src/lib/backend";

const MOTTO = "The Universe is constantly changing. Don't miss today's opportunities.";

export default function Today() {
  const insets = useSafeAreaInsets();
  const { all, loading, observer } = useOpportunities();
  const { user } = useAuth();
  const [curiosity, setCuriosity] = useState<string | null>(null);
  const [curioLoading, setCurioLoading] = useState(false);

  const factsKey = useMemo(() => all.slice(0, 4).map((o) => o.id).join(","), [all]);

  useEffect(() => {
    if (all.length === 0) return;
    const facts = all.slice(0, 5).flatMap((o) => o.facts).slice(0, 8);
    if (facts.length === 0) return;
    setCurioLoading(true);
    aiApi.curiosity(facts)
      .then((r) => setCuriosity(r.text))
      .catch(() => setCuriosity(null))
      .finally(() => setCurioLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factsKey]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buongiorno";
    if (h < 18) return "Buon pomeriggio";
    return "Buonasera";
  })();

  return (
    <SpaceBackground>
      <ScreenHeader title="Today's Opportunities" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} tintColor={colors.brand} />}
      >
        <View style={styles.mottoWrap}>
          <Text style={styles.motto}>{MOTTO}</Text>
        </View>

        <View style={styles.todayHeader}>
          <Text style={styles.hi}>🌍 {greeting}{user ? `, ${user.nickname}` : ""}.</Text>
          {loading ? (
            <Text style={styles.count}>Analisi dei layer in corso…</Text>
          ) : all.length > 0 ? (
            <Text style={styles.count}>Oggi ci sono <Text style={{ color: colors.brand }}>{all.length} opportunità</Text> da non perdere.</Text>
          ) : (
            <Text style={styles.count}>Attiva la posizione per scoprire le opportunità intorno a te.</Text>
          )}
        </View>

        {/* Curiosity of the day */}
        <View style={styles.curioCard}>
          <View style={styles.curioHead}>
            <Ionicons name="sparkles" size={15} color={colors.brand} />
            <Text style={styles.curioTitle}>CURIOSITÀ DEL GIORNO</Text>
          </View>
          {curioLoading ? (
            <ActivityIndicator color={colors.brand} style={{ alignSelf: "flex-start", marginTop: spacing.sm }} />
          ) : curiosity ? (
            <Animated.Text entering={FadeIn.duration(500)} style={styles.curioText}>{curiosity}</Animated.Text>
          ) : (
            <Text style={styles.curioText}>Le curiosità appariranno quando saranno disponibili dati reali del tuo momento e luogo.</Text>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : all.length === 0 ? (
          observer.status !== "granted" ? (
            <Pressable style={styles.locBtn} onPress={() => observer.request()}>
              <Ionicons name="location" size={18} color={colors.onBrand} />
              <Text style={styles.locText}>Attiva posizione</Text>
            </Pressable>
          ) : (
            <Text style={styles.empty}>Nessuna opportunità di rilievo in questo istante. L'Universo cambia continuamente: riprova più tardi.</Text>
          )
        ) : (
          <View style={{ gap: spacing.md }}>
            {all.map((o) => <OpportunityCard key={o.id} opp={o} />)}
          </View>
        )}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  mottoWrap: { borderLeftWidth: 3, borderLeftColor: colors.brand, paddingLeft: spacing.md, paddingVertical: spacing.xs },
  motto: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, fontStyle: "italic", lineHeight: 21 },
  todayHeader: { gap: spacing.xs },
  hi: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  count: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 23 },
  curioCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  curioHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  curioTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  curioText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21, marginTop: spacing.md },
  locBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg, marginTop: spacing.md },
  locText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
});
