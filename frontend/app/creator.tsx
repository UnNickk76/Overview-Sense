import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { creatorApi, CreatorStats, FeedbackItem, FeedbackStatus, FeedbackType } from "@/src/lib/backend";

const TYPE_LABEL: Record<FeedbackType, string> = { suggestion: "Suggerimento", feature: "Funzione", bug: "Bug", general: "Generale" };
const STATUS_FLOW: FeedbackStatus[] = ["open", "in_progress", "resolved", "dismissed"];
const STATUS_LABEL: Record<FeedbackStatus, string> = { open: "Aperto", in_progress: "In corso", resolved: "Risolto", dismissed: "Chiuso" };
const STATUS_COLOR: Record<FeedbackStatus, string> = { open: colors.brand, in_progress: colors.blue, resolved: "#3FB950", dismissed: colors.onSurfaceSecondary };

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tutti" },
  { key: "bug", label: "Bug" },
  { key: "feature", label: "Funzioni" },
  { key: "suggestion", label: "Idee" },
  { key: "general", label: "Generale" },
];

export default function CreatorConsole() {
  const router = useRouter();
  const { user } = useAuth();
  const isCreator = user?.role === "developer";
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    if (!isCreator) { setLoading(false); return; }
    setLoading(true);
    try {
      const [s, f] = await Promise.all([creatorApi.stats(), creatorApi.feedback(filter || undefined)]);
      setStats(s); setItems(f.items);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [isCreator, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cycleStatus = async (f: FeedbackItem) => {
    const next = STATUS_FLOW[(STATUS_FLOW.indexOf(f.status) + 1) % STATUS_FLOW.length];
    Haptics.selectionAsync();
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: next } : x)));
    try { await creatorApi.update(f.id, { status: next }); } catch { load(); }
  };

  const setPriority = async (f: FeedbackItem, p: number) => {
    Haptics.selectionAsync();
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, priority: p } : x)));
    try { await creatorApi.update(f.id, { priority: p }); } catch { load(); }
  };

  const saveNote = async (f: FeedbackItem) => {
    try { await creatorApi.update(f.id, { creator_note: noteText }); } catch { /* ignore */ }
    setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, creator_note: noteText } : x)));
    setNoteFor(null); setNoteText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (!isCreator) {
    // Hidden: non-creators are bounced back with no trace of the console.
    return (
      <SpaceBackground>
        <ScreenHeader title="OverView" />
        <View style={styles.center}>
          <Ionicons name="planet-outline" size={48} color={colors.onSurfaceSecondary} />
          <Text style={styles.dim}>Pagina non disponibile.</Text>
          <Pressable style={styles.cta} onPress={() => router.replace("/home" as never)}>
            <Text style={styles.ctaText}>Torna alla Home</Text>
          </Pressable>
        </View>
      </SpaceBackground>
    );
  }

  return (
    <SpaceBackground>
      <ScreenHeader title="Creator Console" subtitle="Solo per te" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading && !stats ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} /> : null}

        {stats ? (
          <View style={styles.statsGrid}>
            <StatBox icon="people" label="Utenti" value={stats.users} />
            <StatBox icon="camera" label="Senshot" value={stats.observations} />
            <StatBox icon="flash" label="SnapSense" value={stats.snapsenses} />
            <StatBox icon="mail-unread" label="Feedback aperti" value={stats.feedback.open} accent={colors.brand} />
            <StatBox icon="bug" label="Bug attivi" value={stats.feedback.bugs_open} accent={stats.feedback.bugs_open > 0 ? "#F85149" : undefined} />
            <StatBox icon="trending-up" label="Nuovi (mese)" value={stats.new_users_month} />
          </View>
        ) : null}

        <View>
          <Text style={styles.sectionTitle}>Feedback & Roadmap</Text>
          <View style={styles.filterRow}>
            {FILTERS.map((fl) => {
              const on = filter === fl.key;
              return (
                <Pressable key={fl.key || "all"} testID={`filter-${fl.key || "all"}`} style={[styles.filterChip, on && styles.filterOn]} onPress={() => setFilter(fl.key)}>
                  <Text style={[styles.filterText, on && { color: colors.onBrand }]}>{fl.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {items.length === 0 && !loading ? (
          <Text style={styles.dim}>Nessun feedback per questo filtro.</Text>
        ) : items.map((f) => (
          <View key={f.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.typeTag}><Text style={styles.typeTagText}>{TYPE_LABEL[f.type]}</Text></View>
              <Pressable testID={`status-${f.id}`} style={[styles.statusBtn, { borderColor: STATUS_COLOR[f.status] }]} onPress={() => cycleStatus(f)}>
                <View style={[styles.dot, { backgroundColor: STATUS_COLOR[f.status] }]} />
                <Text style={[styles.statusBtnText, { color: STATUS_COLOR[f.status] }]}>{STATUS_LABEL[f.status]}</Text>
              </Pressable>
            </View>
            <Text style={styles.author}>@{f.nickname}</Text>
            <Text style={styles.text}>{f.text}</Text>

            <View style={styles.prioRow}>
              <Text style={styles.prioLabel}>Priorità</Text>
              {[0, 1, 2, 3].map((p) => (
                <Pressable key={p} onPress={() => setPriority(f, p)} style={[styles.prioBtn, f.priority === p && styles.prioOn]}>
                  <Text style={[styles.prioText, f.priority === p && { color: colors.onBrand }]}>{p === 0 ? "—" : p}</Text>
                </Pressable>
              ))}
            </View>

            {noteFor === f.id ? (
              <View style={{ gap: spacing.sm }}>
                <TextInput testID={`note-input-${f.id}`} style={styles.noteInput} value={noteText} onChangeText={setNoteText} multiline
                  placeholder="Nota / risposta pubblica all'utente…" placeholderTextColor={colors.onSurfaceSecondary} />
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable style={styles.noteSave} onPress={() => saveNote(f)}><Text style={styles.noteSaveText}>Salva nota</Text></Pressable>
                  <Pressable style={styles.noteCancel} onPress={() => { setNoteFor(null); setNoteText(""); }}><Text style={styles.noteCancelText}>Annulla</Text></Pressable>
                </View>
              </View>
            ) : (
              <Pressable testID={`add-note-${f.id}`} style={styles.noteBtn} onPress={() => { setNoteFor(f.id); setNoteText(f.creator_note || ""); }}>
                <Ionicons name="create-outline" size={14} color={colors.blue} />
                <Text style={styles.noteBtnText}>{f.creator_note ? "Modifica nota" : "Aggiungi nota"}</Text>
              </Pressable>
            )}
            {f.creator_note && noteFor !== f.id ? <Text style={styles.creatorNote}>↳ {f.creator_note}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </SpaceBackground>
  );
}

function StatBox({ icon, label, value, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; accent?: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={accent ?? colors.onSurfaceSecondary} />
      <Text style={[styles.statVal, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  dim: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center" },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statBox: { width: "31.5%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statVal: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  statLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center" },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.sm },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filterChip: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  filterOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeTag: { backgroundColor: colors.tertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  typeTagText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusBtnText: { fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  author: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  text: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  prioRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  prioLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  prioBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary },
  prioOn: { backgroundColor: colors.brand },
  prioText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  noteBtn: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  noteBtnText: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm },
  noteInput: { minHeight: 60, backgroundColor: colors.tertiary, borderRadius: radius.sm, padding: spacing.sm, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, textAlignVertical: "top" },
  noteSave: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  noteSaveText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  noteCancel: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  noteCancelText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  creatorNote: { color: colors.blue, fontFamily: fonts.regular, fontSize: type.sm - 1, fontStyle: "italic" },
});
