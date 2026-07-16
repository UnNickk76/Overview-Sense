import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { storage } from "@/src/utils/storage";
import { useLang } from "@/src/context/LangContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const KEY = "pref_interests";
const CATEGORIES = ["Sole", "Luna", "Pianeti", "Costellazioni", "Via Lattea", "ISS", "Satelliti", "Aurore", "Meteo", "Satellite Intelligence", "Listening Layer", "Atmosfera"];

export default function CCDiscover() {
  const insets = useSafeAreaInsets();
  const { lang } = useLang();
  const [sel, setSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    storage.getItem<string>(KEY, "[]").then((v) => {
      try { setSel(new Set(JSON.parse(v))); } catch { /* ignore */ }
    });
  }, []);

  const toggle = (c: string) => {
    Haptics.selectionAsync();
    setSel((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      storage.setItem(KEY, JSON.stringify(Array.from(n)));
      return n;
    });
  };

  const note = lang === "en"
    ? "Pick the realities you care about. Your feed also learns automatically from what you publish, save and observe."
    : "Scegli le realtà che ti interessano. Il tuo feed impara comunque in automatico da ciò che pubblichi, salvi e osservi.";

  return (
    <SpaceBackground>
      <ScreenHeader title="Discover" subtitle="Control Center" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="cc-discover-screen">
        <Text style={styles.note}>{note}</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => {
            const on = sel.has(c);
            return (
              <Pressable key={c} testID={`interest-${c}`} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(c)}>
                <Text style={[styles.chipTxt, on && { color: colors.onBrand }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.count}>{sel.size} {lang === "en" ? "selected" : "selezionate"}</Text>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  count: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
});
