import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { supportApi } from "@/src/lib/backend";

/**
 * Global read-only notice for suspended users. Suspension never blocks browsing:
 * the user keeps navigating Observe / Explore / Gallery, but write actions are
 * refused server-side. This banner explains why (motivation + duration) and opens
 * a "Support" chat for clarification.
 */
export function SuspensionBanner() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);

  const susp = user?.suspension;
  if (!susp) return null;

  const until = susp.until ? new Date(susp.until) : null;
  const untilLabel = until && isFinite(until.getTime())
    ? `Fino al ${until.toLocaleDateString("it-IT")}`
    : "Durata indefinita";

  const openSupport = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const r = await supportApi.clarification();
      router.push(`/chat?id=${r.conv_id}&name=${encodeURIComponent(r.name || "Support")}` as never);
    } catch { /* offline — retry later */ } finally { setBusy(false); }
  };

  if (collapsed) {
    return (
      <Pressable
        testID="suspension-pill"
        onPress={() => setCollapsed(false)}
        style={[styles.pill, { top: insets.top + 6 }]}>
        <Ionicons name="pause-circle" size={16} color="#fff" />
        <Text style={styles.pillText}>Sola lettura</Text>
      </Pressable>
    );
  }

  return (
    <View testID="suspension-banner" style={[styles.wrap, { top: insets.top + 6 }]}>
      <View style={styles.headRow}>
        <Ionicons name="pause-circle" size={18} color="#fff" />
        <Text style={styles.title}>Account in sola lettura</Text>
        <Pressable testID="suspension-collapse" hitSlop={10} onPress={() => setCollapsed(true)} style={{ marginLeft: "auto" }}>
          <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </View>
      <Text style={styles.reason}>{susp.reason}</Text>
      <Text style={styles.meta}>{untilLabel} · Puoi navigare ma non pubblicare o interagire.</Text>
      <Pressable testID="suspension-clarify" style={styles.btn} onPress={openSupport} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.error} /> : (
          <>
            <Ionicons name="chatbubble-ellipses" size={15} color={colors.error} />
            <Text style={styles.btnText}>Richiedi chiarimenti</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", left: spacing.md, right: spacing.md, zIndex: 999,
    backgroundColor: "#8A1C16", borderRadius: radius.md, padding: spacing.md, gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.error,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: "#fff", fontFamily: fonts.bold, fontSize: type.base },
  reason: { color: "#fff", fontFamily: fonts.regular, fontSize: type.sm },
  meta: { color: "rgba(255,255,255,0.75)", fontFamily: fonts.regular, fontSize: type.sm - 1 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fff", borderRadius: radius.pill, paddingVertical: 9, marginTop: 6 },
  btnText: { color: colors.error, fontFamily: fonts.semibold, fontSize: type.sm },
  pill: { position: "absolute", right: spacing.md, zIndex: 999, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#8A1C16", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.error },
  pillText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 1 },
});
