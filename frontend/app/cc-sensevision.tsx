import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { SettingToggle } from "@/src/components/SettingToggle";
import { storage } from "@/src/utils/storage";
import { useLang } from "@/src/context/LangContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const KEYS = { quality: "pref_sv_quality", autolayer: "pref_sv_autolayer", ai: "pref_sv_ai" };

export default function CCSenseVision() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [quality, setQuality] = useState(true);
  const [autolayer, setAutolayer] = useState(true);
  const [ai, setAi] = useState(true);

  useEffect(() => {
    storage.getItem<string>(KEYS.quality, "1").then((v) => setQuality(v !== "0"));
    storage.getItem<string>(KEYS.autolayer, "1").then((v) => setAutolayer(v !== "0"));
    storage.getItem<string>(KEYS.ai, "1").then((v) => setAi(v !== "0"));
  }, []);

  const save = (k: string, v: boolean, set: (b: boolean) => void) => { set(v); storage.setItem(k, v ? "1" : "0"); };

  return (
    <SpaceBackground>
      <ScreenHeader title="Sense Vision" subtitle="Control Center" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="cc-sensevision-screen">
        <View style={styles.card}>
          <SettingToggle testID="sv-quality" title="Max native quality" subtitle={t("sv.quality.sub")} value={quality} onChange={(v) => save(KEYS.quality, v, setQuality)} />
          <View style={styles.div} />
          <SettingToggle testID="sv-autolayer" title="Auto Sense Layers" subtitle={t("sv.autolayer.sub")} value={autolayer} onChange={(v) => save(KEYS.autolayer, v, setAutolayer)} />
          <View style={styles.div} />
          <SettingToggle testID="sv-ai" title="AI explanation" subtitle={t("sv.ai.sub")} value={ai} onChange={(v) => save(KEYS.ai, v, setAi)} />
        </View>
        <View style={styles.dna}>
          <Text style={styles.dnaTitle}>Sense DNA™</Text>
          <Text style={styles.dnaSub}>{t("cc.comingSoon")}</Text>
        </View>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  div: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.md },
  dna: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dnaTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  dnaSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
});
