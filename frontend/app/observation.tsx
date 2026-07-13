import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Line, Circle, Rect as SvgRect, Text as SvgText, G } from "react-native-svg";
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
import { CONSTELLATION_LINES } from "@/src/lib/stars";
import { project } from "@/src/lib/project";
import { nf, compassPoint } from "@/src/lib/format";
import { socialApi, aiApi } from "@/src/lib/backend";
import { ApiError } from "@/src/lib/client";
import { useAuth } from "@/src/context/AuthContext";
import { SenseCanvas, layerToVisual, SenseVisualLayer } from "@/src/components/SenseCanvas";
import { SenseLayerBar } from "@/src/components/SenseLayerBar";
import { availableDataLayers } from "@/src/lib/senseLayers";
import { SenseMark } from "@/src/components/SenseMark";
import { DiscoveryCard, CardFormat } from "@/src/components/DiscoveryCard";

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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<CardFormat>("square");
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const shotRef = useRef<ViewShot>(null);
  const cardRef = useRef<ViewShot>(null);

  useEffect(() => { if (id) getObservation(id).then(setObs); }, [id]);
  useEffect(() => { if (obs?.data) setVisualLayer(layerToVisual(obs.data.senseLayer)); }, [obs]);

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
      (arr ?? []).map((o) => ({ ...o, pt: p(o.az, o.alt) })).filter((o) => o.pt) as (ObsPoint & { pt: { x: number; y: number } })[];
    return {
      stars: Array.from(starPts.values()),
      lines,
      planets: mk(d.planets),
      satellites: mk(d.satellites),
      iss: d.iss ? { ...d.iss, pt: p(d.iss.az, d.iss.alt) } : null,
      sun: d.sun ? p(d.sun.az, d.sun.alt) : null,
      moon: d.moon ? p(d.moon.az, d.moon.alt) : null,
      gc: d.galacticCenter ? p(d.galacticCenter.az, d.galacticCenter.alt) : null,
    };
  }, [d, camAz, camAlt, cardW, cardH]);

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

  const publish = async () => {
    if (!obs || !obs.data) return;
    if (!user) { router.push("/login" as never); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPublishing(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        obs.uri, [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const created = await socialApi.createObservation({
        media_type: "image", source: "reality",
        caption: "", image_base64: manipulated.base64 ?? undefined, data: obs.data,
      });
      setPublished(created.id);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 422
        ? e.message
        : "Pubblicazione non riuscita";
      setStatus(msg);
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
    if (obs?.data && !aiText && !aiLoading) { explain(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs?.id]);

  if (!obs || !d) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }

  const dateStr = new Date(d.ts).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const qrValue = `frontend://observation?id=${obs.id}`;
  const dataLayers = availableDataLayers(d);

  return (
    <SpaceBackground>
      <ScreenHeader title={observationCode(obs.seq)} subtitle={dateStr} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false} testID="observation-view">

        <View style={styles.senseHero}>
          <SenseMark size={22} />
          <Text style={styles.senseHeroText}>SENSE CREATED · The Invisible Sense</Text>
        </View>

        <ViewShot ref={shotRef} style={{ width: cardW, height: cardH, alignSelf: "center", borderRadius: 18, overflow: "hidden" }}>
          <SenseCanvas uri={obs.uri} width={cardW} height={cardH} layer={visualLayer} />

          {reveal && overlay ? (
            <Svg width={cardW} height={cardH} style={StyleSheet.absoluteFill}>
              {overlay.lines.map((l, i) => (
                <Line key={`l${i}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#5AB0FF" strokeWidth={1.2} opacity={0.7} />
              ))}
              {overlay.stars.map((s, i) => (
                <Circle key={`st${i}`} cx={s.x} cy={s.y} r={2.2} fill="#EAF2FF" />
              ))}
              {overlay.planets.map((pl, i) => (
                <G key={`pl${i}`}>
                  <Circle cx={pl.pt.x} cy={pl.pt.y} r={5} fill="#D4AF37" />
                  <SvgText x={pl.pt.x + 8} y={pl.pt.y + 4} fill="#D4AF37" fontSize={11} fontWeight="600">{pl.name}</SvgText>
                </G>
              ))}
              {overlay.satellites.map((s, i) => (
                <G key={`sat${i}`}>
                  <SvgRect x={s.pt.x - 3} y={s.pt.y - 3} width={6} height={6} fill="#0A84FF" />
                  <SvgText x={s.pt.x + 7} y={s.pt.y + 3} fill="#8FD0FF" fontSize={9}>{s.name}</SvgText>
                </G>
              ))}
              {overlay.iss?.pt ? (
                <G>
                  <Circle cx={overlay.iss.pt.x} cy={overlay.iss.pt.y} r={6} fill="none" stroke="#D4AF37" strokeWidth={2} />
                  <SvgText x={overlay.iss.pt.x + 9} y={overlay.iss.pt.y + 4} fill="#D4AF37" fontSize={11} fontWeight="700">ISS</SvgText>
                </G>
              ) : null}
              {overlay.moon ? <SvgText x={overlay.moon.x} y={overlay.moon.y} fill="#fff" fontSize={16}>☾</SvgText> : null}
              {overlay.gc ? <SvgText x={overlay.gc.x - 20} y={overlay.gc.y} fill="#F0C674" fontSize={10}>◄ Via Lattea</SvgText> : null}
            </Svg>
          ) : null}

          {activeData.size ? (
            <View style={styles.dataOverlay} pointerEvents="none">
              {dataLayers.filter((l) => activeData.has(l.key)).map((l) => (
                <View key={l.key} style={styles.dataPill}>
                  <Text style={styles.dataPillText}>{l.emoji} {l.current}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Elegant watermark bar */}
          <View style={styles.watermark}>
            <View style={{ flex: 1 }}>
              <Text style={styles.wmBrand}>Overview <Text style={styles.wmDot}>•</Text> The Invisible Sense</Text>
              <Text style={styles.wmMeta}>{observationCode(obs.seq)}  ·  {dateStr}{d.lat != null ? `  ·  ${nf(d.lat, 2)}°, ${nf(d.lon!, 2)}°` : ""}</Text>
            </View>
            <View style={styles.qrBox}>
              <QRCode value={qrValue} size={44} color="#0A0A0A" backgroundColor="#FFFFFF" />
            </View>
          </View>
        </ViewShot>

        <View style={styles.layerHint}>
          <SenseLayerBar value={visualLayer} onChange={setVisualLayer} />
        </View>

        {dataLayers.length ? (
          <View style={styles.dataSection}>
            <Text style={styles.dataTitle}>DATI REALI RILEVATI · tocca per sovrapporli</Text>
            <View style={styles.dataChips}>
              {dataLayers.map((l) => {
                const on = activeData.has(l.key);
                return (
                  <Pressable
                    key={l.key}
                    testID={`data-layer-${l.key}`}
                    onPress={() => {
                      Haptics.selectionAsync();
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
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable testID="reveal-toggle" style={[styles.revealBtn, reveal && styles.revealActive]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReveal((r) => !r); }}>
            <Ionicons name={reveal ? "eye" : "eye-outline"} size={18} color={reveal ? colors.onBrand : colors.onSurface} />
            <Text style={[styles.revealText, reveal && { color: colors.onBrand }]}>What You Couldn&apos;t See</Text>
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
            <Text style={styles.publishedText}>Sense pubblicato come Observation · Apri</Text>
          </Pressable>
        ) : (
          <Pressable testID="publish-observation" style={[styles.publishBtn, publishing && { opacity: 0.6 }]} onPress={publish} disabled={publishing}>
            {publishing ? <ActivityIndicator color={colors.onBrand} /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.onBrand} />
                <Text style={styles.publishText}>Pubblica come Observation</Text>
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
          {d.planets && d.planets.length ? <Row label="Pianeti visibili" value={d.planets.map((p) => p.name).join(", ")} /> : null}
          {d.constellations && d.constellations.length ? <Row label="Costellazioni" value={d.constellations.join(", ")} /> : null}
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
                  <Text style={[styles.formatText, exportFormat === f && { color: colors.onBrand }]}>{f === "square" ? "Post 1:1" : "Story 9:16"}</Text>
                </Pressable>
              ))}
            </View>

            <ScrollView contentContainerStyle={styles.previewWrap} showsVerticalScrollIndicator={false}>
              <View style={{ width: "100%", marginBottom: spacing.md }}>
                <SenseLayerBar value={visualLayer} onChange={setVisualLayer} compact />
              </View>
              <ViewShot ref={cardRef}>
                <DiscoveryCard obs={obs} publishedId={published} visualLayer={visualLayer}
                  format={exportFormat} width={exportFormat === "square" ? width - spacing.lg * 2 : (width - spacing.lg * 2) * 0.62} />
              </ViewShot>
            </ScrollView>

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
  layerHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  layerHintText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2, letterSpacing: 0.8 },
  layerRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  layerChip: { backgroundColor: colors.tertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  layerChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  layerChipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  layerChipTextActive: { color: colors.onBrand },
  watermark: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: "rgba(0,0,0,0.42)" },
  wmBrand: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base, letterSpacing: 0.3 },
  wmDot: { color: colors.brand },
  wmMeta: { color: "rgba(255,255,255,0.75)", fontFamily: fonts.mono, fontSize: type.sm - 3, marginTop: 2 },
  qrBox: { padding: 3, backgroundColor: "#fff", borderRadius: 6 },
  actions: { flexDirection: "row", gap: spacing.md },
  revealBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: 16, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  revealActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  revealText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: 16, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  status: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base, textAlign: "center" },
  dataOverlay: { position: "absolute", top: 10, left: 10, gap: 5, maxWidth: "70%" },
  dataPill: { alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.6)" },
  dataPillText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 1 },
  dataSection: { gap: spacing.sm },
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
