import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useWindowDimensions } from "react-native";
import ViewShot from "react-native-view-shot";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { FOV_H } from "@/src/lib/project";
import { buildOverlay } from "@/src/lib/senseFrame";
import { SenseSkyOverlay } from "@/src/components/SenseSkyOverlay";
import { SenseGeoOverlay } from "@/src/components/SenseGeoOverlay";
import { SenseRecognized } from "@/src/components/SenseRecognized";
import { SenseSurface } from "@/src/components/SenseSurface";
import { SenseMark } from "@/src/components/SenseMark";
import { SenseCanvas, layerToVisual, SenseVisualLayer } from "@/src/components/SenseCanvas";
import { SenseLayerBar } from "@/src/components/SenseLayerBar";
import { ConstellationSheet } from "@/src/components/ConstellationSheet";
import type { Constellation } from "@/src/lib/constellations";
import { availableDataLayers, orderedDataLayers, recommendedFor } from "@/src/lib/senseLayers";
import { nf, compassPoint } from "@/src/lib/format";
import { aiApi } from "@/src/lib/backend";
import type { ObsData } from "@/src/lib/gallery";

export interface SenseDisplayConfig {
  legendHidden: string[];
  legendOn: boolean;
  senseLayers: string[];
  reveal: boolean;
}

export interface SenseActionHelpers {
  visualLayer: SenseVisualLayer;
  includeQr: boolean;
  setIncludeQr: (v: boolean) => void;
  config: SenseDisplayConfig;
}

interface Props {
  uri: string;
  data: ObsData;
  code: string;
  dateStr: string;
  animKey: string;
  qrValue: string;
  /** Author can edit the display config (persisted via onPersistConfig). */
  canEdit?: boolean;
  /** Seed the initial display config (owner's saved config on Observe). */
  seed?: Partial<SenseDisplayConfig>;
  /** Persist config changes (gallery → local, observe → server). */
  onPersistConfig?: (cfg: SenseDisplayConfig) => void;
  /** ViewShot ref around the image surface (gallery capture / share / save). */
  shotRef?: React.RefObject<ViewShot | null>;
  /** Author row rendered under the hero (Observe). */
  headerSlot?: React.ReactNode;
  /** Primary actions — differ between Gallery (personal) and Observe (social). */
  renderActions?: (h: SenseActionHelpers) => React.ReactNode;
  /** Extra content after the data card (Observe: score / chain / comments). */
  belowData?: React.ReactNode;
  /** Whether to render the elegant watermark bar on the image. */
  showHero?: boolean;
}

export function SenseDetail({
  uri, data: d, code, dateStr, animKey, qrValue,
  canEdit = false, seed, onPersistConfig, shotRef,
  headerSlot, renderActions, belowData, showHero = true,
}: Props) {
  const { width } = useWindowDimensions();
  const [reveal, setReveal] = useState(seed?.reveal !== false);
  const [visualLayer, setVisualLayer] = useState<SenseVisualLayer>(layerToVisual(d.senseLayer));
  const [activeData, setActiveData] = useState<Set<string>>(new Set(seed?.senseLayers ?? d.senseLayers ?? []));
  const [hiddenObj, setHiddenObj] = useState<Set<string>>(new Set(seed?.legendHidden ?? d.legendHidden ?? []));
  const [legendOn, setLegendOn] = useState((seed?.legendOn ?? d.legendOn) !== false);
  const [showAll, setShowAll] = useState(false);
  const [layersVisible, setLayersVisible] = useState(true);
  const [includeQr, setIncludeQr] = useState(false);
  const [subject, setSubject] = useState<{ label: string; pixel: SenseVisualLayer[]; data: string[] } | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [constSel, setConstSel] = useState<Constellation | null>(null);

  const cardW = width - spacing.lg * 2;
  const cardH = cardW * 1.25;
  const camAz = d.cameraAz ?? 0;
  const camAlt = d.cameraAlt ?? 0;
  const zoom = d.zoom ?? 1;

  const overlay = useMemo(() => {
    if (!d) return null;
    return buildOverlay(d, camAz, camAlt, cardW, cardH, FOV_H / Math.max(1, zoom));
  }, [d, camAz, camAlt, cardW, cardH, zoom]);

  const dataLayers = orderedDataLayers(d, subject?.data);

  const persist = (over: Partial<SenseDisplayConfig>) => {
    if (!canEdit || !onPersistConfig) return;
    onPersistConfig({
      legendHidden: Array.from(hiddenObj),
      legendOn, senseLayers: Array.from(activeData), reveal, ...over,
    });
  };

  const toggleObj = (name: string) => {
    Haptics.selectionAsync();
    setHiddenObj((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      persist({ legendHidden: Array.from(next) });
      return next;
    });
  };
  const toggleNames = () => {
    Haptics.selectionAsync();
    setLegendOn((v) => { const nv = !v; persist({ legendOn: nv }); return nv; });
  };
  const toggleReveal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLayersVisible(true);
    setReveal((r) => { const nr = !r; persist({ reveal: nr }); return nr; });
  };
  const toggleLayer = (key: string) => {
    Haptics.selectionAsync();
    setLayersVisible(true);
    setActiveData((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      persist({ senseLayers: Array.from(next) });
      return next;
    });
  };
  const allOn = dataLayers.length > 0 && dataLayers.every((l) => activeData.has(l.key));
  const toggleAllLayers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLayersVisible(true);
    setActiveData(() => {
      const next = allOn ? new Set<string>() : new Set(dataLayers.map((l) => l.key));
      persist({ senseLayers: Array.from(next) });
      return next;
    });
  };

  // AI recognises the framed subject to SUGGEST layers (file:// only). If nothing
  // was pre-selected, auto-activate the first recommended available layers.
  useEffect(() => {
    if (!uri || subject || !uri.startsWith("file")) return;
    let alive = true;
    (async () => {
      try {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const r = await aiApi.recognizeSubject(b64);
        if (!alive) return;
        const rec = recommendedFor(r.subject);
        setSubject({ label: r.label_it || rec.label, pixel: rec.pixel, data: rec.data });
        if ((seed?.senseLayers ?? d.senseLayers ?? []).length === 0) {
          const avail = new Set(availableDataLayers(d).map((l) => l.key));
          setActiveData(new Set(rec.data.filter((k) => avail.has(k)).slice(0, 3)));
        }
      } catch { /* best-effort */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const explain = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiLoading(true);
    const fields: { label: string; value: string }[] = [];
    fields.push({ label: "Layer visivo attivo", value: `${visualLayer} (rimappa reale dei pixel)` });
    if (d.senseLayer) fields.push({ label: "Sense Layer alla cattura", value: d.senseLayer });
    for (const l of availableDataLayers(d)) fields.push({ label: l.label, value: l.current });
    if (d.sun) fields.push({ label: "Sole", value: d.sun.alt > 0 ? `${nf(d.sun.alt, 0)}° sopra l'orizzonte` : "sotto l'orizzonte" });
    if (d.moon) fields.push({ label: "Luna", value: `${d.moon.phase}, ${nf(d.moon.illum * 100, 0)}%` });
    if (d.lat != null) fields.push({ label: "Coordinate", value: `${nf(d.lat, 3)}°, ${nf(d.lon ?? 0, 3)}°` });
    try { const r = await aiApi.explainVisualization(fields); setAiText(r.text); }
    catch { setAiText(null); } finally { setAiLoading(false); }
  };
  useEffect(() => {
    if (aiText || aiLoading) return;
    if (d.aiNote) { setAiText(d.aiNote); return; }
    explain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  return (
    <>
      {showHero ? (
        <View style={styles.senseHero}>
          <SenseMark size={22} />
          <Text style={styles.senseHeroText}>SENSE CREATED · The Invisible Sense</Text>
        </View>
      ) : null}

      {headerSlot}

      <ViewShot ref={shotRef} style={{ width: cardW, height: cardH, alignSelf: "center", borderRadius: 18, overflow: "hidden" }}>
        <SenseSurface
          width={cardW} height={cardH} radius={18}
          fullscreenUri={uri}
          layersVisible={layersVisible}
          onToggleLayers={() => setLayersVisible((v) => !v)}
          photo={<SenseCanvas uri={uri} width={cardW} height={cardH} layer={visualLayer} />}
          overlay={
            <>
              {reveal && overlay ? (
                <SenseSkyOverlay data={overlay} w={cardW} h={cardH} legendOn={legendOn} hiddenObj={hiddenObj} animate animKey={animKey} />
              ) : null}
              {reveal && d.places?.length ? (
                <SenseGeoOverlay places={d.places} camAz={camAz} camAlt={camAlt} w={cardW} h={cardH} fovH={FOV_H / Math.max(1, zoom)} legendOn={legendOn} hiddenObj={hiddenObj} animate animKey={animKey} />
              ) : null}
              {reveal && legendOn && overlay ? overlay.figures.map((f) => (
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
              <View style={styles.watermark} pointerEvents="none">
                <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.wmBrand}>OverView <Text style={styles.wmDot}>•</Text> The Invisible Sense</Text>
                  <Text style={styles.wmMeta}>{code}{d.lat != null ? `  ·  ${nf(d.lat, 2)}°, ${nf(d.lon!, 2)}°` : ""}</Text>
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

      <SenseRecognized dd={d} camAz={camAz} camAlt={camAlt} cardW={cardW} cardH={cardH} zoom={zoom}
        hiddenObj={hiddenObj} canEdit={canEdit} legendOn={legendOn} overlayOn={reveal}
        onToggleOverlay={toggleReveal} onToggleObj={toggleObj} onToggleNames={toggleNames} />

      {dataLayers.length ? (
        <View style={styles.dataSection}>
          <View style={styles.dataHead}>
            <Text style={styles.dataTitle}>SENSE LAYER · dati reali di questa scena · tocca per sovrapporli</Text>
            <Pressable testID="toggle-all-layers" style={[styles.masterBtn, allOn && styles.masterBtnOn]} onPress={toggleAllLayers}>
              <Ionicons name={allOn ? "eye" : "eye-off"} size={13} color={allOn ? colors.onBrand : colors.brand} />
              <Text style={[styles.masterText, allOn && { color: colors.onBrand }]}>{allOn ? "Nascondi tutti" : "Mostra tutti"}</Text>
            </Pressable>
          </View>
          <View style={styles.dataChips}>
            {(showAll ? dataLayers : dataLayers.slice(0, 3)).map((l) => {
              const on = activeData.has(l.key);
              return (
                <Pressable key={l.key} testID={`data-layer-${l.key}`} onPress={() => toggleLayer(l.key)}
                  style={[styles.dataChip, on && styles.dataChipActive]}>
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

      {renderActions ? renderActions({ visualLayer, includeQr, setIncludeQr, config: { legendHidden: Array.from(hiddenObj), legendOn, senseLayers: Array.from(activeData), reveal } }) : null}

      <Pressable testID="explain-observation" style={styles.explainBtn} onPress={explain} disabled={aiLoading}>
        {aiLoading ? <Ionicons name="hourglass" size={18} color={colors.brand} /> : (
          <>
            <Ionicons name="sparkles" size={18} color={colors.brand} />
            <Text style={styles.explainText}>Explain this Observation</Text>
          </>
        )}
      </Pressable>
      {aiText ? <View style={styles.aiCard}><Text style={styles.aiText}>{aiText}</Text></View> : null}

      {d.lat == null ? (
        <Text style={styles.note}>Posizione non disponibile allo scatto: impossibile ricostruire il cielo di quel momento.</Text>
      ) : null}

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

      {belowData}

      {constSel ? <ConstellationSheet c={constSel} onClose={() => setConstSel(null)} /> : null}
    </>
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
  senseHero: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center", backgroundColor: colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  senseHeroText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1 },
  layerHint: { marginTop: spacing.xs, gap: spacing.sm },
  watermark: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 8 },
  wmBrand: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 0.3 },
  wmDot: { color: colors.brand },
  wmMeta: { color: "rgba(255,255,255,0.75)", fontFamily: fonts.mono, fontSize: type.sm - 3, marginTop: 1 },
  qrBox: { padding: 2, backgroundColor: "#fff", borderRadius: 5 },
  gestureHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center", opacity: 0.65, marginTop: -spacing.xs },
  dataOverlay: { position: "absolute", top: 12, left: 12, gap: 6, maxWidth: "72%" },
  constName: { position: "absolute", width: 140, alignItems: "center", backgroundColor: "rgba(10,12,18,0.6)", borderRadius: 999, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,192,255,0.5)" },
  constNameTxt: { color: "#EAF4FF", fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 0.8 },
  subjectBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  subjectText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  dataPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(10,12,16,0.44)", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.55)", borderLeftWidth: 2, borderLeftColor: colors.brand },
  dataPillEmoji: { fontSize: 12 },
  dataPillText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1, letterSpacing: 0.2 },
  dataSection: { gap: spacing.sm },
  dataHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  masterBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 5, borderWidth: 1, borderColor: colors.brand },
  masterBtnOn: { backgroundColor: colors.brand },
  masterText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2 },
  showAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: spacing.sm },
  showAllText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  dataTitle: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2, letterSpacing: 0.8 },
  dataChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  dataChip: { backgroundColor: colors.tertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dataChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dataChipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  dataChipTextActive: { color: colors.onBrand },
  dataChipVal: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2, marginTop: 1 },
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
