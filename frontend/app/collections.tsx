import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, Modal, TextInput, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { collectionsApi, mediaUrl, SenseCollection, CollectionVisibility, AutoRule } from "@/src/lib/backend";

const VIS: { key: CollectionVisibility; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { key: "private", label: "Privata", icon: "lock-closed", hint: "Solo tu" },
  { key: "friends", label: "Amici", icon: "people", hint: "Chi segui reciprocamente" },
  { key: "public", label: "Pubblica", icon: "globe", hint: "Tutti possono vederla" },
  { key: "collaborative", label: "Collaborativa", icon: "git-network", hint: "Altri possono aggiungere" },
];

const DYNAMIC_CATS = ["Sole", "Luna", "Pianeti", "Costellazioni", "Via Lattea", "ISS", "Satelliti", "Aurore", "Meteo", "Satellite Intelligence"];

export default function Collections() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; nickname?: string }>();
  const [items, setItems] = useState<SenseCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const isMe = !params.userId;

  const load = useCallback(() => {
    setLoading(true);
    const p = isMe ? collectionsApi.mine() : collectionsApi.ofUser(String(params.userId));
    p.then((r) => setItems(r.items)).catch(() => setItems([])).finally(() => setLoading(false));
  }, [isMe, params.userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cell = (width - spacing.lg * 2 - spacing.md) / 2;

  return (
    <SpaceBackground>
      <ScreenHeader
        title={isMe ? "Le mie Collezioni" : `Collezioni di @${params.nickname || ""}`}
        subtitle="The Sense Collection™"
        right={isMe ? (
          <Pressable testID="new-collection" hitSlop={8} onPress={() => { Haptics.selectionAsync(); setCreating(true); }}>
            <Ionicons name="add-circle" size={26} color={colors.brand} />
          </Pressable>
        ) : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="collections-screen">
        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["3xl"] }} /> : null}
        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={44} color={colors.brand} />
            <Text style={styles.emptyTitle}>Nessuna collezione</Text>
            <Text style={styles.emptyText}>Raggruppa i tuoi Senshot in cartelle tematiche — &ldquo;Tutti i miei tramonti&rdquo;, &ldquo;Tutte le ISS&rdquo; — manuali o dinamiche.{isMe ? " Tocca + per crearne una." : ""}</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {items.map((c) => {
            const cover = mediaUrl(c.cover_url);
            return (
              <Pressable key={c.id} testID={`coll-${c.id}`} style={[styles.card, { width: cell }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/collection?id=${c.id}` as never); }}>
                <View style={[styles.cover, { height: cell }]}>
                  {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> :
                    <Ionicons name="albums" size={34} color={colors.onSurfaceSecondary} />}
                  {c.dynamic ? <View style={styles.dynBadge}><Ionicons name="flash" size={11} color={colors.onBrand} /><Text style={styles.dynBadgeTxt}>Auto</Text></View> : null}
                  <View style={styles.visBadge}>
                    <Ionicons name={VIS.find((v) => v.key === c.visibility)?.icon || "lock-closed"} size={11} color="#fff" />
                  </View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.cardMeta}>{c.count} {c.count === 1 ? "Senshot" : "Senshot"}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {creating ? <CreateModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); router.push(`/collection?id=${id}` as never); }} /> : null}
    </SpaceBackground>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [vis, setVis] = useState<CollectionVisibility>("private");
  const [dynamic, setDynamic] = useState(false);
  const [rule, setRule] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const auto_rule: AutoRule | null = dynamic && rule ? { type: "category", value: rule } : null;
      const c = await collectionsApi.create({ title: title.trim(), description: desc.trim(), visibility: vis, auto_rule });
      onCreated(c.id);
    } catch { setBusy(false); }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Nuova collezione</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TextInput testID="coll-title" style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Titolo (es. Tutti i miei tramonti)" placeholderTextColor={colors.onSurfaceSecondary} />
            <TextInput testID="coll-desc" style={[styles.input, { height: 64 }]} value={desc} onChangeText={setDesc}
              placeholder="Descrizione (facoltativa)" placeholderTextColor={colors.onSurfaceSecondary} multiline />

            <Text style={styles.label}>Visibilità</Text>
            {VIS.map((v) => (
              <Pressable key={v.key} testID={`vis-${v.key}`} style={[styles.visRow, vis === v.key && styles.visRowOn]} onPress={() => { Haptics.selectionAsync(); setVis(v.key); }}>
                <Ionicons name={v.icon} size={18} color={vis === v.key ? colors.brand : colors.onSurfaceSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.visLabel, vis === v.key && { color: colors.brand }]}>{v.label}</Text>
                  <Text style={styles.visHint}>{v.hint}</Text>
                </View>
                {vis === v.key ? <Ionicons name="checkmark-circle" size={18} color={colors.brand} /> : null}
              </Pressable>
            ))}

            <Pressable style={styles.dynToggle} onPress={() => { Haptics.selectionAsync(); setDynamic((d) => !d); }}>
              <Ionicons name={dynamic ? "flash" : "flash-outline"} size={18} color={dynamic ? colors.brand : colors.onSurfaceSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.visLabel, dynamic && { color: colors.brand }]}>Collezione dinamica</Text>
                <Text style={styles.visHint}>Raccoglie in automatico i tuoi Senshot di una categoria</Text>
              </View>
              <View style={[styles.switch, dynamic && styles.switchOn]}><View style={[styles.knob, dynamic && styles.knobOn]} /></View>
            </Pressable>
            {dynamic ? (
              <View style={styles.chips}>
                {DYNAMIC_CATS.map((c) => (
                  <Pressable key={c} testID={`rule-${c}`} style={[styles.chip, rule === c && styles.chipOn]} onPress={() => { Haptics.selectionAsync(); setRule(c); }}>
                    <Text style={[styles.chipTxt, rule === c && { color: colors.onBrand }]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
          <Pressable testID="coll-submit" style={[styles.submit, (!title.trim() || (dynamic && !rule)) && { opacity: 0.4 }]} disabled={!title.trim() || busy || (dynamic && !rule)} onPress={submit}>
            <Text style={styles.submitTxt}>{busy ? "Creazione…" : "Crea collezione"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21, paddingHorizontal: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { gap: 6 },
  cover: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dynBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  dynBadgeTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: 10 },
  visBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, padding: 5 },
  cardTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  cardMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "88%", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl, marginBottom: spacing.md },
  input: { backgroundColor: colors.tertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  visRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginBottom: spacing.sm },
  visRowOn: { borderColor: colors.brand, backgroundColor: "rgba(212,175,55,0.08)" },
  visLabel: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  visHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  dynToggle: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginTop: spacing.sm, marginBottom: spacing.sm },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.tertiary, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  switchOn: { backgroundColor: colors.brand },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.onSurfaceSecondary },
  knobOn: { backgroundColor: colors.onBrand, marginLeft: "auto" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.tertiary },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  submit: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", marginTop: spacing.sm },
  submitTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
});
