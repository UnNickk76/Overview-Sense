import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { communityApi, MentionItem, MentionDecision } from "@/src/lib/community";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const STATUS_LABEL: Record<string, string> = {
  accepted_name: "Accettato · Nome e Cognome",
  accepted_nickname: "Accettato · Nickname",
  accepted_none: "Accettato · Senza menzione",
  rejected: "Rifiutato",
};

const DECISIONS: { key: MentionDecision; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }[] = [
  { key: "name", label: "Nome e Cognome", icon: "person" },
  { key: "nickname", label: "Nickname", icon: "at" },
  { key: "none", label: "Senza menzione", icon: "eye-off" },
  { key: "reject", label: "Rifiuta", icon: "close-circle", danger: true },
];

export default function MatchHistory() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<MentionItem[]>([]);
  const [appeared, setAppeared] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await communityApi.incoming();
      setItems(r.items); setAppeared(r.appeared);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const respond = async (item: MentionItem, decision: MentionDecision) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(item.id);
    try {
      const r = await communityApi.respond(item.id, decision);
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: r.status } : it)));
      if (r.status.startsWith("accepted")) setAppeared((a) => a + 1);
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Match History™" subtitle="Il pieno controllo della tua identità" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brand} />}>
          <View style={styles.hero}>
            <Text style={styles.heroNum}>{appeared}</Text>
            <Text style={styles.heroText}>Senshot™ in cui sei comparso con menzione. Solo tu decidi come essere mostrato — puoi modificare o rifiutare in qualsiasi momento.</Text>
          </View>

          {items.length === 0 ? (
            <Text style={styles.empty}>Nessuna richiesta di menzione. Quando qualcuno vorrà menzionarti in un Senshot™, apparirà qui e deciderai tu.</Text>
          ) : items.map((it) => (
            <View key={it.id} style={styles.card}>
              <Pressable style={styles.cardHead} onPress={() => router.push(`/observation-detail?id=${it.obs_id}` as never)}>
                {it.image_url ? (
                  <Image source={{ uri: `${process.env.EXPO_PUBLIC_BACKEND_URL}${it.image_url}` }} style={styles.thumb} contentFit="cover" />
                ) : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name="image-outline" size={20} color={colors.onSurfaceSecondary} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    <Text style={{ fontFamily: fonts.semibold }}>@{it.author_nick}</Text> vorrebbe menzionarti in un Senshot™.
                  </Text>
                  {it.caption ? <Text style={styles.cardCaption} numberOfLines={1}>{it.caption}</Text> : null}
                </View>
              </Pressable>

              {it.status === "pending" ? (
                <View style={styles.decisions}>
                  {DECISIONS.map((d) => (
                    <Pressable key={d.key} testID={`decide-${d.key}`} style={[styles.decision, d.danger && styles.decisionDanger]}
                      onPress={() => respond(it, d.key)} disabled={busy === it.id}>
                      <Ionicons name={d.icon} size={14} color={d.danger ? colors.error : colors.brand} />
                      <Text style={[styles.decisionText, d.danger && { color: colors.error }]}>{d.label}</Text>
                    </Pressable>
                  ))}
                  {busy === it.id ? <ActivityIndicator size="small" color={colors.brand} style={{ marginTop: 4 }} /> : null}
                </View>
              ) : (
                <View style={styles.statusRow}>
                  <Ionicons name={it.status.startsWith("accepted") ? "checkmark-circle" : "close-circle"}
                    size={15} color={it.status.startsWith("accepted") ? colors.brand : colors.onSurfaceSecondary} />
                  <Text style={styles.statusText}>{STATUS_LABEL[it.status] ?? it.status}</Text>
                  {it.status !== "pending" ? (
                    <Pressable onPress={() => respond(it, it.status === "rejected" ? "nickname" : "reject")} hitSlop={8} style={{ marginLeft: "auto" }}>
                      <Text style={styles.changeLink}>{it.status === "rejected" ? "Consenti" : "Revoca"}</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heroNum: { color: colors.brand, fontFamily: fonts.bold, fontSize: 40 },
  heroText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18, marginTop: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  cardHead: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  cardCaption: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 2 },
  decisions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  decision: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceTertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  decisionDanger: { borderColor: "rgba(255,69,58,0.4)" },
  decisionText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  changeLink: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
});
