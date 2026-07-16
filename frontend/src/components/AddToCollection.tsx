import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, Modal, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { collectionsApi, SenseCollection } from "@/src/lib/backend";

// Reusable sheet to add a Senshot to one of the user's manual collections,
// or create a new one on the fly. Dynamic collections are excluded (auto-managed).
export function AddToCollection({ obsId, onClose }: { obsId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SenseCollection[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    collectionsApi.mine().then((r) => setItems(r.items.filter((c) => !c.dynamic))).catch(() => setItems([]));
  }, []);

  const add = async (c: SenseCollection) => {
    if (busy || added.has(c.id)) return;
    setBusy(c.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await collectionsApi.addItem(c.id, obsId);
      setAdded((s) => new Set(s).add(c.id));
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  const createAndAdd = async () => {
    if (!newTitle.trim() || busy) return;
    setBusy("__new");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const c = await collectionsApi.create({ title: newTitle.trim(), visibility: "private", obs_ids: [obsId] });
      setItems((prev) => [c, ...(prev || [])]);
      setAdded((s) => new Set(s).add(c.id));
      setNewTitle(""); setCreating(false);
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Aggiungi a una collezione</Text>
          <Text style={styles.sub}>The Sense Collection™ — raggruppa le realtà che ami.</Text>

          {items === null ? <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} /> : null}

          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {items?.map((c) => {
              const done = added.has(c.id);
              return (
                <Pressable key={c.id} testID={`add-to-${c.id}`} style={styles.row} onPress={() => add(c)} disabled={done}>
                  <Ionicons name={done ? "checkmark-circle" : "albums-outline"} size={20} color={done ? colors.success : colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.rowMeta}>{c.count} Senshot</Text>
                  </View>
                  {busy === c.id ? <ActivityIndicator color={colors.brand} /> : (
                    <Text style={[styles.action, done && { color: colors.success }]}>{done ? "Aggiunto" : "Aggiungi"}</Text>
                  )}
                </Pressable>
              );
            })}
            {items && items.length === 0 && !creating ? (
              <Text style={styles.empty}>Nessuna collezione manuale. Creane una qui sotto.</Text>
            ) : null}

            {creating ? (
              <View style={styles.createRow}>
                <TextInput testID="new-coll-inline" style={styles.input} value={newTitle} onChangeText={setNewTitle}
                  placeholder="Nome collezione" placeholderTextColor={colors.onSurfaceSecondary} autoFocus />
                <Pressable testID="new-coll-confirm" style={styles.createBtn} onPress={createAndAdd} disabled={!newTitle.trim()}>
                  <Ionicons name="checkmark" size={18} color={colors.onBrand} />
                </Pressable>
              </View>
            ) : (
              <Pressable testID="add-create-new" style={styles.newRow} onPress={() => { Haptics.selectionAsync(); setCreating(true); }}>
                <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
                <Text style={styles.newTxt}>Nuova collezione</Text>
              </Pressable>
            )}
          </ScrollView>

          <Pressable testID="add-done" style={styles.done} onPress={onClose}>
            <Text style={styles.doneTxt}>Fatto</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  rowMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  action: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, paddingVertical: spacing.lg, textAlign: "center" },
  newRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  newTxt: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  createRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  input: { flex: 1, backgroundColor: colors.tertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  createBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  done: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: "center", marginTop: spacing.md },
  doneTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
});
