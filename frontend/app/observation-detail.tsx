import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable, TextInput, useWindowDimensions, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Svg, { Line, Circle, Text as SvgText, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { CONSTELLATION_LINES } from "@/src/lib/stars";
import { project } from "@/src/lib/project";
import type { ObsPoint } from "@/src/lib/gallery";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { InteractionBar } from "@/src/components/InteractionBar";
import { ActionBar } from "@/src/components/ActionBar";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { socialApi, FeedObservation, Comment, mediaUrl, eventsApi, ObservationChain, snapSenseApi } from "@/src/lib/backend";
import type { GeoPrecision } from "@/src/lib/backend";
import { pulseForNow } from "@/src/lib/pulseTasks";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "@/src/context/AuthContext";
import { nf, compassPoint } from "@/src/lib/format";
import { SenseSurface } from "@/src/components/SenseSurface";
import { PublishedMusic } from "@/src/components/PublishedMusic";
import { VoicePlayer } from "@/src/components/Voice";
import { SenseRecognized } from "@/src/components/SenseRecognized";
import { orderedDataLayers } from "@/src/lib/senseLayers";
import { GeoPrivacyPicker } from "@/src/components/GeoPrivacyPicker";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { geoLevel } from "@/src/lib/geoPrivacy";

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
  // Terrestrial camera Senshot (Sense Vision): "Go There" enters the place from above,
  // landing close (satellite-explore defaults to a near zoom + Sentinel-2 HD).
  if (d.from === "sense-vision" && d.lat != null && d.lon != null) {
    const q = new URLSearchParams();
    q.set("lat", String(d.lat)); q.set("lon", String(d.lon));
    return `/satellite-explore?${q.toString()}`;
  }
  // Invisible Reality 3D field Senshot: "Go There" re-opens the immersive field.
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
  const [layersVisible, setLayersVisible] = useState(true);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [hiddenObj, setHiddenObj] = useState<Set<string>>(new Set());
  const [legendOn, setLegendOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geoPrec, setGeoPrec] = useState<GeoPrecision>("exact");
  const [savingGeo, setSavingGeo] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState<null | "snapsense" | "pulse">(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

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
  useEffect(() => {
    if (obs?.data) {
      setHiddenObj(new Set(obs.data.legendHidden ?? []));
      setLegendOn(obs.data.legendOn !== false);
    }
    if (obs) setGeoPrec((obs.geo_precision ?? obs.data?.geoPrecision ?? "exact") as GeoPrecision);
  }, [obs]);

  const isAuthor = !!user && user.id === obs?.user_id;
  const dd = obs?.data;
  const camAz = dd?.cameraAz ?? 0;
  const camAlt = dd?.cameraAlt ?? 0;

  // Project the recorded sky (Beyond View: recomputed from saved az/alt, nothing invented).
  const overlay = useMemo(() => {
    if (!dd) return null;
    const p = (az: number, alt: number) => project(az, alt, camAz, camAlt, width, width);
    const starPts = new Map<string, { x: number; y: number }>();
    (dd.stars ?? []).forEach((s) => { const pt = p(s.az, s.alt); if (pt) starPts.set(s.name, pt); });
    const lines = CONSTELLATION_LINES
      .map(([a, b]) => ({ a: starPts.get(a), b: starPts.get(b) }))
      .filter((l) => l.a && l.b) as { a: { x: number; y: number }; b: { x: number; y: number } }[];
    const mk = (arr: ObsPoint[] | undefined) =>
      (arr ?? []).map((o) => ({ ...o, pt: o.alt >= 0 ? p(o.az, o.alt) : null })).filter((o) => o.pt) as (ObsPoint & { pt: { x: number; y: number } })[];
    return {
      stars: Array.from(starPts.values()),
      lines,
      planets: mk(dd.planets),
      satellites: mk(dd.satellites),
      iss: dd.iss && dd.iss.alt >= 0 ? { ...dd.iss, pt: p(dd.iss.az, dd.iss.alt) } : null,
      moon: dd.moon && dd.moon.alt >= 0 ? p(dd.moon.az, dd.moon.alt) : null,
      gc: dd.galacticCenter ? p(dd.galacticCenter.az, dd.galacticCenter.alt) : null,
    };
  }, [dd, camAz, camAlt, width]);

  const recognized = useMemo(() => {
    if (!dd) return [] as { name: string; kind: string }[];
    const out: { name: string; kind: string }[] = [];
    (dd.planets ?? []).forEach((p) => out.push({ name: p.name, kind: "Pianeta" }));
    if (dd.iss) out.push({ name: "ISS", kind: "Satellite" });
    (dd.satellites ?? []).forEach((s) => out.push({ name: s.name, kind: "Satellite" }));
    if (dd.moon) out.push({ name: "Luna", kind: "Luna" });
    return out;
  }, [dd]);

  const persistLegend = useCallback(async (hidden: Set<string>, on: boolean) => {
    if (!id || !isAuthor) return;
    setSaving(true);
    try {
      await socialApi.updateObservation(id, { legend_hidden: Array.from(hidden), legend_on: on });
    } catch { /* ignore */ } finally { setSaving(false); }
  }, [id, isAuthor]);

  const toggleObj = (name: string) => {
    Haptics.selectionAsync();
    setHiddenObj((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      persistLegend(next, legendOn);
      return next;
    });
  };

  const toggleNames = () => {
    Haptics.selectionAsync();
    setLegendOn((v) => { const nv = !v; persistLegend(hiddenObj, nv); return nv; });
  };

  const changeGeo = async (p: GeoPrecision) => {
    if (!id || !isAuthor) return;
    setGeoPrec(p);
    setSavingGeo(true);
    try { const u = await socialApi.updateObservation(id, { geo_precision: p }); setObs(u); }
    catch { /* ignore */ } finally { setSavingGeo(false); }
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await socialApi.deleteObservation(id);
      setDeleteOpen(false);
      router.back();
    } catch { setDeleting(false); }
  };

  const shareAs = async (target: "snapsense" | "pulse") => {
    const shareUri = mediaUrl(obs?.image_url);
    if (!shareUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSharing(target);
    setShareMsg(null);
    try {
      const m = await ImageManipulator.manipulateAsync(shareUri, [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (target === "snapsense") {
        await snapSenseApi.create({ kind: "photo", image_base64: m.base64 ?? undefined, caption: obs?.caption || undefined, source: obs?.source });
        setShareMsg("Condiviso come SenseShot™ ✓");
      } else {
        const t = pulseForNow();
        await socialApi.createObservation({
          media_type: "image", source: "reality", caption: obs?.caption || "",
          image_base64: m.base64 ?? undefined, data: obs?.data, is_pulse: true,
          pulse_task: { id: t.id, title: t.title, theme: t.theme, prompt: t.prompt },
        });
        setShareMsg("Condiviso come Pulse™ ✓");
      }
      setTimeout(() => { setShareOpen(false); setShareMsg(null); }, 1300);
    } catch {
      setShareMsg("Condivisione non riuscita");
    } finally { setSharing(null); }
  };

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
  const placeFrom = (d as Record<string, unknown> | undefined)?.from as string | undefined;
  const hasPlace = isAuthor && (["sense-vision", "satellite-explore", "invisible-3d", "earth-explorer"].includes(placeFrom ?? "") || obs.lat != null || geoPrec === "none");

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
            overlay={
              <>
                {overlay && recognized.length ? (
                  <Svg width={width} height={width} style={StyleSheet.absoluteFill} pointerEvents="none">
                    {overlay.lines.map((l, i) => (
                      <Line key={`l${i}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#5AB0FF" strokeWidth={1.2} opacity={0.55} />
                    ))}
                    {overlay.stars.map((s, i) => (
                      <Circle key={`st${i}`} cx={s.x} cy={s.y} r={2} fill="#EAF2FF" />
                    ))}
                    {overlay.planets.filter((pl) => !hiddenObj.has(pl.name)).map((pl, i) => (
                      <G key={`pl${i}`}>
                        <Circle cx={pl.pt.x} cy={pl.pt.y} r={13} fill="#D4AF37" opacity={0.14} />
                        <Circle cx={pl.pt.x} cy={pl.pt.y} r={7} stroke="#D4AF37" strokeWidth={1.2} fill="none" opacity={0.85} />
                        <Circle cx={pl.pt.x} cy={pl.pt.y} r={2.4} fill="#D4AF37" />
                        {legendOn ? (
                          <>
                            <Line x1={pl.pt.x} y1={pl.pt.y - 13} x2={pl.pt.x} y2={pl.pt.y - 27} stroke="#D4AF37" strokeWidth={1} opacity={0.65} />
                            <SvgText x={pl.pt.x} y={pl.pt.y - 31} fill="#F0DC9A" fontSize={11} fontWeight="600" textAnchor="middle">{pl.name}</SvgText>
                          </>
                        ) : null}
                      </G>
                    ))}
                    {overlay.satellites.filter((s) => !hiddenObj.has(s.name)).map((s, i) => (
                      <G key={`sat${i}`}>
                        <Circle cx={s.pt.x} cy={s.pt.y} r={11} fill="#0A84FF" opacity={0.16} />
                        <Circle cx={s.pt.x} cy={s.pt.y} r={2.2} fill="#8FD0FF" />
                        {legendOn ? (
                          <>
                            <Line x1={s.pt.x} y1={s.pt.y - 11} x2={s.pt.x} y2={s.pt.y - 24} stroke="#8FD0FF" strokeWidth={1} opacity={0.6} />
                            <SvgText x={s.pt.x} y={s.pt.y - 28} fill="#8FD0FF" fontSize={9.5} textAnchor="middle">{s.name}</SvgText>
                          </>
                        ) : null}
                      </G>
                    ))}
                    {overlay.iss?.pt && !hiddenObj.has("ISS") ? (
                      <G>
                        <Circle cx={overlay.iss.pt.x} cy={overlay.iss.pt.y} r={13} fill="#D4AF37" opacity={0.16} />
                        <Circle cx={overlay.iss.pt.x} cy={overlay.iss.pt.y} r={7} fill="none" stroke="#D4AF37" strokeWidth={2} />
                        {legendOn ? (
                          <>
                            <Line x1={overlay.iss.pt.x} y1={overlay.iss.pt.y - 13} x2={overlay.iss.pt.x} y2={overlay.iss.pt.y - 27} stroke="#D4AF37" strokeWidth={1} opacity={0.7} />
                            <SvgText x={overlay.iss.pt.x} y={overlay.iss.pt.y - 31} fill="#F0DC9A" fontSize={11} fontWeight="700" textAnchor="middle">ISS</SvgText>
                          </>
                        ) : null}
                      </G>
                    ) : null}
                    {overlay.moon && !hiddenObj.has("Luna") ? <SvgText x={overlay.moon.x} y={overlay.moon.y} fill="#fff" fontSize={16}>☾</SvgText> : null}
                    {overlay.gc ? <SvgText x={overlay.gc.x - 20} y={overlay.gc.y} fill="#F0C674" fontSize={10}>◄ Via Lattea</SvgText> : null}
                  </Svg>
                ) : null}
                {dataLayers.length ? (
                  <View style={styles.dataOverlay} pointerEvents="none">
                    {dataLayers.map((l) => (
                      <View key={l.key} style={styles.dataPill}>
                        <Text style={styles.dataPillEmoji}>{l.emoji}</Text>
                        <Text style={styles.dataPillText}>{l.current}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            }
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name={obs.media_type === "audio" ? "musical-notes" : "image"} size={48} color={colors.onSurfaceSecondary} />
          </View>
        )}

        {uri && dataLayers.length ? (
          <Text style={styles.gestureHint}>👆 Tap: Reality Sense™ · 👆👆 Doppio tap: Pure Sense™</Text>
        ) : null}

        {dd ? (
          <SenseRecognized dd={dd} camAz={camAz} camAlt={camAlt} cardW={width} cardH={width}
            hiddenObj={hiddenObj} canEdit={isAuthor} legendOn={legendOn} saving={saving}
            onToggleObj={toggleObj} onToggleNames={toggleNames} />
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

        {hasPlace ? (
          <View style={styles.geoCard}>
            <View style={styles.geoHead}>
              <Text style={styles.geoHeadTitle}>Go There™ · Privacy posizione</Text>
              {savingGeo ? <ActivityIndicator size="small" color={colors.brand} /> : (
                <Text style={styles.geoCurrent}>{geoLevel(geoPrec).emoji} {geoLevel(geoPrec).label}</Text>
              )}
            </View>
            <GeoPrivacyPicker value={geoPrec} onChange={changeGeo} />
            <Text style={styles.geoFoot}>OverView™ condivide un punto di vista, non la tua vita privata. Puoi cambiare questo livello quando vuoi.</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          {obs.title ? <Text style={styles.postTitle}>{obs.title}</Text> : null}
          {obs.caption ? <Text style={styles.caption}>{obs.caption}</Text> : null}
          {obs.hashtags && obs.hashtags.length > 0 ? (
            <View style={styles.hashRow}>
              {obs.hashtags.map((h) => <Text key={h} style={styles.hash}>#{h}</Text>)}
            </View>
          ) : null}
          {obs.tagged_users && obs.tagged_users.length > 0 ? (
            <Text style={styles.taggedLine}>
              <Ionicons name="pricetag" size={12} color={colors.onSurfaceSecondary} />
              {"  con "}{obs.tagged_users.map((t) => `@${t.nickname}`).join(", ")}
            </Text>
          ) : null}
          {obs.music ? (
            <View style={{ marginTop: spacing.md }}><PublishedMusic music={obs.music} /></View>
          ) : null}
          {obs.voice ? (
            <View style={{ marginTop: spacing.md }}><VoicePlayer voice={obs.voice} /></View>
          ) : null}
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

          {isAuthor ? (
            <Pressable testID="obs-share" style={styles.shareBtn} onPress={() => { Haptics.selectionAsync(); setShareOpen(true); }}>
              <Ionicons name="share-social-outline" size={17} color={colors.brand} />
              <Text style={styles.shareText}>Condividi anche come SenseShot™ o Pulse™</Text>
            </Pressable>
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
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
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

      <ConfirmSheet
        visible={deleteOpen}
        destructive
        icon="trash"
        title="Eliminare definitivamente?"
        message={`${obs.is_pulse ? "Questo Pulse™" : "Questo Senshot"} verrà rimosso da OverView™ insieme a commenti e interazioni. L'azione non è reversibile.`}
        confirmLabel="Elimina"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <Pressable style={styles.shareBackdrop} onPress={() => sharing ? undefined : setShareOpen(false)}>
          <Pressable style={styles.shareSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.shareHandle} />
            <Text style={styles.shareTitle}>Condividi questo Observe™</Text>
            <Text style={styles.shareHint}>Lo stesso punto di vista, in un altro formato di OverView™.</Text>
            <Pressable testID="share-snapsense" style={styles.shareItem} onPress={() => shareAs("snapsense")} disabled={!!sharing}>
              <View style={styles.shareIcon}><Ionicons name="flash" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareItemTitle}>Come SenseShot™</Text>
                <Text style={styles.shareItemSub}>Appare nella barra SnapSense™ per 24 ore.</Text>
              </View>
              {sharing === "snapsense" ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
            </Pressable>
            <Pressable testID="share-pulse" style={styles.shareItem} onPress={() => shareAs("pulse")} disabled={!!sharing}>
              <View style={styles.shareIcon}><Ionicons name="pulse" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareItemTitle}>Come Pulse™</Text>
                <Text style={styles.shareItemSub}>Come risposta alla sfida osservativa di oggi.</Text>
              </View>
              {sharing === "pulse" ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
            </Pressable>
            {shareMsg ? <Text style={styles.shareMsg}>{shareMsg}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>
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
  postTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl, marginBottom: 4 },
  hashRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  hash: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  taggedLine: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 8 },
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
  legendCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  legendHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legendCardTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  legendCardHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
  namesToggle: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: colors.brand },
  namesToggleOn: { backgroundColor: colors.brand },
  namesToggleText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2 },
  legendChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  legendChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  legendChipOn: { borderColor: colors.brand },
  legendChipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  geoCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  geoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  geoHeadTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  geoCurrent: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  geoFoot: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, fontStyle: "italic", lineHeight: 15 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(255,69,58,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.error },
  deleteText: { color: colors.error, fontFamily: fonts.semibold, fontSize: type.base },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: "rgba(212,175,55,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand, marginBottom: spacing.sm },
  shareText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  shareBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  shareSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing["2xl"], borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, gap: spacing.sm },
  shareHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  shareTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  shareHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginBottom: spacing.sm },
  shareItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  shareIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(212,175,55,0.12)", alignItems: "center", justifyContent: "center" },
  shareItemTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  shareItemSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  shareMsg: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, textAlign: "center", marginTop: spacing.sm },
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
