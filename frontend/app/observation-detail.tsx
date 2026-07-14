import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable, TextInput, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { InteractionBar } from "@/src/components/InteractionBar";
import { ActionBar } from "@/src/components/ActionBar";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { socialApi, FeedObservation, Comment, mediaUrl } from "@/src/lib/backend";
import { eventsApi, ObservationChain } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";
import { nf, compassPoint } from "@/src/lib/format";
import { SenseSurface } from "@/src/components/SenseSurface";
import { SenseMatchBar } from "@/src/components/SenseMatchBar";
import { orderedDataLayers } from "@/src/lib/senseLayers";

// Compute the "Go There" route that recreates a Senshot's original viewpoint.
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
  // Terrestrial camera Senshot (Sense Vision): "Go There" enters the place from above.
  if (d.from === "sense-vision" && d.lat != null && d.lon != null) {
    const q = new URLSearchParams();
    q.set("lat", String(d.lat)); q.set("lon", String(d.lon));
    q.set("zoom", "6");
    return `/satellite-explore?${q.toString()}`;
  }
  // Invisible Reality 3D field Senshot: "Go There" re-opens the immersive field.
  if (d.from === "invisible-3d") return "/invisible-3d";
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
  const [layersVisible, setLayersVisible] = useState(true);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [o, c] = await Promise.all([socialApi.observation(id), socialApi.comments(id)]);
      setObs(o); setComments(c.items);
      eventsApi.chain(id).then(setChain).catch(() => {});
      // Build an immersive vertical-swipe gallery from recent community Senshots.
      socialApi.feed({ sort: "recent" }).then((f) => {
        const withImg = f.items.filter((it) => it.image_url);
        const uris = withImg.map((it) => mediaUrl(it.image_url)).filter((u): u is string => !!u);
        let idx = withImg.findIndex((it) => it.id === o.id);
        const curUri = mediaUrl(o.image_url);
        if (idx < 0 && curUri) { uris.unshift(curUri); idx = 0; }
        setGallery(uris); setGalleryIndex(Math.max(0, idx));
      }).catch(() => {});
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!user) { router.push("/login" as never); return; }
    if (!text.trim() || !id || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const c = await socialApi.addComment(id, text.trim());
      setComments((prev) => [...prev, c]);
      setText("");
    } catch { /* ignore */ } finally { setSending(false); }
  };

  if (loading) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }
  if (!obs) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><Text style={styles.empty}>Observation non trovata.</Text></View></SpaceBackground>;
  }

  const d = obs.data;
  const uri = mediaUrl(obs.image_url);
  const dataLayers = orderedDataLayers(d).slice(0, 4);
  const goThere = goThereRoute(d as unknown as Record<string, unknown>);

  return (
    <SpaceBackground>
      <ScreenHeader title={obs.category} subtitle={`OverView Score ${obs.overall_score}`} />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ paddingBottom: insets.bottom + spacing["2xl"] }} showsVerticalScrollIndicator={false} testID="observation-detail-remote">
        <Pressable style={styles.author} onPress={() => router.push(`/profile?id=${obs.user_id}` as never)}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{obs.nickname[0].toUpperCase()}</Text></View>
          <Text style={styles.nick}>{obs.nickname}</Text>
        </Pressable>

        {uri ? (
          <SenseSurface
            width={width}
            height={width}
            radius={0}
            fullscreenUri={uri}
            layersVisible={layersVisible}
            onToggleLayers={() => setLayersVisible((v) => !v)}
            gallery={gallery}
            initialIndex={galleryIndex}
            photo={<Image source={{ uri }} style={styles.image} contentFit="cover" transition={200} />}
            overlay={dataLayers.length ? (
              <View style={styles.dataOverlay} pointerEvents="none">
                {dataLayers.map((l) => (
                  <View key={l.key} style={styles.dataPill}>
                    <Text style={styles.dataPillEmoji}>{l.emoji}</Text>
                    <Text style={styles.dataPillText}>{l.current}</Text>
                  </View>
                ))}
              </View>
            ) : undefined}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name={obs.media_type === "audio" ? "musical-notes" : "image"} size={48} color={colors.onSurfaceSecondary} />
          </View>
        )}

        {uri && dataLayers.length ? (
          <Text style={styles.gestureHint}>👆 Tap: Reality Sense™ · 👆👆 Doppio tap: Pure Sense™</Text>
        ) : null}

        {goThere ? (
          <View style={styles.goThereWrap}>
            <Text style={styles.goThereLabel}>Questo Senshot è un punto di vista. Puoi viverlo tu stesso.</Text>
            <View style={styles.goThereRow}>
              <View style={styles.viewSenshot}>
                <Ionicons name="image-outline" size={16} color={colors.onSurface} />
                <Text style={styles.viewSenshotText}>View Senshot</Text>
              </View>
              <Pressable testID="go-there" style={styles.goThereBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(goThere as never); }}>
                <Ionicons name="rocket" size={16} color={colors.onBrand} />
                <Text style={styles.goThereText}>Go There</Text>
              </Pressable>
            </View>
            <Text style={styles.goThereNote}>“Vieni a vedere ciò che ho visto io… oppure continua il viaggio da qui.”</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          {obs.caption ? <Text style={styles.caption}>{obs.caption}</Text> : null}
          <View style={{ marginBottom: spacing.md }}>
            <SenseMatchBar
              hint={[obs.category, d?.senseLayer, (d as Record<string, unknown> | undefined)?.from, (d as Record<string, unknown> | undefined)?.layer].filter(Boolean).join(" ")}
              trackId={(d as Record<string, unknown> | undefined)?.senseTrack as string | undefined}
            />
          </View>
          <InteractionBar obs={obs} />
          <ActionBar obs={obs} />

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

          {d ? (
            <View style={styles.dataCard}>
              {d.lat != null ? <Row label="Coordinate" value={`${nf(d.lat, 3)}°, ${nf(d.lon ?? 0, 3)}°`} /> : null}
              {d.cameraAz != null ? <Row label="Direzione" value={`${compassPoint(d.cameraAz)} ${nf(d.cameraAz, 0)}°`} /> : null}
              {d.moon ? <Row label="Luna" value={`${d.moon.phase} · ${nf(d.moon.illum * 100, 0)}%`} /> : null}
              {d.planets && d.planets.length ? <Row label="Pianeti" value={d.planets.map((p) => p.name).join(", ")} /> : null}
              {d.constellations && d.constellations.length ? <Row label="Costellazioni" value={d.constellations.join(", ")} /> : null}
              {d.iss ? <Row label="ISS" value={`visibile · ${nf(d.iss.alt, 0)}° ${compassPoint(d.iss.az)}`} /> : null}
              {d.satellites && d.satellites.length ? <Row label="Satelliti" value={`${d.satellites.length}`} /> : null}
              {d.spaceWeather?.kp != null ? <Row label="Meteo spaziale" value={`Kp ${nf(d.spaceWeather.kp, 1)}`} /> : null}
              {d.weather?.temp != null ? <Row label="Temperatura" value={`${nf(d.weather.temp, 1)} °C`} /> : null}
            </View>
          ) : null}

          <View style={styles.catRow}>
            {obs.categories.map((c) => <View key={c} style={styles.tag}><Text style={styles.tagText}>{c}</Text></View>)}
          </View>

          {chain && chain.title && (chain.count ?? 0) > 1 ? (
            <View style={styles.chainCard}>
              <View style={styles.chainHead}>
                <Ionicons name="git-network" size={16} color={colors.brand} />
                <Text style={styles.chainTitle}>{chain.title}</Text>
              </View>
              <Text style={styles.chainSub}>
                {chain.count} osservazioni collegate · {chain.observers} osservatori · scope {chain.scope}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chainRow}>
                {chain.items.map((it) => {
                  const turi = mediaUrl(it.image_url);
                  const active = it.id === obs.id;
                  return (
                    <Pressable key={it.id} testID={`chain-${it.id}`}
                      onPress={() => { if (!active) router.push(`/observation-detail?id=${it.id}` as never); }}
                      style={[styles.chainItem, active && styles.chainItemActive]}>
                      {turi ? (
                        <Image source={{ uri: turi }} style={styles.chainThumb} contentFit="cover" transition={150} />
                      ) : (
                        <View style={[styles.chainThumb, styles.chainThumbEmpty]}>
                          <Ionicons name="planet" size={22} color={colors.onSurfaceSecondary} />
                        </View>
                      )}
                      <Text style={styles.chainNick} numberOfLines={1}>{active ? "Questa" : it.nickname}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <Text style={styles.commentsTitle}>Commenti ({comments.length})</Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentNick}>{c.nickname}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
            </View>
          ))}
          {comments.length === 0 ? <Text style={styles.empty}>Nessun commento. Inizia la conversazione scientifica.</Text> : null}
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.commentBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput testID="comment-input" style={styles.commentInput} value={text} onChangeText={setText}
          placeholder={user ? "Aggiungi un commento…" : "Accedi per commentare"} placeholderTextColor={colors.onSurfaceSecondary}
          editable={!!user} />
        <Pressable testID="comment-send" style={styles.sendBtn} onPress={send} disabled={sending}>
          <Ionicons name="send" size={18} color={colors.onBrand} />
        </Pressable>
      </View>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center" },
  author: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  avatarText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  nick: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.tertiary },
  placeholder: { alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg, gap: spacing.lg },
  caption: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 23 },
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
  dataCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dataOverlay: { position: "absolute", top: 12, left: 12, gap: 6, maxWidth: "72%" },
  dataPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(10,12,16,0.44)", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.55)", borderLeftWidth: 2, borderLeftColor: colors.brand },
  dataPillEmoji: { fontSize: 12 },
  dataPillText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1, letterSpacing: 0.2 },
  gestureHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center", opacity: 0.65, paddingVertical: spacing.sm },
  goThereWrap: { marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand, gap: spacing.sm },
  goThereLabel: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, lineHeight: 20 },
  goThereRow: { flexDirection: "row", gap: spacing.md },
  viewSenshot: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  viewSenshotText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  goThereBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md },
  goThereText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  goThereNote: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, fontStyle: "italic", opacity: 0.75 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  rowValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flexShrink: 1, textAlign: "right" },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  tagText: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  commentsTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: spacing.sm },
  chainCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chainHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  chainTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  chainSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  chainRow: { gap: spacing.sm, paddingTop: 2 },
  chainItem: { width: 84, gap: 4 },
  chainItemActive: { opacity: 0.6 },
  chainThumb: { width: 84, height: 84, borderRadius: radius.sm, backgroundColor: colors.tertiary },
  chainThumbEmpty: { alignItems: "center", justifyContent: "center" },
  chainNick: { color: colors.onSurfaceTertiary, fontFamily: fonts.mono, fontSize: type.sm - 2, textAlign: "center" },
  comment: { gap: 2 },
  commentNick: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  commentText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  commentBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  commentInput: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
