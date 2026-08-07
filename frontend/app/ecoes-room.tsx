import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { TranslatableText } from "@/src/components/TranslatableText";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { ecoesApi, EcoesRoom } from "@/src/lib/backend";

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}g`;
}

export default function EcoesRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [room, setRoom] = useState<EcoesRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try { setRoom(await ecoesApi.room(id)); } catch (e) { Alert.alert("Ecoes", (e as Error).message || "Errore"); router.back(); } finally { setLoading(false); }
  }, [id, router]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const post = await ecoesApi.post(id!, t, "thought");
      setRoom((r) => (r ? { ...r, posts: [...r.posts, post] } : r));
      setText("");
    } catch (e) { Alert.alert("Ecoes", (e as Error).message || "Errore"); } finally { setBusy(false); }
  };

  const leave = () => {
    Alert.alert("Lasciare la Connection?", "Potrai rientrare finché la Connection esiste. Verrà eliminata solo quando l'ultimo partecipante la lascia.", [
      { text: "Annulla", style: "cancel" },
      { text: "Esci", style: "destructive", onPress: async () => {
        try { await ecoesApi.leave(id!); } catch { /* ignore */ }
        router.back();
      } },
    ]);
  };

  if (loading) {
    return <SpaceBackground><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }
  if (!room) return <SpaceBackground><View style={styles.center} /></SpaceBackground>;

  const conn = room.connection;
  return (
    <SpaceBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Pressable style={{ flex: 1, alignItems: "center" }} onPress={() => setShowInfo((s) => !s)}>
          <View style={styles.titleRow}>
            <View style={[styles.pulse, { backgroundColor: conn.dormant ? colors.onSurfaceSecondary : (conn.intensity >= 0.45 ? colors.brand : colors.blue) }]} />
            <Text style={styles.title} numberOfLines={1}>{conn.title}</Text>
          </View>
          <Text style={styles.subtitle}>{conn.dormant ? "Pulsazione lenta" : "Connection viva"} · tocca per i dettagli</Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={leave} style={styles.iconBtn}>
          <Ionicons name="exit-outline" size={22} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>

      {showInfo ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoDesc}>{conn.description}</Text>
          <View style={styles.partRow}>
            {room.participants.map((p) => (
              <View key={p.user_id} style={styles.partChip}>
                <Text style={styles.partInit}>{(p.nickname || "?")[0].toUpperCase()}</Text>
                <Text style={styles.partNick}>{p.nickname || "osservatore"}</Text>
              </View>
            ))}
          </View>
          {room.title_history.length > 1 ? (
            <Text style={styles.histNote}>Il titolo può evolvere con la Connection.</Text>
          ) : null}
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 60}>
        <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
          {room.posts.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="sparkles-outline" size={30} color={colors.onSurfaceSecondary} />
              <Text style={styles.emptyText}>La Connection è nata. Condividi un Pensiero o un'osservazione: la vita di questa Connection dipende da ciò che vi nasce dentro.</Text>
            </View>
          ) : room.posts.map((p) => {
            const mine = p.user_id === user?.id;
            return (
              <View key={p.id} style={[styles.post, mine && styles.postMine]}>
                <View style={styles.postHead}>
                  <Text style={styles.postNick}>{mine ? "Tu" : (p.nickname || "osservatore")}</Text>
                  <Text style={styles.postTime}>{timeAgo(p.created_at)}</Text>
                </View>
                <TranslatableText text={p.text} textStyle={styles.postText} />
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="room-input"
            style={styles.input}
            value={text}
            onChangeText={(v) => setText(v.slice(0, 3000))}
            placeholder="Condividi un Pensiero nella Connection…"
            placeholderTextColor={colors.onSurfaceSecondary}
            multiline
          />
          <Pressable testID="room-send" style={[styles.sendBtn, !text.trim() && styles.sendOff]} onPress={send} disabled={!text.trim() || busy}>
            {busy ? <ActivityIndicator color={colors.onBrand} size="small" /> : <Ionicons name="arrow-up" size={20} color={text.trim() ? colors.onBrand : colors.onSurfaceSecondary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  pulse: { width: 9, height: 9, borderRadius: 5 },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.base + 1, maxWidth: 210 },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  infoCard: { backgroundColor: colors.surfaceSecondary, marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  infoDesc: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 20 },
  partRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  partChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  partInit: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.sm - 3 },
  partNick: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  histNote: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, fontStyle: "italic" },
  feed: { padding: spacing.lg, gap: spacing.md },
  emptyFeed: { alignItems: "center", gap: spacing.md, paddingTop: spacing["2xl"], paddingHorizontal: spacing.lg },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", lineHeight: 19 },
  post: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  postMine: { borderColor: colors.brand },
  postHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  postNick: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  postTime: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  postText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 42, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  sendOff: { backgroundColor: colors.tertiary },
});
