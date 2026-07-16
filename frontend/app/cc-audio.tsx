import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { SettingToggle } from "@/src/components/SettingToggle";
import { storage } from "@/src/utils/storage";
import { useLang } from "@/src/context/LangContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const KEYS = { autoplay: "pref_audio_autoplay", muted: "pref_audio_muted", voice: "pref_audio_voice" };

export default function CCAudio() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [autoplay, setAutoplay] = useState(true);
  const [muted, setMuted] = useState(true);
  const [voice, setVoice] = useState(true);

  useEffect(() => {
    storage.getItem<string>(KEYS.autoplay, "1").then((v) => setAutoplay(v !== "0"));
    storage.getItem<string>(KEYS.muted, "1").then((v) => setMuted(v !== "0"));
    storage.getItem<string>(KEYS.voice, "1").then((v) => setVoice(v !== "0"));
  }, []);

  const save = (k: string, v: boolean, set: (b: boolean) => void) => { set(v); storage.setItem(k, v ? "1" : "0"); };

  return (
    <SpaceBackground>
      <ScreenHeader title="Audio" subtitle="Control Center" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="cc-audio-screen">
        <View style={styles.card}>
          <SettingToggle testID="audio-autoplay" title="Autoplay" subtitle={t("audio.autoplay.sub")} value={autoplay} onChange={(v) => save(KEYS.autoplay, v, setAutoplay)} />
          <View style={styles.div} />
          <SettingToggle testID="audio-muted" title={t("audio.muted")} subtitle={t("audio.muted.sub")} value={muted} onChange={(v) => save(KEYS.muted, v, setMuted)} />
          <View style={styles.div} />
          <SettingToggle testID="audio-voice" title="Voice messages" subtitle={t("audio.voice.sub")} value={voice} onChange={(v) => save(KEYS.voice, v, setVoice)} />
        </View>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  div: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.md },
});
