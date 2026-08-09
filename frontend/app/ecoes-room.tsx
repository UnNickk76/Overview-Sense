import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, Switch, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { TranslatableText } from "@/src/components/TranslatableText";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { ecoesApi, socialApi, dmApi, mediaUrl, EcoesRoom, EcoesPost } from "@/src/lib/backend";

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
  const [replyTo, setReplyTo] = useState<EcoesPost | null>(null);
  // Share-a-Sense sheet
  const [senseOpen, setSenseOpen] = useState(false);
  const [senseImg, setSenseImg] = useState<string | null>(null);  // base64
  const [sensePreview, setSensePreview] = useState<string | null>(null); // uri
  const [senseCaption, setSenseCaption] = useState("");
  const [alsoObserve, setAlsoObserve] = useState(false);
  const [senseBusy, setSenseBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try { setRoom(await ecoesApi.room(id)); } catch (e) { Alert.alert("Ecoes", (e as Error).message || "Errore"); router.back(); } finally { setLoading(false); }
  }, [id, router]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ---- Thread grouping: each post resolves to a root; replies render indented ----
  const { roots, repliesByRoot } = useMemo(() => {
    const posts = room?.posts ?? [];
    const byId = new Map(posts.map((p) => [p.id, p]));
    const rootOf = (p: EcoesPost): string => {
      let cur = p; const seen = new Set<string>();
      while (cur.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parent_id)!; }
      return cur.id;
    };
    const rts: EcoesPost[] = posts.filter((p) => !p.parent_id);
    const map: Record<string, EcoesPost[]> = {};
    for (const p of posts) {
      if (!p.parent_id) continue;
      const r = rootOf(p);
      (map[r] ||= []).push(p);
    }
    return { roots: rts, repliesByRoot: map };
  }, [room?.posts]);

  const appendPost = (post: EcoesPost) => setRoom((r) => (r ? { ...r, posts: [...r.posts, post] } : r));

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const post = await ecoesApi.post(id!, t, "thought", replyTo?.id ?? null);
      appendPost(post);
      setText(""); setReplyTo(null);
    } catch (e) { Alert.alert("Ecoes", (e as Error).message || "Errore"); } finally { setBusy(false); }
  };

  // ---- Share a Sense ----
  const pickSense = async (fromCamera: boolean) => {
    const cur = fromCamera ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
    let ok = cur.granted;
    if (!ok && cur.canAskAgain) {
      const req = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      ok = req.granted;
    }
    if (!ok) {
      Alert.alert(
        fromCamera ? "Fotocamera non disponibile" : "Galleria non disponibile",
        "Per condividere un Sense concedi l'accesso dalle Impostazioni.",
        [{ text: "Annulla", style: "cancel" }, { text: "Apri Impostazioni", onPress: () => Linking.openSettings() }],
      );
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    try {
      const manip = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 1280 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (manip.base64) { setSenseImg(manip.base64); setSensePreview(manip.uri); }
    } catch { /* ignore */ }
  };

  const openSense = () => { setSenseImg(null); setSensePreview(null); setSenseCaption(""); setAlsoObserve(false); setSenseOpen(true); };

  const confirmSense = async () => {
    if (!senseImg || senseBusy) return;
    setSenseBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let post: EcoesPost;
      if (alsoObserve) {
        // Publish to Observe using the untouched normal flow, then reference it in the room.
        const obs = await socialApi.createObservation({ media_type: "image", source: "reality", image_base64: senseImg, caption: senseCaption.trim() });
        post = await ecoesApi.shareSense(id!, { obs_id: obs.id, caption: senseCaption.trim(), parent_id: replyTo?.id ?? null });
      } else {
        post = await ecoesApi.shareSense(id!, { image_base64: senseImg, caption: senseCaption.trim(), parent_id: replyTo?.id ?? null });
      }
      appendPost(post);
      setSenseOpen(false); setReplyTo(null);
    } catch (e) { Alert.alert("Ecoes", (e as Error).message || "Errore"); } finally { setSenseBusy(false); }
  };

  const messageParticipant = async (uid: string, nick?: string) => {
    if (uid === user?.id) return;
    try {
      const c = await dmApi.start(uid);
      router.push(`/chat?id=${c.id}&name=${encodeURIComponent(nick || "osservatore")}` as never);
    } catch (e) { Alert.alert("Messaggi", (e as Error).message || "Errore"); }
  };

  const reportPost = (post: EcoesPost) => {
    Alert.alert("Segnala contenuto", "Vuoi segnalare questo contenuto ai bot di sistema? La tua segnalazione è anonima.", [
      { text: "Annulla", style: "cancel" },
      { text: "Segnala", style: "destructive", onPress: async () => {
        try { const r = await ecoesApi.report(id!, { post_id: post.id }); Alert.alert(r.handled_by, "Grazie. La segnalazione è stata presa in carico dai bot di sistema."); }
        catch (e) { Alert.alert("Ecoes", (e as Error).message || "Errore"); }
      } },
    ]);
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

  const renderPost = (p: EcoesPost, isReply: boolean) => {
    const mine = p.user_id === user?.id;
    const img = p.kind === "sense" && p.image_url ? mediaUrl(p.image_url, "feed") : null;
    return (
      <View key={p.id} style={[styles.post, mine && styles.postMine, isReply && styles.reply]}>
        <View style={styles.postHead}>
          <Text style={styles.postNick}>{mine ? "Tu" : (p.nickname || "osservatore")}</Text>
          <View style={styles.headRight}>
            <Text style={styles.postTime}>{timeAgo(p.created_at)}</Text>
            {!mine ? (
              <Pressable hitSlop={8} onPress={() => reportPost(p)}>
                <Ionicons name="ellipsis-horizontal" size={15} color={colors.onSurfaceSecondary} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {img ? (
          <Pressable onPress={() => p.obs_id && router.push(`/observation-detail?id=${p.obs_id}` as never)}>
            <Image source={{ uri: img }} style={styles.senseImg} contentFit="cover" transition={150} />
            {p.obs_id ? <Text style={styles.senseObserve}>Anche in Observe · tocca per aprire</Text> : <Text style={styles.senseRoomOnly}>Sense condiviso solo in questa Connection</Text>}
          </Pressable>
        ) : null}
        {p.text ? <TranslatableText text={p.text} textStyle={styles.postText} /> : null}
        <Pressable hitSlop={6} onPress={() => { Haptics.selectionAsync(); setReplyTo(p); }} style={styles.replyBtn}>
          <Ionicons name="return-down-forward" size={13} color={colors.onSurfaceSecondary} />
          <Text style={styles.replyBtnText}>Rispondi</Text>
        </Pressable>
      </View>
    );
  };

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
        <ScrollView style={styles.infoScroll} contentContainerStyle={styles.infoCard} showsVerticalScrollIndicator={false}>
          <Text style={styles.infoDesc}>{conn.description}</Text>
          <Text style={styles.groupLabel}>PARTECIPANTI</Text>
          <View style={styles.partRow}>
            {room.participants.map((p) => {
              const me = p.user_id === user?.id;
              return (
                <Pressable key={p.user_id} style={styles.partChip} disabled={me} onPress={() => messageParticipant(p.user_id, p.nickname)}>
                  <Text style={styles.partInit}>{(p.nickname || "?")[0].toUpperCase()}</Text>
                  <Text style={styles.partNick}>{me ? "Tu" : (p.nickname || "osservatore")}</Text>
                  {!me ? <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.botDivider} />
          <Text style={styles.groupLabel}>BOT DI SISTEMA</Text>
          {room.system_bots.map((b) => (
            <View key={b.id} style={styles.botRow}>
              <View style={styles.botIcon}>
                <Ionicons name={b.role === "safety" ? "shield-checkmark" : "hammer"} size={14} color={colors.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.botNameRow}>
                  <Text style={styles.botName}>{b.name}</Text>
                  <View style={styles.botTag}><Text style={styles.botTagText}>SISTEMA</Text></View>
                </View>
                {b.tagline ? <Text style={styles.botTagline}>{b.tagline}</Text> : null}
              </View>
            </View>
          ))}
          <Text style={styles.botNote}>Presenza silenziosa di OverView a tutela della Connection. Non sono utenti e non influenzano la vita della Connection.</Text>
          {room.title_history.length > 1 ? (
            <>
              <View style={styles.botDivider} />
              <Text style={styles.groupLabel}>EVOLUZIONE DEL TITOLO</Text>
              {[...room.title_history].reverse().map((h, i) => (
                <View key={`${h.at}-${i}`} style={styles.histRow}>
                  <View style={styles.histDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histTitle}>{h.title}</Text>
                    {h.reason ? <Text style={styles.histReason}>{h.reason}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 60}>
        <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
          {roots.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="sparkles-outline" size={30} color={colors.onSurfaceSecondary} />
              <Text style={styles.emptyText}>La Connection è nata. Condividi un Pensiero o un Sense: la vita di questa Connection dipende da ciò che vi nasce dentro.</Text>
            </View>
          ) : roots.map((p) => (
            <View key={p.id} style={styles.thread}>
              {renderPost(p, false)}
              {(repliesByRoot[p.id] || []).map((r) => renderPost(r, true))}
            </View>
          ))}
        </ScrollView>

        {replyTo ? (
          <View style={styles.replyBanner}>
            <Ionicons name="return-down-forward" size={14} color={colors.brand} />
            <Text style={styles.replyBannerText} numberOfLines={1}>In risposta a {replyTo.user_id === user?.id ? "te" : (replyTo.nickname || "osservatore")}: {replyTo.text || "Sense"}</Text>
            <Pressable hitSlop={8} onPress={() => setReplyTo(null)}><Ionicons name="close" size={16} color={colors.onSurfaceSecondary} /></Pressable>
          </View>
        ) : null}

        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Pressable testID="room-sense" style={styles.attachBtn} onPress={openSense}>
            <Ionicons name="image-outline" size={22} color={colors.brand} />
          </Pressable>
          <TextInput
            testID="room-input"
            style={styles.input}
            value={text}
            onChangeText={(v) => setText(v.slice(0, 3000))}
            placeholder={replyTo ? "Scrivi una risposta…" : "Condividi un Pensiero nella Connection…"}
            placeholderTextColor={colors.onSurfaceSecondary}
            multiline
          />
          <Pressable testID="room-send" style={[styles.sendBtn, !text.trim() && styles.sendOff]} onPress={send} disabled={!text.trim() || busy}>
            {busy ? <ActivityIndicator color={colors.onBrand} size="small" /> : <Ionicons name="arrow-up" size={20} color={text.trim() ? colors.onBrand : colors.onSurfaceSecondary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Share a Sense */}
      <Modal visible={senseOpen} transparent animationType="slide" onRequestClose={() => setSenseOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSenseOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Condividi un Sense</Text>
          {sensePreview ? (
            <Image source={{ uri: sensePreview }} style={styles.senseBig} contentFit="cover" />
          ) : (
            <View style={styles.pickRow}>
              <Pressable style={styles.pickBtn} onPress={() => pickSense(true)}>
                <Ionicons name="camera" size={22} color={colors.brand} />
                <Text style={styles.pickText}>Fotocamera</Text>
              </Pressable>
              <Pressable style={styles.pickBtn} onPress={() => pickSense(false)}>
                <Ionicons name="images" size={22} color={colors.brand} />
                <Text style={styles.pickText}>Galleria</Text>
              </Pressable>
            </View>
          )}
          {sensePreview ? (
            <>
              <TextInput
                style={styles.senseCaption}
                value={senseCaption}
                onChangeText={(v) => setSenseCaption(v.slice(0, 500))}
                placeholder="Aggiungi una didascalia (opzionale)…"
                placeholderTextColor={colors.onSurfaceSecondary}
                multiline
              />
              <View style={styles.toggleLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Pubblica anche in Observe</Text>
                  <Text style={styles.toggleSub}>Se disattivo, il Sense resta solo in questa Connection.</Text>
                </View>
                <Switch value={alsoObserve} onValueChange={setAlsoObserve} trackColor={{ true: colors.brand, false: colors.tertiary }} thumbColor="#fff" />
              </View>
              <Pressable style={[styles.confirmBtn, senseBusy && { opacity: 0.6 }]} onPress={confirmSense} disabled={senseBusy}>
                {senseBusy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.confirmText}>Condividi nella Connection</Text>}
              </Pressable>
            </>
          ) : null}
          <Pressable style={styles.sheetClose} onPress={() => setSenseOpen(false)}>
            <Text style={styles.sheetCloseText}>Annulla</Text>
          </Pressable>
        </View>
      </Modal>
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
  infoScroll: { maxHeight: 320, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  infoCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  infoDesc: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 20 },
  groupLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 0.8, marginTop: 2 },
  botDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 2 },
  botRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, pointerEvents: "none" },
  botIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(88,166,255,0.12)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.blue },
  botNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  botName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  botTag: { backgroundColor: "rgba(88,166,255,0.15)", borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  botTagText: { color: colors.blue, fontFamily: fonts.bold, fontSize: type.sm - 4, letterSpacing: 0.5 },
  botTagline: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  botNote: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, fontStyle: "italic", marginTop: 2 },
  partRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  partChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  partInit: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.sm - 3 },
  partNick: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  histRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  histDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand, marginTop: 5 },
  histTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  histReason: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, fontStyle: "italic", marginTop: 1 },
  feed: { padding: spacing.lg, gap: spacing.md },
  thread: { gap: spacing.sm },
  emptyFeed: { alignItems: "center", gap: spacing.md, paddingTop: spacing["2xl"], paddingHorizontal: spacing.lg },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", lineHeight: 19 },
  post: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  postMine: { borderColor: colors.brand },
  reply: { marginLeft: spacing.xl, backgroundColor: colors.surface, borderColor: colors.divider },
  postHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  postNick: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  postTime: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  postText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  senseImg: { width: "100%", height: 200, borderRadius: radius.sm, backgroundColor: colors.tertiary, marginBottom: 2 },
  senseObserve: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm - 2, marginBottom: 4 },
  senseRoomOnly: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, fontStyle: "italic", marginBottom: 4 },
  replyBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 2 },
  replyBtnText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2 },
  replyBanner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  replyBannerText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  attachBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 42, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  sendOff: { backgroundColor: colors.tertiary },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  pickRow: { flexDirection: "row", gap: spacing.md },
  pickBtn: { flex: 1, alignItems: "center", gap: 6, paddingVertical: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pickText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  senseBig: { width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.tertiary },
  senseCaption: { minHeight: 44, maxHeight: 120, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggleLine: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  toggleTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  toggleSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  confirmBtn: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 13, alignItems: "center" },
  confirmText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  sheetClose: { alignItems: "center", paddingVertical: spacing.sm },
  sheetCloseText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.base },
});
