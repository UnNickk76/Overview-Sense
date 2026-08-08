import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Dimensions, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { BottomNav } from "@/src/components/BottomNav";
import { EcoesGlobe } from "@/src/components/EcoesGlobe";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { ecoesApi, EcoesConn, EcoesProposal } from "@/src/lib/backend";

export default function EcoesWorld() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const width = Dimensions.get("window").width;
  const globeSize = Math.min(width - spacing.lg * 2, 320);

  const [mode, setMode] = useState<"globe" | "my">("globe");
  const [globeItems, setGlobeItems] = useState<EcoesConn[]>([]);
  const [myItems, setMyItems] = useState<EcoesConn[]>([]);
  const [proposals, setProposals] = useState<EcoesProposal[]>([]);
  const [selected, setSelected] = useState<EcoesConn | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [globeActive, setGlobeActive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await ecoesApi.globe();
      setGlobeItems(g.items);
      if (user) {
        const [p, m] = await Promise.all([ecoesApi.proposals(), ecoesApi.my()]);
        setProposals(p.items); setMyItems(m.items);
      } else { setProposals([]); setMyItems([]); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const memberIds = new Set(myItems.map((c) => c.id));

  const accept = async (p: EcoesProposal) => {
    setBusy(p.proposal_id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const r = await ecoesApi.accept(p.proposal_id);
      await load();
      if (r.room_ready) {
        router.push(`/ecoes-room?id=${r.connection_id}` as never);
      } else {
        Alert.alert("Connection in ascolto", "Hai accettato. La Connection nascerà quando anche un altro osservatore accetterà.");
      }
    } catch (e) { Alert.alert("Ecoes", (e as Error).message || "Errore"); } finally { setBusy(null); }
  };
  const decline = async (p: EcoesProposal) => {
    setBusy(p.proposal_id);
    try { await ecoesApi.decline(p.proposal_id); setProposals((prev) => prev.filter((x) => x.proposal_id !== p.proposal_id)); }
    catch { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <SpaceBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Ecoes World™</Text>
          <Text style={styles.subtitle}>Le connessioni invisibili, rese visibili</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false} scrollEnabled={!globeActive}>
        {/* Proposals — Ecoes has detected a possible Connection */}
        {proposals.length > 0 ? (
          <View style={styles.propWrap}>
            <View style={styles.propHead}>
              <Ionicons name="sparkles" size={15} color={colors.brand} />
              <Text style={styles.propHeadText}>È stata rilevata una possibile Connection Ecoes</Text>
            </View>
            {proposals.map((p) => (
              <View key={p.proposal_id} testID={`proposal-${p.proposal_id}`} style={styles.propCard}>
                <Text style={styles.propTitle}>{p.title}</Text>
                {p.description ? <Text style={styles.propDesc}>{p.description}</Text> : null}
                {p.reason ? <Text style={styles.propReason}>↳ {p.reason}</Text> : null}
                <View style={styles.propActions}>
                  <Pressable testID={`accept-${p.proposal_id}`} style={styles.acceptBtn} disabled={busy === p.proposal_id} onPress={() => accept(p)}>
                    {busy === p.proposal_id ? <ActivityIndicator color={colors.onBrand} size="small" /> : <Text style={styles.acceptText}>Accetta la Connection</Text>}
                  </Pressable>
                  <Pressable style={styles.declineBtn} disabled={busy === p.proposal_id} onPress={() => decline(p)}>
                    <Text style={styles.declineText}>Non ora</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <Pressable style={[styles.toggle, mode === "globe" && styles.toggleOn]} onPress={() => { Haptics.selectionAsync(); setMode("globe"); setSelected(null); }}>
            <Ionicons name="planet" size={15} color={mode === "globe" ? colors.onBrand : colors.onSurfaceSecondary} />
            <Text style={mode === "globe" ? styles.toggleOnText : styles.toggleText}>Ecoes Globe</Text>
          </Pressable>
          <Pressable testID="toggle-my" style={[styles.toggle, mode === "my" && styles.toggleOn]} onPress={() => { Haptics.selectionAsync(); setMode("my"); setSelected(null); }}>
            <Ionicons name="albums-outline" size={15} color={mode === "my" ? colors.onBrand : colors.onSurfaceSecondary} />
            <Text style={mode === "my" ? styles.toggleOnText : styles.toggleText}>My Ecoes</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} /> : null}

        {mode === "globe" ? (
          <View style={{ alignItems: "center", paddingTop: spacing.md }}>
            <EcoesGlobe items={globeItems} size={globeSize} onSelect={(c) => { Haptics.selectionAsync(); setSelected(c); }} onInteracting={setGlobeActive} />
            {selected ? (
              <View style={styles.selCard}>
                <View style={styles.selHead}>
                  <View style={[styles.pulseTag, { backgroundColor: selected.intensity >= 0.45 ? colors.brand : colors.blue }]} />
                  <Text style={styles.selTitle}>{selected.title}</Text>
                </View>
                {selected.description ? <Text style={styles.selDesc}>{selected.description}</Text> : null}
                <Text style={styles.selNote}>Ecoes non rivela chi né dove. Vedi solo l'eco.</Text>
                {memberIds.has(selected.id) ? (
                  <Pressable style={styles.enterBtn} onPress={() => router.push(`/ecoes-room?id=${selected.id}` as never)}>
                    <Text style={styles.enterText}>Entra nella Connection</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.hint}>Trascina per ruotare · pizzica per zoomare · tocca una pulsazione per scoprirne l'eco. Solo titolo e descrizione — mai persone o numeri.</Text>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }}>
            {!user ? (
              <Text style={styles.hint}>Accedi per vedere le tue Connection.</Text>
            ) : myItems.length === 0 ? (
              <View style={styles.emptyMy}>
                <Ionicons name="radio-outline" size={34} color={colors.onSurfaceSecondary} />
                <Text style={styles.hint}>Non fai ancora parte di nessuna Connection. Nasceranno spontaneamente quando Ecoes rileverà una vera risonanza.</Text>
              </View>
            ) : myItems.map((c) => (
              <Pressable key={c.id} testID={`my-${c.id}`} style={styles.myCard} onPress={() => router.push(`/ecoes-room?id=${c.id}` as never)}>
                <View style={[styles.pulseTag, { backgroundColor: c.dormant ? colors.onSurfaceSecondary : (c.intensity >= 0.45 ? colors.brand : colors.blue) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.myTitle}>{c.title}</Text>
                  <Text style={styles.myDesc} numberOfLines={2}>{c.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomNav active="ecoes" />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  propWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  propHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  propHeadText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm, flex: 1 },
  propCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  propTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.base + 1 },
  propDesc: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 19 },
  propReason: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, fontStyle: "italic" },
  propActions: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  acceptBtn: { flex: 1, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 10, alignItems: "center" },
  acceptText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  declineBtn: { paddingHorizontal: spacing.lg, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  declineText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  toggleRow: { flexDirection: "row", gap: spacing.sm, alignSelf: "center", marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  toggleOn: { backgroundColor: colors.brand },
  toggleOnText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  toggleText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", paddingHorizontal: spacing.xl, marginTop: spacing.md, lineHeight: 18 },
  selCard: { marginTop: spacing.lg, marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignSelf: "stretch" },
  selHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  pulseTag: { width: 10, height: 10, borderRadius: 5 },
  selTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg, flex: 1 },
  selDesc: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  selNote: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, fontStyle: "italic", marginTop: 2 },
  enterBtn: { marginTop: spacing.sm, backgroundColor: colors.blue, borderRadius: radius.pill, paddingVertical: 10, alignItems: "center" },
  enterText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm },
  emptyMy: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.xl },
  myCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  myTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  myDesc: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
});
