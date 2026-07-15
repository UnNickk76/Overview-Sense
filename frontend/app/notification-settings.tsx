import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Switch, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { communityApi, NotifKind, NotifPrefs } from "@/src/lib/community";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const ROWS: { key: NotifKind; icon: keyof typeof Ionicons.glyphMap; color: string; title: string; desc: string }[] = [
  { key: "reactions", icon: "eye", color: colors.blue, title: "Reazioni", desc: "Quando qualcuno Osserva, segna come Scoperta o Impara dalle tue Observation." },
  { key: "comments", icon: "chatbubble", color: colors.blue, title: "Commenti", desc: "Quando qualcuno commenta una tua Observation." },
  { key: "follows", icon: "person-add", color: colors.brand, title: "Nuovi follower", desc: "Quando qualcuno inizia a seguirti." },
  { key: "reposts", icon: "repeat", color: colors.brand, title: "Condivisioni", desc: "Quando una tua Observation viene ricondivisa." },
  { key: "mentions", icon: "person-circle", color: colors.brand, title: "Presence Match™", desc: "Richieste di menzione e loro esito. Tu controlli sempre la tua identità." },
  { key: "pulse", icon: "pulse", color: colors.brand, title: "Pulse™", desc: "Nuove sfide osservative giornaliere e Global Pulse™ della community." },
  { key: "opportunities", icon: "sparkles", color: colors.blue, title: "Opportunità reali", desc: "Passaggi ISS, aurore, Luna piena, cieli limpidi e altri eventi osservabili da te." },
];

export default function NotificationSettings() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setPrefs(await communityApi.getNotifPrefs()); }
    catch { /* offline */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (key: NotifKind, value: boolean) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    try { await communityApi.updateNotifPrefs({ [key]: value }); }
    catch { setPrefs((p) => (p ? { ...p, [key]: !value } : p)); /* revert */ }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Notifiche" subtitle="Il centro di controllo delle tue notifiche" />
      {loading || !prefs ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}>
          <View style={styles.intro}>
            <Ionicons name="notifications-outline" size={18} color={colors.brand} />
            <Text style={styles.introText}>
              Scegli cosa ti invia OverView™. Le notifiche push arrivano sul dispositivo dopo aver installato l&apos;app (build nativa).
            </Text>
          </View>

          {ROWS.map((r) => (
            <View key={r.key} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: `${r.color}22` }]}>
                <Ionicons name={r.icon} size={18} color={r.color} />
              </View>
              <View style={styles.body}>
                <Text style={styles.title}>{r.title}</Text>
                <Text style={styles.desc}>{r.desc}</Text>
              </View>
              <Switch
                testID={`notif-${r.key}`}
                value={prefs[r.key]}
                onValueChange={(v) => toggle(r.key, v)}
                trackColor={{ false: colors.surfaceTertiary, true: colors.brand }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.surfaceTertiary}
              />
            </View>
          ))}

          <Text style={styles.footer}>
            Puoi cambiare queste preferenze in qualsiasi momento. OverView non ti notificherà mai contenuti inventati — solo attività reale e opportunità osservabili.
          </Text>
        </ScrollView>
      )}
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  introText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  desc: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 16, marginTop: 2 },
  footer: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 16, marginTop: spacing.sm, textAlign: "center" },
});
