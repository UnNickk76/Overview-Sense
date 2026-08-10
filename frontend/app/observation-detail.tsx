import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, ActivityIndicator, Pressable, TextInput, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { InteractionBar } from "@/src/components/InteractionBar";
import { TranslatableText } from "@/src/components/TranslatableText";
import { AddToCollection } from "@/src/components/AddToCollection";
import { ShareHub } from "@/src/components/ShareHub";
import { ActionBar } from "@/src/components/ActionBar";
import { SenseDetail, SenseDisplayConfig } from "@/src/components/SenseDetail";
import { PublishedMusic } from "@/src/components/PublishedMusic";
import { VoicePlayer } from "@/src/components/Voice";
import { GeoPrivacyPicker } from "@/src/components/GeoPrivacyPicker";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { socialApi, FeedObservation, Comment, mediaUrl, eventsApi, ObservationChain, svApi } from "@/src/lib/backend";
import { RecognitionLayer } from "@/src/components/RecognitionLayer";
import type { GeoPrecision } from "@/src/lib/backend";
import type { ObsData } from "@/src/lib/gallery";
import { useAuth } from "@/src/context/AuthContext";
import { geoLevel } from "@/src/lib/geoPrivacy";
import { observationAppUrl } from "@/src/lib/deeplink";

function goThereRoute(d: Record<string, unknown> | null | undefined): string | null {
  if (!d) return null;
  const vp = d.viewpoint as { focus?: string; scale?: number; az?: number; pol?: number; rad?: number } | undefined;
  if (d.from === "universe-explorer" || vp) {
    const focus = vp?.focus ?? (d.cosmicId as string | undefined);
    if (!focus && vp?.scale == null) return null;
    const q = new URLSearchParams();
    if (focus) q.set("focus", String(focus));
    if (vp?.scale != null) q.set("scale", String(vp.scale));
    if (vp?.az != null) q.set("az", String(vp.az));
    if (vp?.pol != null) q.set("pol", String(vp.pol));
    if (vp?.rad != null) q.set("rad", String(vp.rad));
    return `/universe-explorer?${q.toString()}`;
  }
  if (d.from === "satellite-explore" && d.lat != null && d.lon != null) {
    const q = new URLSearchParams();
    q.set("lat", String(d.lat)); q.set("lon", String(d.lon));
    if (d.zoom != null) q.set("zoom", String(d.zoom));
    if (d.layer) q.set("layer", String(d.layer));
    return `/satellite-explore?${q.toString()}`;
  }
  if (d.from === "sense-vision" && d.lat != null && d.lon != null) {
    const q = new URLSearchParams();
    q.set("lat", String(d.lat)); q.set("lon", String(d.lon));
    return `/satellite-explore?${q.toString()}`;
  }
  if (d.from === "invisible-3d") return "/invisible-3d";
  if (d.from === "earth-explorer") return "/earth-explorer";
  return null;
}

export default function ObservationDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [obs, setObs] = useState<FeedObservation | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [chain, setChain] = useState<ObservationChain | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [geoPrec, setGeoPrec] = useState<GeoPrecision>("exact");
  const [savingGeo, setSavingGeo] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [o, c] = await Promise.all([socialApi.observation(id), socialApi.comments(id)]);
      setObs(o); setComments(c.items);
      eventsApi.chain(id).then(setChain).catch(() => {});
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (obs) setGeoPrec((obs.geo_precision ?? obs.data?.geoPrecision ?? "exact") as GeoPrecision);
  }, [obs]);

  const isAuthor = !!user && user.id === obs?.user_id;

  const recognition = obs?.recognition ?? null;
  const [deepening, setDeepening] = useState(false);
  const deepen = useCallback(async () => {
    if (!id || deepening) return;
    setDeepening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const r = await svApi.reanalyze(id);
      setObs((o) => (o ? { ...o, recognition: r.recognition, recognition_version: r.recognition_version } : o));
    } catch { /* ignore */ } finally { setDeepening(false); }
  }, [id, deepening]);

  const persistConfig = useCallback((cfg: SenseDisplayConfig) => {
    if (!id || !isAuthor) return;
    socialApi.updateObservation(id, {
      legend_hidden: cfg.legendHidden, legend_on: cfg.legendOn, sense_layers: cfg.senseLayers,
    }).catch(() => {});
  }, [id, isAuthor]);

  const changeGeo = async (p: GeoPrecision) => {
    if (!id || !isAuthor) return;
    setGeoPrec(p); setSavingGeo(true);
    try { const u = await socialApi.updateObservation(id, { geo_precision: p }); setObs(u); }
    catch { /* ignore */ } finally { setSavingGeo(false); }
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try { await socialApi.deleteObservation(id); setDeleteOpen(false); router.back(); }
    catch { setDeleting(false); }
  };

  const send = async () => {
    if (!user) { router.push("/login" as never); return; }
    if (!text.trim() || !id || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const c = await socialApi.addComment(id, text.trim());
      setComments((prev) => [...prev, c]); setText("");
    } catch { /* ignore */ } finally { setSending(false); }
  };

  if (loading) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }
  if (!obs) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><Text style={styles.empty}>Observation non trovata.</Text></View></SpaceBackground>;
  }

  const d = (obs.data ?? {}) as ObsData;
  const uri = mediaUrl(obs.image_url);
  const dateStr = new Date((d.ts ?? Date.parse(obs.created_at)) || Date.now()).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const goThere = goThereRoute(d as unknown as Record<string, unknown>);
  const placeFrom = (d as unknown as Record<string, unknown>)?.from as string | undefined;
  const hasPlace = isAuthor && (["sense-vision", "satellite-explore", "invisible-3d", "earth-explorer"].includes(placeFrom ?? "") || obs.lat != null || geoPrec === "none");

  const authorRow = (
    <Pressable style={styles.author} onPress={() => router.push(`/profile?id=${obs.user_id}` as never)}>
      <View style={styles.avatar}>
        {mediaUrl(obs.avatar) ? <Image source={{ uri: mediaUrl(obs.avatar)! }} style={styles.avatarImg} contentFit="cover" /> : <Text style={styles.avatarText}>{obs.nickname[0].toUpperCase()}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nick}>{obs.nickname}</Text>
        <Text style={styles.scoreLine}>OverView Score {obs.overall_score}{obs.confirmed ? " · Confermata" : ""}</Text>
      </View>
    </Pressable>
  );

  const socialBlock = (
    <View style={{ gap: spacing.md }}>
      {obs.title ? <Text style={styles.postTitle}>{obs.title}</Text> : null}
      {obs.caption ? <TranslatableText text={obs.caption} textStyle={styles.caption} /> : null}
      {obs.hashtags && obs.hashtags.length > 0 ? (
        <View style={styles.hashRow}>{obs.hashtags.map((h) => <Text key={h} style={styles.hash}>#{h}</Text>)}</View>
      ) : null}
      {obs.tagged_users && obs.tagged_users.length > 0 ? (
        <Text style={styles.taggedLine}>{"con "}{obs.tagged_users.map((t) => `@${t.nickname}`).join(", ")}</Text>
      ) : null}
      {obs.music ? <PublishedMusic music={obs.music} /> : null}
      {obs.voice ? <VoicePlayer voice={obs.voice} /> : null}
      <InteractionBar obs={obs} />
      <ActionBar obs={obs} />
      {user ? (
        <View style={styles.socialBtns}>
          <Pressable testID="obs-add-collection" style={styles.socialBtn} onPress={() => { Haptics.selectionAsync(); setCollectionOpen(true); }}>
            <Ionicons name="albums-outline" size={17} color={colors.brand} />
            <Text style={styles.socialBtnText}>Collezione</Text>
          </Pressable>
          <Pressable testID="obs-share" style={styles.socialBtn} onPress={() => { Haptics.selectionAsync(); setShareOpen(true); }}>
            <Ionicons name="paper-plane-outline" size={17} color={colors.brand} />
            <Text style={styles.socialBtnText}>Invia / Condividi</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const belowData = (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.scoreCard}>
        <View style={styles.scoreHead}>
          <View style={styles.scoreMain}>
            <Ionicons name="sparkles" size={16} color={colors.brand} />
            <Text style={styles.scoreMainValue}>{obs.overall_score}</Text>
            <Text style={styles.scoreMainLabel}>OverView Score</Text>
          </View>
          {obs.confirmed ? (
            <View style={styles.confirmedChip}>
              <Ionicons name="checkmark-circle" size={14} color={colors.blue} />
              <Text style={styles.confirmedChipText}>Confermata dalla community</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.scoreBreakdown}>
          <ScoreBit label="Scientifico" value={obs.scientific_value} />
          <ScoreBit label="Community" value={obs.community_value} />
          <ScoreBit label="Rarità" value={obs.rarity_score} />
        </View>
      </View>

      <View style={styles.catRow}>
        {obs.categories.map((c) => <View key={c} style={styles.tag}><Text style={styles.tagText}>{c}</Text></View>)}
      </View>

      <RecognitionLayer
        recognition={recognition}
        obsId={obs.id}
        onDeepen={isAuthor ? deepen : undefined}
        deepening={deepening}
      />

      {goThere ? (
        <View style={styles.goThereWrap}>
          <Text style={styles.goThereLabel}>Questo Senshot è un punto di vista. Puoi viverlo tu stesso.</Text>
          <Pressable testID="go-there" style={styles.goThereBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(goThere as never); }}>
            <Ionicons name="rocket" size={16} color={colors.onBrand} />
            <Text style={styles.goThereText}>Go There</Text>
          </Pressable>
        </View>
      ) : null}

      {hasPlace ? (
        <View style={styles.geoCard}>
          <View style={styles.geoHead}>
            <Text style={styles.geoHeadTitle}>Go There™ · Privacy posizione</Text>
            {savingGeo ? <ActivityIndicator size="small" color={colors.brand} /> : (
              <Text style={styles.geoCurrent}>{geoLevel(geoPrec).emoji} {geoLevel(geoPrec).label}</Text>
            )}
          </View>
          <GeoPrivacyPicker value={geoPrec} onChange={changeGeo} />
        </View>
      ) : null}

      {chain && chain.title && (chain.count ?? 0) > 1 ? (
        <View style={styles.chainCard}>
          <View style={styles.chainHead}>
            <Ionicons name="git-network" size={16} color={colors.brand} />
            <Text style={styles.chainTitle}>{chain.title}</Text>
          </View>
          <Text style={styles.chainSub}>{chain.count} osservazioni · {chain.observers} osservatori</Text>
        </View>
      ) : null}

      {isAuthor ? (
        <Pressable testID="obs-delete" style={styles.deleteBtn} onPress={() => { Haptics.selectionAsync(); setDeleteOpen(true); }}>
          <Ionicons name="trash-outline" size={17} color={colors.error} />
          <Text style={styles.deleteText}>Elimina {obs.is_pulse ? "questo Pulse™" : "questo Senshot"}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.commentsTitle}>Commenti ({comments.length})</Text>
      {comments.map((c) => (
        <View key={c.id} style={styles.comment}>
          {mediaUrl(c.avatar) ? (
            <Image source={{ uri: mediaUrl(c.avatar)! }} style={styles.commentAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.commentAvatar, styles.commentAvatarFb]}><Text style={styles.commentAvatarInit}>{(c.nickname || "?")[0].toUpperCase()}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.commentNick}>{c.nickname}</Text>
            <TranslatableText text={c.text} textStyle={styles.commentText} />
          </View>
        </View>
      ))}
      {comments.length === 0 ? <Text style={styles.empty}>Nessun commento. Inizia la conversazione scientifica.</Text> : null}
    </View>
  );

  return (
    <SpaceBackground>
      <ScreenHeader title={obs.category} subtitle={`OverView Score ${obs.overall_score}`} />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false} testID="observation-detail-remote">
        {uri ? (
          <SenseDetail
            uri={uri}
            data={d}
            code={d.senseCode || obs.title || obs.category}
            dateStr={dateStr}
            animKey={obs.id}
            qrValue={observationAppUrl(obs.id)}
            canEdit={isAuthor}
            onPersistConfig={persistConfig}
            headerSlot={authorRow}
            renderActions={() => socialBlock}
            belowData={belowData}
          />
        ) : (
          <>
            {authorRow}
            <View style={[styles.placeholder]}>
              <Ionicons name={obs.media_type === "audio" ? "musical-notes" : "image"} size={48} color={colors.onSurfaceSecondary} />
            </View>
            {socialBlock}
            {belowData}
          </>
        )}
      </KeyboardAwareScrollView>

      <View style={[styles.commentBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput testID="comment-input" style={styles.commentInput} value={text} onChangeText={setText}
          placeholder={user ? "Aggiungi un commento…" : "Accedi per commentare"} placeholderTextColor={colors.onSurfaceSecondary}
          editable={!!user} />
        <Pressable testID="comment-send" style={styles.sendBtn} onPress={send} disabled={sending}>
          <Ionicons name="send" size={18} color={colors.onBrand} />
        </Pressable>
      </View>

      <ConfirmSheet
        visible={deleteOpen} destructive icon="trash"
        title="Eliminare definitivamente?"
        message={`${obs.is_pulse ? "Questo Pulse™" : "Questo Senshot"} verrà rimosso da OverView™ insieme a commenti e interazioni. L'azione non è reversibile.`}
        confirmLabel="Elimina" loading={deleting}
        onConfirm={confirmDelete} onCancel={() => setDeleteOpen(false)}
      />
      {shareOpen ? <ShareHub obs={obs} onClose={() => setShareOpen(false)} /> : null}
      {collectionOpen ? <AddToCollection obsId={obs.id} onClose={() => setCollectionOpen(false)} /> : null}
    </SpaceBackground>
  );
}

function ScoreBit({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.scoreBit}>
      <Text style={styles.scoreBitValue}>{value}</Text>
      <Text style={styles.scoreBitLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center" },
  author: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, overflow: "hidden" },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.lg },
  nick: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  scoreLine: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  placeholder: { width: "100%", aspectRatio: 1, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  caption: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 23 },
  postTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  hashRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hash: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  taggedLine: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  socialBtns: { flexDirection: "row", gap: spacing.md },
  socialBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(212,175,55,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  socialBtnText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  scoreCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  scoreHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  scoreMain: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreMainValue: { color: colors.brand, fontFamily: fonts.bold, fontSize: type["2xl"] },
  scoreMainLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  confirmedChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  confirmedChipText: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  scoreBreakdown: { flexDirection: "row", gap: spacing.sm },
  scoreBit: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, paddingVertical: spacing.sm },
  scoreBitValue: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  scoreBitLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  tagText: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  goThereWrap: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand, gap: spacing.sm },
  goThereLabel: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, lineHeight: 20 },
  goThereBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md },
  goThereText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  geoCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  geoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  geoHeadTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  geoCurrent: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  chainCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chainHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  chainTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  chainSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(255,69,58,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.error },
  deleteText: { color: colors.error, fontFamily: fonts.semibold, fontSize: type.base },
  commentsTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  comment: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentAvatarFb: { backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center" },
  commentAvatarInit: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.sm },
  commentNick: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  commentText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  commentBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  commentInput: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
