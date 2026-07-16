import React from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { useLang } from "@/src/context/LangContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const OPTIONS: { code: "it" | "en"; flag: string; label: string; native: string }[] = [
  { code: "it", flag: "🇮🇹", label: "lang.italian", native: "Italiano" },
  { code: "en", flag: "🇬🇧", label: "lang.english", native: "English" },
];

export default function CCLanguage() {
  const insets = useSafeAreaInsets();
  const { lang, setLang, t } = useLang();

  return (
    <SpaceBackground>
      <ScreenHeader title="Language" subtitle="Control Center" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="cc-language-screen">
        <Text style={styles.note}>{t("lang.title.sub")}</Text>
        <View style={styles.card}>
          {OPTIONS.map((o, i) => {
            const on = lang === o.code;
            return (
              <Pressable key={o.code} testID={`lang-${o.code}`} style={[styles.row, i === 0 && styles.divider]} onPress={() => { Haptics.selectionAsync(); setLang(o.code); }}>
                <Text style={styles.flag}>{o.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.native}>{o.native}</Text>
                  <Text style={styles.label}>{t(o.label)}</Text>
                </View>
                <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={on ? colors.brand : colors.onSurfaceSecondary} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>{t("sky.hidden.title")}</Text>
          <Text style={styles.previewDesc}>{t("sky.hidden.desc")}</Text>
        </View>
        <Text style={styles.hint}>Home · Profile · Save · Share · Publish · Discover · Sense Vision · Pulse · SenseShot — questi termini restano sempre in inglese.</Text>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  flag: { fontSize: 26 },
  native: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  previewBox: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 4 },
  previewTitle: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.base },
  previewDesc: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 19 },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, fontStyle: "italic" },
});
