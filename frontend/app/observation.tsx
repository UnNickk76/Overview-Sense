import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Line, Circle, Text as SvgText, G, Polygon } from "react-native-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import QRCode from "react-native-qrcode-svg";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { getObservation, observationCode, Observation, ObsPoint } from "@/src/lib/gallery";
import { CONSTELLATION_LINES, activeConstellations, type Constellation } from "@/src/lib/constellations";
import { ConstellationSheet } from "@/src/components/ConstellationSheet";
import { project } from "@/src/lib/project";
import { nf, compassPoint } from "@/src/lib/format";
import { socialApi, aiApi } from "@/src/lib/backend";
import { ApiError } from "@/src/lib/client";
import { useAuth } from "@/src/context/AuthContext";
import { BrandName } from "@/src/components/Brand";
import { pulseForNow } from "@/src/lib/pulseTasks";
import { SenseCanvas, layerToVisual, SenseVisualLayer } from "@/src/components/SenseCanvas";
import { SenseLayerBar } from "@/src/components/SenseLayerBar";
import { availableDataLayers, orderedDataLayers, recommendedFor } from "@/src/lib/senseLayers";
import { SenseSurface } from "@/src/components/SenseSurface";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import { SenseMark } from "@/src/components/SenseMark";
import { DiscoveryCard, CardFormat } from "@/src/components/DiscoveryCard";
import { observationLandingUrl, observationAppUrl } from "@/src/lib/deeplink";
import { GeoPrivacyPicker } from "@/src/components/GeoPrivacyPicker";
import { SenseRecognized } from "@/src/components/SenseRecognized";
import type { GeoPrecision } from "@/src/lib/backend";
import { assessPrivacy, recordPlace } from "@/src/lib/placeHistory";

export default function ObservationView() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [obs, setObs] = useState<Observation | null>(null);
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [visualLayer, setVisualLayer] = useState<SenseVisualLayer>("Originale");
  const [activeData, setActiveData] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState<{ label: string; pixel: SenseVisualLayer[]; data: string[] } | null>(null);
  const [layersVisible, setLayersVisible] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<CardFormat>("square");
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [hiddenObj, setHiddenObj] = useState<Set<string>>(new Set());
  const [legendOn, setLegendOn] = useState(true);
  const [includeQr, setIncludeQr] = useState(false);
  const [pubOpen, setPubOpen] = useState(false);
  const [geoPrec, setGeoPrec] = useState<GeoPrecision>("exact");
  const [geoSuggest, setGeoSuggest] = useState<GeoPrecision | null>(null);
  const [geoReason, setGeoReason] = useState<string | null>(null);
  const shotRef = useRef<ViewShot>(null);
  const cardRef = useRef<ViewShot>(null);
  const [constSel, setConstSel] = useState<Constellation | null>(null);

  useEffect(() => { if (id) getObservation(id).then(setObs); }, [id]);
  useEffect(() => {
    if (obs?.data) {
      setVisualLayer(layerToVisual(obs.data.senseLayer));
      setHiddenObj(new Set(obs.data.legendHidden ?? []));
      setLegendOn(obs.data.legendOn !== false);
    }
    // Go There™ auto-protection: assess whether this is a frequently-visited place.
    const lat = obs?.data?.lat, lon = obs?.data?.lon;
    if (lat != null && lon != null) {
      assessPrivacy(lat, lon).then((a) => {
        if (a.suggested) { setGeoSuggest(a.suggested); setGeoReason(a.reason); setGeoPrec(a.suggested); }
        recordPlace(lat, lon);
      }).catch(() => {});
    }
  }, [obs]);

  const cardW = width - spacing.lg * 2;
  const cardH = cardW * 1.25;
  const d = obs?.data;
  const camAz = d?.cameraAz ?? 0;
  const camAlt = d?.cameraAlt ?? 0;

  const overlay = useMemo(() => {
    if (!d) return null;
    const p = (az: number, alt: number) => project(az, alt, camAz, camAlt, cardW, cardH);
    const starPts = new Map<string, { x: number; y: number }>();
    (d.stars ?? []).forEach((s) => { const pt = p(s.az, s.alt); if (pt) starPts.set(s.name, pt); });
    const lines = CONSTELLATION_LINES
      .map(([a, b]) => ({ a: starPts.get(a), b: starPts.get(b) }))
      .filter((l) => l.a && l.b) as { a: { x: number; y: number }; b: { x: number; y: number } }[];
    const mk = (arr: ObsPoint[] | undefined) =>
      (arr ?? []).map((o) => ({ ...o, pt: o.alt >= 0 ? p(o.az, o.alt) : null })).filter((o) => o.pt) as (ObsPoint & { pt: { x: number; y: number } })[];
    const activeC = activeConstellations(new Set(starPts.keys()));
    const figures = activeC.map((c) => {
      const pts = c.figure.map((n) => starPts.get(n)).filter(Boolean) as { x: number; y: number }[];
      const memberPts = c.stars.map((n) => starPts.get(n)).filter(Boolean) as { x: number; y: number }[];
      const cx = memberPts.reduce((a, m) => a + m.x, 0) / Math.max(1, memberPts.length);
      const cy = memberPts.reduce((a, m) => a + m.y, 0) / Math.max(1, memberPts.length);
      return { c, poly: pts.length >= 3 ? pts.map((pt) => `${pt.x},${pt.y}`).join(" ") : null, cx, cy };
    });
    return {
      stars: Array.from(starPts.values()),
      lines,
      inFrameConstellations: activeC.map((c) => c.name),
      figures,
      planets: mk(d.planets),
      satellites: mk(d.satellites),
      iss: d.iss && d.iss.alt >= 0 ? { ...d.iss, pt: p(d.iss.az, d.iss.alt) } : null,
      sun: d.sun ? p(d.sun.az, d.sun.alt) : null,
      moon: d.moon && d.moon.alt >= 0 ? p(d.moon.az, d.moon.alt) : null,
      gc: d.galacticCenter ? p(d.galacticCenter.az, d.galacticCenter.alt) : null,
    };
  }, [d, camAz, camAlt, cardW, cardH]);

  const toggleObj = (name: string) => {
    Haptics.selectionAsync();
    setHiddenObj((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("Preparazione…");
    try {
      const uri = await captureRef(shotRef, { format: "jpg", quality: 0.95 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      setStatus(null);
    } catch { setStatus("Condivisione non riuscita"); }
  };
  const saveToPhotos = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("Salvataggio…");
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) { setStatus("Permesso Foto negato"); return; }
    try {
      const uri = await captureRef(shotRef, { format: "jpg", quality: 0.95 });
      await MediaLibrary.saveToLibraryAsync(uri);
      setStatus("Salvato in Foto ✓");
    } catch { setStatus("Errore"); }
  };

  const exportCardShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExportStatus("Preparazione…");
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      setExportStatus(null);
    } catch { setExportStatus("Condivisione non riuscita"); }
  };
  const exportCardSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExportStatus("Salvataggio…");
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) { setExportStatus("Permesso Foto negato"); return; }
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      setExportStatus("Salvata in Foto ✓");
    } catch { setExportStatus("Errore"); }
  };

  const publish = async (asPulse: boolean) => {
    if (!obs || !obs.data) return;
    if (!user) { router.push("/login" as never); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPublishing(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        obs.uri, [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      let pulseTask = obs.data.pulse;
      if (asPulse && !pulseTask) {
        const t = pulseForNow();
        pulseTask = { id: t.id, title: t.title, theme: t.theme, prompt: t.prompt };
      }
      const data = { ...obs.data, legendHidden: Array.from(hiddenObj), legendOn, geoPrecision: geoPrec };
      const created = await socialApi.createObservation({
        media_type: "image", source: "reality",
        caption: "", image_base64: manipulated.base64 ?? undefined, data,
        is_pulse: asPulse || !!obs.data.pulse,
        pulse_task: asPulse || obs.data.pulse ? pulseTask : undefined,
      });
      setPubOpen(false);
      setPublished(created.id);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 422
        ? e.message
        : "Pubblicazione non riuscita";
      setStatus(msg);
      setPubOpen(false);
    } finally { setPublishing(false); }
  };

  const explain = async () => {
    if (!obs?.data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiLoading(true);
    const d = obs.data;
    const fields: { label: string; value: string }[] = [];
    fields.push({ label: "Layer visivo attivo", value: `${visualLayer} (rimappa reale dei pixel)` });
    if (d.senseLayer) fields.push({ label: "Sense Layer alla cattura", value: d.senseLayer });
    for (const l of availableDataLayers(d)) fields.push({ label: l.label, value: l.current });
    if (d.sun) fields.push({ label: "Sole", value: d.sun.alt > 0 ? `${nf(d.sun.alt, 0)}° sopra l'orizzonte` : "sotto l'orizzonte" });
    if (d.moon) fields.push({ label: "Luna", value: `${d.moon.phase}, ${nf(d.moon.illum * 100, 0)}%` });
    if (d.lat != null) fields.push({ label: "Coordinate", value: `${nf(d.lat, 3)}°, ${nf(d.lon ?? 0, 3)}°` });
    try {
      const r = await aiApi.explainVisualization(fields);
      setAiText(r.text);
    } catch { setAiText(null); } finally { setAiLoading(false); }
  };

  // AI explains every Sense automatically (rigorous, based only on real data).
  useEffect(() => {
    if (!obs?.data || aiText || aiLoading) return;
    // Visual Assistant Senshots already carry the exact scene explanation.
    if (obs.data.aiNote) { setAiText(obs.data.aiNote); return; }
    explain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs?.id]);

  // AI recognises the framed subject to SUGGEST the most useful layers (manual always available).
  useEffect(() => {
    if (!obs?.uri || subject) return;
    let alive = true;
    (async () => {
      try {
        const b64 = await FileSystem.readAsStringAsync(obs.uri, { encoding: FileSystem.EncodingType.Base64 });
        const r = await aiApi.recognizeSubject(b64);
        if (!alive) return;
        const rec = recommendedFor(r.subject);
        setSubject({ label: r.label_it || rec.label, pixel: rec.pixel, data: rec.data });
        // auto-activate the first 2-3 recommended layers that actually have real data
        const avail = new Set(availableDataLayers(obs.data).map((l) => l.key));
        setActiveData(new Set(rec.data.filter((k) => avail.has(k)).slice(0, 3)));
      } catch { /* recognition is best-effort */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs?.id]);

  if (!obs || !d) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }

  const dateStr = new Date(d.ts).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const qrValue = published ? observationLandingUrl(published) : observationAppUrl(obs.id);
  const dataLayers = orderedDataLayers(d, subject?.data);

  return (
    <SpaceBackground>
      <ScreenHeader title={observationCode(obs.seq)} subtitle={dateStr} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false} testID="observation-view">

        <View style={styles.senseHero}>
          <SenseMark size={22} />
          <Text style={styles.senseHeroText}>SENSE CREATED · The Invisible Sense</Text>
        </View>

        <ViewShot ref={shotRef} style={{ width: cardW, height: cardH, alignSelf: "center", borderRadius: 18, overflow: "hidden" }}>
          <SenseSurface
            width={cardW}
            height={cardH}
            radius={18}
            fullscreenUri={obs.uri}
            layersVisible={layersVisible}
            onToggleLayers={() => setLayersVisible((v) => !v)}
            photo={<SenseCanvas uri={obs.uri} width={cardW} height={cardH} layer={visualLayer} />}
            overlay={
              <>
                {reveal && overlay ? (
                  <Svg width={cardW} height={cardH} style={StyleSheet.absoluteFill}>
                    {overlay.figures.map((f) => f.poly ? (
                      <Polygon key={`fig${f.c.key}`} points={f.poly} fill="#7FC0FF" opacity={0.1} />
                    ) : null)}
                    {overlay.lines.map((l, i) => (
                      <Line key={`l${i}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#7FC0FF" strokeWidth={1.3} opacity={0.75} />
                    ))}
                    {overlay.stars.map((s, i) => (
                      <Circle key={`st${i}`} cx={s.x} cy={s.y} r={2.2} fill="#EAF2FF" />
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

                {reveal && overlay ? overlay.figures.map((f) => (
                  <Pressable key={`cn${f.c.key}`} testID={`obs-const-${f.c.key}`}
                    onPress={() => { Haptics.selectionAsync(); setConstSel(f.c); }}
                    style={[styles.constName, { left: f.cx - 70, top: Math.max(6, f.cy - 44) }]}>
                    <Text style={styles.constNameTxt}>{f.c.name}</Text>
                  </Pressable>
                )) : null}

                {activeData.size ? (
                  <View style={styles.dataOverlay} pointerEvents="none">
                    {dataLayers.filter((l) => activeData.has(l.key)).map((l) => (
                      <View key={l.key} style={styles.dataPill}>
                        <Text style={styles.dataPillEmoji}>{l.emoji}</Text>
                        <Text style={styles.dataPillText}>{l.current}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Elegant, slim watermark bar */}
                <View style={styles.watermark} pointerEvents="none">
                  <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFill} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wmBrand}>OverView <Text style={styles.wmDot}>•</Text> The Invisible Sense</Text>
                    <Text style={styles.wmMeta}>{observationCode(obs.seq)}{d.lat != null ? `  ·  ${nf(d.lat, 2)}°, ${nf(d.lon!, 2)}°` : ""}</Text>
                  </View>
                  {includeQr ? (
                    <View style={styles.qrBox}>
                      <QRCode value={qrValue} size={30} color="#0A0A0A" backgroundColor="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
              </>
            }
          />
        </ViewShot>

        <Text style={styles.gestureHint}>👆 Tap: mostra/nascondi i dati · 👆👆 Doppio tap: Pure Sense™ a schermo intero</Text>

        <View style={styles.layerHint}>
          {subject ? (
            <View style={styles.subjectBanner}>
              <Ionicons name="scan" size={13} color={colors.brand} />
              <Text style={styles.subjectText}>Soggetto rilevato: <Text style={{ color: colors.brand }}>{subject.label}</Text> · layer consigliati evidenziati</Text>
            </View>
          ) : null}
          <SenseLayerBar value={visualLayer} onChange={setVisualLayer} recommended={subject?.pixel} />
        </View>

        {/* Sky legend — editable: choose which objects are highlighted, toggle names */}
        {d ? (
          <SenseRecognized dd={d} camAz={camAz} camAlt={camAlt} cardW={cardW} cardH={cardH}
            hiddenObj={hiddenObj} canEdit legendOn={legendOn}
            onToggleObj={toggleObj} onToggleNames={() => { Haptics.selectionAsync(); setLegendOn((v) => !v); }} />
        ) : null}

        {dataLayers.length ? (
          <View style={styles.dataSection}>
            <Text style={styles.dataTitle}>SENSE LAYER · dati reali di questa scena · tocca per sovrapporli</Text>
            <View style={styles.dataChips}>
              {(showAll ? dataLayers : dataLayers.slice(0, 3)).map((l) => {
                const on = activeData.has(l.key);
                return (
                  <Pressable
                    key={l.key}
                    testID={`data-layer-${l.key}`}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setLayersVisible(true);
                      setActiveData((prev) => {
                        const next = new Set(prev);
                        if (next.has(l.key)) next.delete(l.key); else next.add(l.key);
                        return next;
                      });
                    }}
                    style={[styles.dataChip, on && styles.dataChipActive]}
                  >
                    <Text style={[styles.dataChipText, on && styles.dataChipTextActive]}>{l.emoji} {l.label}</Text>
                    <Text style={[styles.dataChipVal, on && { color: colors.onBrand }]}>{l.current}</Text>
                  </Pressable>
                );
              })}
            </View>
            {dataLayers.length > 3 ? (
              <Pressable testID="show-all-layers" style={styles.showAllBtn} onPress={() => { Haptics.selectionAsync(); setShowAll((s) => !s); }}>
                <Text style={styles.showAllText}>{showAll ? "Mostra meno" : `Mostra tutti i Sense Layer (${dataLayers.length})`}</Text>
                <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={14} color={colors.brand} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable testID="reveal-toggle" style={[styles.revealBtn, reveal && styles.revealActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLayersVisible(true); setReveal((r) => !r); }}>
            <Ionicons name={reveal ? "eye" : "eye-outline"} size={18} color={reveal ? colors.onBrand : colors.onSurface} />
            <Text style={[styles.revealText, reveal && { color: colors.onBrand }]}>What You Couldn&apos;t See</Text>
          </Pressable>
        </View>
        <View style={styles.qrToggleRow}>
          <View style={styles.qrToggleLeft}>
            <Ionicons name="qr-code-outline" size={16} color={colors.onSurfaceSecondary} />
            <Text style={styles.qrToggleText}>Includi QR code nel salvataggio</Text>
          </View>
          <Pressable testID="toggle-qr" onPress={() => { Haptics.selectionAsync(); setIncludeQr((v) => !v); }}
            style={[styles.qrSwitch, includeQr && styles.qrSwitchOn]}>
            <View style={[styles.qrKnob, includeQr && styles.qrKnobOn]} />
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Pressable testID="share-observation" style={styles.actBtn} onPress={share}>
            <Ionicons name="share-outline" size={18} color={colors.onSurface} />
            <Text style={styles.actText}>Condividi</Text>
          </Pressable>
          <Pressable testID="save-observation-photo" style={styles.actBtn} onPress={saveToPhotos}>
            <Ionicons name="download" size={18} color={colors.onSurface} />
            <Text style={styles.actText}>Salva in Foto</Text>
          </Pressable>
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Pressable testID="export-discovery-card" style={styles.exportBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExportStatus(null); setExportOpen(true); }}>
          <SenseMark size={20} />
          <Text style={styles.exportText}>Esporta Discovery Card</Text>
        </Pressable>

        {published ? (
          <Pressable testID="published-open-feed" style={styles.publishedBtn} onPress={() => router.push(`/observation-detail?id=${published}` as never)}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.publishedText}>Pubblicato · Apri</Text>
          </Pressable>
        ) : (
          <Pressable testID="publish-observation" style={[styles.publishBtn, publishing && { opacity: 0.6 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/publish-composer?id=${obs?.id}` as never); }} disabled={publishing}>
            {publishing ? <ActivityIndicator color={colors.onBrand} /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.onBrand} />
                <Text style={styles.publishText}>Pubblica questo SenseShot</Text>
              </>
            )}
          </Pressable>
        )}
        <Text style={styles.note}>⭐ Diventerà una Verified Observation quando altri osservatori confermeranno lo stesso fenomeno.</Text>
        <Text style={styles.note}>Solo i Sense catturati con l&apos;app possono essere pubblicati. Le immagini con contenuti di nudità o sessualmente espliciti non sono ammesse e vengono bloccate automaticamente.</Text>

        <Pressable testID="explain-observation" style={styles.explainBtn} onPress={explain} disabled={aiLoading}>
          {aiLoading ? <ActivityIndicator color={colors.brand} /> : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.brand} />
              <Text style={styles.explainText}>Explain this Observation</Text>
            </>
          )}
        </Pressable>
        {aiText ? (
          <View style={styles.aiCard}>
            <Text style={styles.aiText}>{aiText}</Text>
          </View>
        ) : null}

        {d.lat == null ? (
          <Text style={styles.note}>Posizione non disponibile allo scatto: impossibile ricostruire il cielo di quel momento.</Text>
        ) : null}

        {/* Scientific data */}
        <Text style={styles.sectionTitle}>Dati dell&apos;osservazione</Text>
        <View style={styles.dataCard}>
          <Row label="Data e ora" value={dateStr} />
          {d.senseLayer ? <Row label="Sense Layer" value={d.senseLayer} /> : null}
          {d.lat != null ? <Row label="Coordinate" value={`${nf(d.lat, 4)}°, ${nf(d.lon!, 4)}°`} /> : null}
          {d.altitude != null ? <Row label="Altitudine" value={`${nf(d.altitude, 0)} m`} /> : null}
          {d.cameraAz != null ? <Row label="Direzione fotocamera" value={`${compassPoint(d.cameraAz)} ${nf(d.cameraAz, 0)}° · elev ${nf(d.cameraAlt ?? 0, 0)}°`} /> : null}
          {d.sun ? <Row label="Sole" value={d.sun.alt > 0 ? `${nf(d.sun.alt, 0)}° sopra · ${compassPoint(d.sun.az)}` : "sotto l'orizzonte"} /> : null}
          {d.moon ? <Row label="Luna" value={`${d.moon.phase} · ${nf(d.moon.illum * 100, 0)}%`} /> : null}
          {d.planets && d.planets.length ? <Row label="Pianeti nel cielo" value={d.planets.map((p) => p.name).join(", ")} /> : null}
          {overlay?.inFrameConstellations?.length ? <Row label="Costellazioni nell'inquadratura" value={overlay.inFrameConstellations.join(", ")} /> : (d.constellations && d.constellations.length ? <Row label="Costellazioni nel cielo" value={d.constellations.join(", ")} /> : null)}
          {d.satellites && d.satellites.length ? <Row label="Satelliti sopra di te" value={`${d.satellites.length}`} /> : null}
          {d.iss ? <Row label="ISS" value={`visibile · ${nf(d.iss.alt, 0)}° ${compassPoint(d.iss.az)}`} /> : null}
          {d.galacticCenter ? <Row label="Centro Via Lattea" value={d.galacticCenter.alt > 0 ? `${nf(d.galacticCenter.alt, 0)}° ${compassPoint(d.galacticCenter.az)}` : "sotto l'orizzonte"} /> : null}
          {d.weather?.temp != null ? <Row label="Temperatura" value={`${nf(d.weather.temp, 1)} °C`} /> : null}
          {d.weather?.pressure != null ? <Row label="Pressione" value={`${nf(d.weather.pressure, 0)} hPa`} /> : null}
          {d.spaceWeather?.kp != null ? <Row label="Meteo spaziale" value={`Kp ${nf(d.spaceWeather.kp, 1)} · ${d.spaceWeather.level ?? ""}`} /> : null}
          {d.spaceWeather?.solarWind != null ? <Row label="Vento solare" value={`${nf(d.spaceWeather.solarWind, 0)} km/s`} /> : null}
        </View>
        <Text style={styles.note}>Ogni valore è stato registrato al momento dello scatto. Il cielo (Sole, Luna, pianeti, costellazioni) viene ricalcolato; satelliti e ISS provengono dall&apos;istantanea reale salvata.</Text>
      </ScrollView>

      {/* Publish choice — same SenseShot, published in different ways */}
      <Modal visible={pubOpen} animationType="slide" transparent onRequestClose={() => setPubOpen(false)}>
        <Pressable style={styles.pubScrim} onPress={() => setPubOpen(false)}>
          <Pressable style={[styles.pubSheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={styles.menuHandle} />
            <Text style={styles.pubTitle}>Pubblica questo SenseShot</Text>
            <Text style={styles.pubHint}>Lo stesso scatto, condiviso come preferisci.</Text>

            {obs?.data?.lat != null ? (
              <ScrollView style={styles.pubGeoScroll} showsVerticalScrollIndicator={false}>
                <GeoPrivacyPicker value={geoPrec} onChange={setGeoPrec} suggested={geoSuggest} reason={geoReason} />
              </ScrollView>
            ) : null}

            <View style={styles.pubItem}>
              <View style={styles.pubIcon}><Ionicons name="images" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <BrandName name="SnapSense" style={styles.pubItemTitle} />
                <Text style={styles.pubItemSub}>Già salvato nella tua Galleria.</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            </View>

            <Pressable testID="publish-observe" style={styles.pubItem} onPress={() => publish(false)} disabled={publishing}>
              <View style={styles.pubIcon}><Ionicons name="globe" size={20} color={colors.blue} /></View>
              <View style={{ flex: 1 }}>
                <BrandName name="Observe" style={styles.pubItemTitle} />
                <Text style={styles.pubItemSub}>Nel feed della community.</Text>
              </View>
              {publishing ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
            </Pressable>

            <Pressable testID="publish-pulse" style={styles.pubItem} onPress={() => publish(true)} disabled={publishing}>
              <View style={styles.pubIcon}><Ionicons name="flash" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <BrandName name="Pulse" style={styles.pubItemTitle} />
                <Text style={styles.pubItemSub}>{obs?.data?.pulse ? `Sfida: ${obs.data.pulse.title}` : "Come risposta alla Pulse di oggi."}</Text>
              </View>
              {publishing ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={exportOpen} animationType="slide" transparent onRequestClose={() => setExportOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg, paddingTop: insets.top + spacing.md }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Discovery Card</Text>
              <Pressable testID="export-close" hitSlop={12} onPress={() => setExportOpen(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>

            <View style={styles.formatRow}>
              {(["square", "story"] as CardFormat[]).map((f) => (
                <Pressable key={f} testID={`format-${f}`} onPress={() => { Haptics.selectionAsync(); setExportFormat(f); }}
                  style={[styles.formatChip, exportFormat === f && styles.formatChipActive]}>
                  <Ionicons name={f === "square" ? "square-outline" : "phone-portrait-outline"} size={15} color={exportFormat === f ? colors.onBrand : colors.onSurface} />
                  <Text style={[styles.formatText, exportFormat === f && { color: colors.onBrand }]}>{f === "square" ? "Quadrato 1:1" : "Story 9:16"}</Text>
                </Pressable>
              ))}
            </View>

            <ScrollView contentContainerStyle={styles.previewWrap} showsVerticalScrollIndicator={false}>
              <View style={{ width: "100%", marginBottom: spacing.md }}>
                <SenseLayerBar value={visualLayer} onChange={setVisualLayer} compact />
              </View>
              <ViewShot ref={cardRef}>
                <DiscoveryCard obs={obs} publishedId={published} visualLayer={visualLayer} showQr={includeQr}
                  format={exportFormat} width={exportFormat === "square" ? width - spacing.lg * 2 : (width - spacing.lg * 2) * 0.62} />
              </ViewShot>
            </ScrollView>

            <Pressable testID="toggle-qr-export" onPress={() => { Haptics.selectionAsync(); setIncludeQr((v) => !v); }} style={styles.qrToggleRow}>
              <View style={styles.qrToggleLeft}>
                <Ionicons name="qr-code-outline" size={16} color={colors.onSurfaceSecondary} />
                <Text style={styles.qrToggleText}>Includi QR code</Text>
              </View>
              <View style={[styles.qrSwitch, includeQr && styles.qrSwitchOn]}>
                <View style={[styles.qrKnob, includeQr && styles.qrKnobOn]} />
              </View>
            </Pressable>

            {exportStatus ? <Text style={styles.status}>{exportStatus}</Text> : null}
            <View style={styles.actions}>
              <Pressable testID="export-share" style={styles.exportBtn} onPress={exportCardShare}>
                <Ionicons name="share-outline" size={18} color={colors.onBrand} />
                <Text style={styles.exportText}>Condividi</Text>
              </Pressable>
              <Pressable testID="export-save" style={styles.actBtn} onPress={exportCardSave}>
                <Ionicons name="download" size={18} color={colors.onSurface} />
                <Text style={styles.actText}>Salva</Text>
              </Pressable>
            </View>
            {!published ? <Text style={styles.note}>Suggerimento: pubblica l&apos;Observation per far puntare il QR direttamente alla tua scoperta.</Text> : null}
          </View>
        </View>
      </Modal>
      {constSel ? <ConstellationSheet c={constSel} onClose={() => setConstSel(null)} /> : null}
    </SpaceBackground>
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
  senseHero: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  senseHeroText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1 },
  layerHint: { marginTop: spacing.xs, gap: spacing.sm },
  legendCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm, marginTop: spacing.sm },
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
  pubScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  pubSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pubGeoScroll: { maxHeight: 320, marginVertical: spacing.sm },
  menuHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  pubTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  pubHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2, marginBottom: spacing.sm },
  pubItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pubIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary },
  pubItemTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  pubItemSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  layerHintText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2, letterSpacing: 0.8 },
  layerRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  layerChip: { backgroundColor: colors.tertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  layerChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  layerChipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  layerChipTextActive: { color: colors.onBrand },
  watermark: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 8 },
  wmBrand: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 0.3 },
  wmDot: { color: colors.brand },
  wmMeta: { color: "rgba(255,255,255,0.75)", fontFamily: fonts.mono, fontSize: type.sm - 3, marginTop: 1 },
  qrBox: { padding: 2, backgroundColor: "#fff", borderRadius: 5 },
  gestureHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center", opacity: 0.65, marginTop: -spacing.xs },
  actions: { flexDirection: "row", gap: spacing.md },
  revealBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: 16, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  revealActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  revealText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: 16, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  qrToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginBottom: spacing.xs },
  qrToggleLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  qrToggleText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  qrSwitch: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 3, justifyContent: "center" },
  qrSwitchOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  qrKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.onSurfaceSecondary },
  qrKnobOn: { backgroundColor: colors.onBrand, alignSelf: "flex-end" },
  status: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base, textAlign: "center" },
  dataOverlay: { position: "absolute", top: 12, left: 12, gap: 6, maxWidth: "72%" },
  constName: { position: "absolute", width: 140, alignItems: "center", backgroundColor: "rgba(10,12,18,0.6)", borderRadius: 999, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,192,255,0.5)" },
  constNameTxt: { color: "#EAF4FF", fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 0.8 },
  subjectBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  subjectText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  dataPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(10,12,16,0.44)", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.55)", borderLeftWidth: 2, borderLeftColor: colors.brand },
  dataPillEmoji: { fontSize: 12 },
  dataPillText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1, letterSpacing: 0.2 },
  dataSection: { gap: spacing.sm },
  showAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: spacing.sm },
  showAllText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  dataTitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2, letterSpacing: 0.8 },
  dataChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  dataChip: { backgroundColor: colors.tertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dataChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dataChipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  dataChipTextActive: { color: colors.onBrand },
  dataChipVal: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2, marginTop: 1 },
  exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 16, paddingVertical: spacing.md },
  exportText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, gap: spacing.md, maxHeight: "94%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  formatRow: { flexDirection: "row", gap: spacing.sm },
  formatChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: 999, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  formatChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  formatText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  previewWrap: { alignItems: "center", paddingVertical: spacing.md },
  publishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 16, paddingVertical: spacing.lg },
  publishText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  publishedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: 16, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.success },
  publishedText: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base },
  explainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: 16, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  explainText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  aiCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  aiText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginTop: spacing.md },
  dataCard: { backgroundColor: colors.surfaceTertiary, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  rowValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flexShrink: 1, textAlign: "right" },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.6 },
});
