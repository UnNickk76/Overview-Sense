import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Constellation } from "@/src/lib/constellations";
import { STARS } from "@/src/lib/stars";
import { useLang } from "@/src/context/LangContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

// Two levels: Sense Summary™ (quick read) → Explore (full scientific card).
export function ConstellationSheet({ c, firstDiscovery, onClose }: {
  c: Constellation; firstDiscovery?: boolean; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const [explore, setExplore] = useState(false);
  const it = lang === "it";

  const mainStars = c.stars
    .map((n) => STARS.find((s) => s.name === n))
    .filter(Boolean)
    .sort((a, b) => a!.mag - b!.mag)
    .slice(0, 6) as typeof STARS;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{c.name}</Text>
              <Text style={styles.subtitle}>{it ? c.it : c.name} · {it ? c.info.bestPeriod : c.info.bestPeriodEn}</Text>
            </View>
            {firstDiscovery ? (
              <View style={styles.badge}>
                <Ionicons name="sparkles" size={12} color={colors.onBrand} />
                <Text style={styles.badgeTxt}>First Discovery</Text>
              </View>
            ) : null}
          </View>

          {!explore ? (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Sense Summary™</Text>
                <Text style={styles.summaryText}>{it ? c.summary : c.summaryEn}</Text>
              </View>
              <Pressable testID="const-explore" style={styles.exploreBtn} onPress={() => { Haptics.selectionAsync(); setExplore(true); }}>
                <Ionicons name="telescope-outline" size={18} color={colors.onBrand} />
                <Text style={styles.exploreTxt}>Explore</Text>
              </Pressable>
            </>
          ) : (
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              <Section title={it ? "Storia" : "History"} text={c.info.history} icon="book-outline" show={it} />
              <Section title={it ? "Mitologia" : "Mythology"} text={c.info.mythology} icon="sparkles-outline" show={it} />
              <Text style={styles.secTitle}><Ionicons name="star-outline" size={13} color={colors.brand} /> {it ? "Stelle principali" : "Main stars"}</Text>
              {mainStars.map((s) => (
                <View key={s.name} style={styles.starRow}>
                  <Text style={styles.starName}>{s.name}</Text>
                  <Text style={styles.starMeta}>mag {s.mag.toFixed(2)} · {s.distanceLy} ly · {s.spectralType}</Text>
                </View>
              ))}
              <Text style={styles.secTitle}><Ionicons name="bulb-outline" size={13} color={colors.brand} /> {it ? "Curiosità" : "Curiosities"}</Text>
              {(it ? c.info.curiosities : c.info.curiositiesEn).map((cu, i) => (
                <View key={i} style={styles.curioRow}>
                  <Text style={styles.curioDot}>•</Text>
                  <Text style={styles.curioTxt}>{cu}</Text>
                </View>
              ))}
              <Text style={styles.secTitle}><Ionicons name="time-outline" size={13} color={colors.brand} /> {it ? "Periodo migliore" : "Best period"}</Text>
              <Text style={styles.body}>{it ? c.info.bestPeriod : c.info.bestPeriodEn}</Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, text, icon, show }: { title: string; text: string; icon: keyof typeof Ionicons.glyphMap; show: boolean }) {
  return (
    <>
      <Text style={styles.secTitle}><Ionicons name={icon} size={13} color={colors.brand} /> {title}</Text>
      <Text style={styles.body}>{text}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"] },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: 10 },
  summaryCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  summaryLabel: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  exploreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, marginTop: spacing.md },
  exploreTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
  secTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, marginTop: spacing.md, marginBottom: 4 },
  body: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  starRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  starName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  starMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  curioRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  curioDot: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.base },
  curioTxt: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
});
