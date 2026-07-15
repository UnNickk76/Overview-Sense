import React, { useEffect } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import {
  LIVE_CATEGORIES, LivePreset, useLiveSense, hydrateLiveSense,
  setLiveOn, setLivePreset, toggleLiveCategory, activeCategories,
} from "@/src/lib/liveSense";

const PRESETS: { key: LivePreset; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "wow", label: "Solo WOW", sub: "Solo ciò che è davvero speciale.", icon: "sparkles" },
  { key: "balanced", label: "Bilanciato", sub: "Interessante, senza riempire lo schermo.", icon: "options" },
  { key: "full", label: "Completo", sub: "Riconosce tutto ciò che può.", icon: "infinite" },
  { key: "custom", label: "Personalizzato", sub: "Scegli tu cosa riconoscere.", icon: "construct" },
];

export default function LiveSenseControl() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useLiveSense();
  useEffect(() => { hydrateLiveSense(); }, []);
  const active = new Set(activeCategories(s));

  return (
    <SpaceBackground>
      <ScreenHeader title="Live Sense™" subtitle="Centro di Controllo" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="eye" size={22} color={colors.brand} />
          <Text style={styles.heroText}>Punta la Sense Vision™ verso il mondo. Live Sense™ interpreta ciò che vede e, quando riconosce qualcosa con buona affidabilità, te lo mostra in tempo reale. Non una ricerca — una scoperta.</Text>
        </View>

        <View style={styles.masterRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.masterTitle}>Riconoscimento in tempo reale</Text>
            <Text style={styles.masterSub}>Attivo ovunque apri la Sense Vision™.</Text>
          </View>
          <Switch testID="livesense-master" value={s.on} onValueChange={(v) => { Haptics.selectionAsync(); setLiveOn(v); }}
            trackColor={{ true: colors.brand, false: colors.border }} thumbColor="#fff" />
        </View>

        <View style={{ opacity: s.on ? 1 : 0.4 }} pointerEvents={s.on ? "auto" : "none"}>
          <Text style={styles.sectionTitle}>LIVELLO</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {PRESETS.map((p) => {
              const on = s.preset === p.key;
              return (
                <Pressable key={p.key} testID={`preset-${p.key}`} onPress={() => { Haptics.selectionAsync(); setLivePreset(p.key); }}
                  style={[styles.preset, on && styles.presetOn]}>
                  <Ionicons name={p.icon} size={18} color={on ? colors.brand : colors.onSurfaceSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.presetLabel, on && { color: colors.brand }]}>{p.label}</Text>
                    <Text style={styles.presetSub}>{p.sub}</Text>
                  </View>
                  <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.brand : colors.onSurfaceSecondary} />
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>CATEGORIE {s.preset !== "custom" ? "· attive con questo livello" : "· scegli le tue"}</Text>
          <Text style={styles.catHint}>Tocca una categoria per personalizzare. Le altre sezioni dell&apos;app aggiungono i loro strumenti, ma il motore di osservazione è sempre lo stesso.</Text>
          <View style={styles.catGrid}>
            {LIVE_CATEGORIES.map((c) => {
              const on = active.has(c.key);
              return (
                <Pressable key={c.key} testID={`cat-${c.key}`} onPress={() => { Haptics.selectionAsync(); toggleLiveCategory(c.key); }}
                  style={[styles.cat, on && styles.catOn]}>
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                  <Text style={[styles.catLabel, on && { color: colors.onSurface }]}>{c.label}</Text>
                  <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={15} color={on ? colors.brand : colors.onSurfaceSecondary} />
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.note}>🌌 Astronomia usa solo dati reali (bussola, sensori, GPS, calcoli): zero AI, nessun dato inventato. Le altre categorie vengono riconosciute in tempo reale e mostrate solo con buona affidabilità (✔ Riconosciuto o ≈ Probabile). Meglio nessuna informazione che una sbagliata.</Text>

          <Pressable testID="open-privacy-consent" style={styles.linkRow} onPress={() => router.push("/privacy-consent" as never)}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.brand} />
            <Text style={styles.linkText}>Privacy & Consensi™ · Presence Match™</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>
        </View>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heroText: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  masterRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  masterTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  masterSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  sectionTitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1 },
  preset: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  presetOn: { borderColor: colors.brand },
  presetLabel: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  presetSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  catHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 4, lineHeight: 16 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  cat: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  catOn: { borderColor: colors.brand },
  catEmoji: { fontSize: 15 },
  catLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, marginTop: spacing.xl, fontStyle: "italic" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginTop: spacing.lg },
  linkText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
});
