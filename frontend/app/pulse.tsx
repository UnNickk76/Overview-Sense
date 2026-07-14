import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, RefreshControl,
  ActivityIndicator, useWindowDimensions, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { BottomNav } from "@/src/components/BottomNav";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { pulseApi, mediaUrl, FeedObservation } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";
import { pulseForNow, tasksForNow, getTimeWindow, WINDOW_LABEL, PulseTask } from "@/src/lib/pulseTasks";

export default function Pulse() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [salt, setSalt] = useState(0);
  const [items, setItems] = useState<FeedObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [challenge, setChallenge] = useState<{ theme: string; text: string } | null>(null);
  const [comparing, setComparing] = useState(false);

  const now = useMemo(() => new Date(), [salt]);
  const task: PulseTask = useMemo(() => pulseForNow(now, salt), [now, salt]);
  const windowLabel = WINDOW_LABEL[getTimeWindow(now)];
  const available = tasksForNow(now).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await pulseApi.feed();
      setItems(r.items);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const answer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user) { router.push("/login" as never); return; }
    router.push(`/sense-vision?pulse=${task.id}` as never);
  };

  const shuffle = () => {
    Haptics.selectionAsync();
    setSalt((s) => s + 1);
  };

  const togglePick = (id: string) => {
    Haptics.selectionAsync();
    setPicks((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= 2) return [p[1], id];
      return [...p, id];
    });
  };

  const runCompare = async () => {
    if (picks.length !== 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setComparing(true);
    try {
      const r = await pulseApi.compare(picks[0], picks[1]);
      setChallenge({ theme: r.theme, text: r.text });
    } catch {
      setChallenge({ theme: "", text: "Pulse Challenge non disponibile in questo momento. Riprova più tardi." });
    } finally { setComparing(false); }
  };

  const col = (width - spacing.lg * 2 - spacing.md) / 2;

  return (
    <SpaceBackground>
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Pulse</Text>
          <Text style={styles.subtitle}>La sfida per osservare la realtà, ora.</Text>
        </View>
        <Pressable testID="pulse-compare-toggle" hitSlop={8} style={[styles.compareBtn, compareMode && styles.compareBtnOn]}
          onPress={() => { Haptics.selectionAsync(); setCompareMode((c) => !c); setPicks([]); }}>
          <Ionicons name="git-compare-outline" size={16} color={compareMode ? colors.onBrand : colors.brand} />
          <Text style={[styles.compareText, compareMode && { color: colors.onBrand }]}>Confronta</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + 120, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />}
      >
        {/* Today's Pulse — curated, time-appropriate */}
        <Animated.View key={task.id} entering={FadeIn.duration(400)} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIcon}>{task.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.overline}>PULSE DI ORA · {windowLabel.toUpperCase()}</Text>
              <Text style={styles.cardTitle}>{task.title}</Text>
            </View>
          </View>
          <Text style={styles.prompt}>{task.prompt}</Text>
          <View style={styles.hintRow}>
            <Ionicons name="sparkles" size={13} color={colors.brand} />
            <Text style={styles.hint}>{task.hint}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable testID="pulse-answer" style={styles.answerBtn} onPress={answer}>
              <Ionicons name="camera" size={18} color={colors.onBrand} />
              <Text style={styles.answerText}>Rispondi alla sfida</Text>
            </Pressable>
            <Pressable testID="pulse-shuffle" style={styles.shuffleBtn} onPress={shuffle}>
              <Ionicons name="shuffle" size={18} color={colors.brand} />
            </Pressable>
          </View>
          <Text style={styles.tasksMeta}>{available} sfide adatte a questa fascia oraria</Text>
        </Animated.View>

        <Pressable testID="pulse-free" style={styles.freeBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (!user) { router.push("/login" as never); return; } router.push("/sense-vision" as never); }}>
          <Ionicons name="add-circle-outline" size={18} color={colors.onSurfaceSecondary} />
          <Text style={styles.freeText}>Oppure crea una Pulse libera</Text>
        </Pressable>

        {/* Compare hint */}
        {compareMode ? (
          <View style={styles.compareHint}>
            <Text style={styles.compareHintText}>
              Seleziona due Pulse ({picks.length}/2) per confrontarle con Pulse Challenge™.
            </Text>
            <Pressable testID="pulse-run-compare" disabled={picks.length !== 2 || comparing}
              style={[styles.runBtn, (picks.length !== 2 || comparing) && { opacity: 0.5 }]} onPress={runCompare}>
              {comparing ? <ActivityIndicator color={colors.onBrand} size="small" />
                : <Text style={styles.runText}>Confronta</Text>}
            </Pressable>
          </View>
        ) : null}

        {/* Pulse feed */}
        <Text style={styles.sectionTitle}>Le Pulse della community</Text>
        {loading && items.length === 0 ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>{task.icon}</Text>
            <Text style={styles.empty}>Ancora nessuna Pulse. Sii il primo a rispondere alla sfida di oggi.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((o) => {
              const uri = mediaUrl(o.image_url);
              const picked = picks.includes(o.id);
              return (
                <Pressable key={o.id} testID={`pulse-item-${o.id}`} style={[styles.gridItem, { width: col }]}
                  onPress={() => {
                    if (compareMode) { togglePick(o.id); return; }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/observation-detail?id=${o.id}` as never);
                  }}>
                  {uri ? <Image source={{ uri }} style={styles.gridImg} contentFit="cover" transition={150} />
                    : <View style={[styles.gridImg, styles.gridPlaceholder]}><Ionicons name="image-outline" size={24} color={colors.onSurfaceSecondary} /></View>}
                  {o.pulse_task ? (
                    <View style={styles.tag}><Text style={styles.tagText} numberOfLines={1}>{o.pulse_task.title}</Text></View>
                  ) : null}
                  {compareMode ? (
                    <View style={[styles.pick, picked && styles.pickOn]}>
                      {picked ? <Ionicons name="checkmark" size={14} color={colors.onBrand} /> : null}
                    </View>
                  ) : null}
                  <Text style={styles.gridNick} numberOfLines={1}>{o.nickname}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNav active="pulse" />

      {/* Pulse Challenge result */}
      <Modal visible={!!challenge} animationType="slide" transparent onRequestClose={() => setChallenge(null)}>
        <View style={styles.modalScrim}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHead}>
              <Ionicons name="git-compare" size={20} color={colors.brand} />
              <Text style={styles.modalTitle}>Pulse Challenge™</Text>
              <Pressable testID="pulse-close-challenge" hitSlop={10} onPress={() => setChallenge(null)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            {challenge?.theme ? <Text style={styles.modalTheme}>Tema · {challenge.theme}</Text> : null}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>{challenge?.text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2 },
  compareBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: 1, borderColor: colors.brand },
  compareBtnOn: { backgroundColor: colors.brand },
  compareText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1 },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.brand, gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardIcon: { fontSize: 34 },
  overline: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 1 },
  cardTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["2xl"], marginTop: 2 },
  prompt: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  hintRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  hint: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontStyle: "italic", fontSize: type.sm, lineHeight: 19 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  answerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.md },
  answerText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 0.3 },
  shuffleBtn: { width: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: colors.brand },
  tasksMeta: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center" },

  freeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  freeText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },

  compareHint: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compareHintText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  runBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minWidth: 92, alignItems: "center" },
  runText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm },

  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, marginTop: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  gridItem: { gap: 6 },
  gridImg: { width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  gridPlaceholder: { alignItems: "center", justifyContent: "center" },
  tag: { position: "absolute", left: 6, top: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: "80%" },
  tagText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 3 },
  pick: { position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  pickOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  gridNick: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },

  emptyWrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing["2xl"] },
  emptyIcon: { fontSize: 40 },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", paddingHorizontal: spacing.xl, lineHeight: 20 },

  modalScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  modalHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modalTitle: { flex: 1, color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  modalTheme: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  modalText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 23 },
});
