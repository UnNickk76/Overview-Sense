import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { useLang } from "@/src/context/LangContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

async function dirSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) return 0;
    if (!info.isDirectory) return info.size || 0;
    const entries = await FileSystem.readDirectoryAsync(uri);
    let total = 0;
    for (const e of entries) total += await dirSize(uri + (uri.endsWith("/") ? "" : "/") + e);
    return total;
  } catch { return 0; }
}

export default function CCMemory() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [size, setSize] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cacheDir = FileSystem.cacheDirectory || "";

  const compute = async () => { setSize(await dirSize(cacheDir)); };
  useEffect(() => { compute(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const human = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  const clear = async () => {
    if (clearing || !cacheDir) return;
    setClearing(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const entries = await FileSystem.readDirectoryAsync(cacheDir);
      for (const e of entries) { try { await FileSystem.deleteAsync(cacheDir + e, { idempotent: true }); } catch { /* skip locked */ } }
      setMsg(t("memory.cleared"));
      await compute();
    } catch { /* ignore */ } finally { setClearing(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Memory" subtitle="Control Center" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="cc-memory-screen">
        <View style={styles.card}>
          <View style={styles.gauge}>
            <Ionicons name="server-outline" size={30} color={colors.brand} />
            <Text style={styles.size}>{size === null ? "…" : human(size)}</Text>
            <Text style={styles.sizeLabel}>Cache</Text>
          </View>
          <Text style={styles.sub}>{t("memory.cache.sub")}</Text>
        </View>
        <Pressable testID="memory-clear" style={[styles.clearBtn, clearing && { opacity: 0.5 }]} disabled={clearing} onPress={clear}>
          {clearing ? <ActivityIndicator color={colors.error} /> : <>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.clearTxt}>{t("memory.clear")}</Text>
          </>}
        </Pressable>
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  gauge: { alignItems: "center", gap: 4 },
  size: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"] },
  sizeLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1, textTransform: "uppercase", letterSpacing: 0.5 },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", lineHeight: 18 },
  clearBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.error },
  clearTxt: { color: colors.error, fontFamily: fonts.semibold, fontSize: type.base },
  msg: { color: colors.success, fontFamily: fonts.medium, fontSize: type.sm, textAlign: "center" },
});
