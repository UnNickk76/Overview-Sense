import React from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ControlCenterMark } from "@/src/components/ControlCenterMark";
import { useAuth } from "@/src/context/AuthContext";
import { useLang } from "@/src/context/LangContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

type Row = { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; subKey: string; route?: string; soon?: boolean; dev?: boolean };
type Group = { titleKey: string; rows: Row[] };

const GROUPS: Group[] = [
  { titleKey: "cc.group.you", rows: [
    { key: "account", icon: "person-circle-outline", title: "Account", subKey: "cc.account.sub", route: "/edit-profile" },
    { key: "language", icon: "language-outline", title: "Language", subKey: "cc.language.sub", route: "/cc-language" },
  ]},
  { titleKey: "cc.group.experience", rows: [
    { key: "discover", icon: "compass-outline", title: "Discover", subKey: "cc.discover.sub", route: "/cc-discover" },
    { key: "audio", icon: "musical-notes-outline", title: "Audio", subKey: "cc.audio.sub", route: "/cc-audio" },
    { key: "sensevision", icon: "aperture-outline", title: "Sense Vision", subKey: "cc.sensevision.sub", route: "/cc-sensevision" },
    { key: "notifications", icon: "notifications-outline", title: "Notifications", subKey: "cc.notifications.sub", route: "/notification-settings" },
  ]},
  { titleKey: "cc.group.system", rows: [
    { key: "privacy", icon: "shield-checkmark-outline", title: "Privacy", subKey: "cc.privacy.sub", route: "/privacy-consent" },
    { key: "security", icon: "lock-closed-outline", title: "Security", subKey: "cc.security.sub", soon: true },
    { key: "memory", icon: "server-outline", title: "Memory", subKey: "cc.memory.sub", route: "/cc-memory" },
    { key: "data", icon: "document-lock-outline", title: "Data", subKey: "cc.data.sub", soon: true },
  ]},
  { titleKey: "cc.group.support", rows: [
    { key: "feedback", icon: "chatbox-ellipses-outline", title: "Feedback", subKey: "cc.feedback.sub", route: "/feedback" },
    { key: "info", icon: "information-circle-outline", title: "Information", subKey: "cc.info.sub", route: "/about" },
    { key: "console", icon: "terminal-outline", title: "Console", subKey: "cc.console.sub", route: "/creator", dev: true },
  ]},
];

export default function ControlCenter() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLang();
  const isDev = user?.role === "developer";

  const go = (r: Row) => {
    if (r.soon) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (r.route) router.push(r.route as never);
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Control Center" subtitle="OverView™" right={<ControlCenterMark size={26} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.xl }} showsVerticalScrollIndicator={false} testID="control-center-screen">
        <View style={styles.hero}>
          <ControlCenterMark size={46} />
          <Text style={styles.heroSub}>{t("cc.subtitle")}</Text>
        </View>

        {GROUPS.map((g) => {
          const rows = g.rows.filter((r) => !r.dev || isDev);
          if (rows.length === 0) return null;
          return (
            <View key={g.titleKey} style={styles.group}>
              <Text style={styles.groupTitle}>{t(g.titleKey)}</Text>
              <View style={styles.card}>
                {rows.map((r, i) => (
                  <Pressable key={r.key} testID={`cc-${r.key}`} style={[styles.row, i < rows.length - 1 && styles.rowDivider]} onPress={() => go(r)}>
                    <View style={styles.iconWrap}><Ionicons name={r.icon} size={20} color={colors.brand} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{r.title}</Text>
                      <Text style={styles.rowSub}>{t(r.subKey)}</Text>
                    </View>
                    {r.soon ? (
                      <View style={styles.soon}><Text style={styles.soonTxt}>{t("cc.comingSoon")}</Text></View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.md, paddingTop: spacing.sm },
  heroSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21, paddingHorizontal: spacing.lg },
  group: { gap: spacing.sm },
  groupTitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm, textTransform: "uppercase", letterSpacing: 0.6, marginLeft: spacing.xs },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.1)" },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  rowSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1, lineHeight: 16 },
  soon: { backgroundColor: colors.surfaceTertiary, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  soonTxt: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2 },
});
