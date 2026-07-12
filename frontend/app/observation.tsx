import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
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
import { colors, fonts, spacing, type } from "@/src/theme";
import { getObservation, observationCode, Observation, ObsPoint } from "@/src/lib/gallery";
import { CONSTELLATION_LINES } from "@/src/lib/stars";
import { project } from "@/src/lib/project";
import { nf, compassPoint } from "@/src/lib/format";
import { socialApi, aiApi } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";

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
  const shotRef = useRef<ViewShot>(null);

  useEffect(() => { if (id) getObservation(id).then(setObs); }, [id]);

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
    } catch {
      setStatus("Pubblicazione non riuscita");
    } finally { setPublishing(false); }
  };

  const explain = async () => {
    if (!obs?.data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiLoading(true);
    const d = obs.data;
    const facts: string[] = [];
    if (d.lat != null) facts.push(`Coordinate: ${nf(d.lat, 3)}°, ${nf(d.lon ?? 0, 3)}°.`);
    if (d.cameraAz != null) facts.push(`Direzione fotocamera: ${compassPoint(d.cameraAz)} ${nf(d.cameraAz, 0)}°, elevazione ${nf(d.cameraAlt ?? 0, 0)}°.`);
    if (d.sun) facts.push(`Sole: ${d.sun.alt > 0 ? `${nf(d.sun.alt, 0)}° sopra l'orizzonte` : "sotto l'orizzonte"}, ${compassPoint(d.sun.az)}.`);
    if (d.moon) facts.push(`Luna: ${d.moon.phase}, illuminazione ${nf(d.moon.illum * 100, 0)}%.`);
    if (d.planets?.length) facts.push(`Pianeti presenti: ${d.planets.map((p) => p.name).join(", ")}.`);
    if (d.constellations?.length) facts.push(`Costellazioni: ${d.constellations.join(", ")}.`);
    if (d.iss) facts.push(`ISS visibile a ${nf(d.iss.alt, 0)}° verso ${compassPoint(d.iss.az)}.`);
    if (d.satellites?.length) facts.push(`Satelliti sopra l'osservatore: ${d.satellites.length}.`);
    if (d.spaceWeather?.kp != null) facts.push(`Meteo spaziale: Kp ${nf(d.spaceWeather.kp, 1)}${d.spaceWeather.level ? ` (${d.spaceWeather.level})` : ""}.`);
    if (d.weather?.temp != null) facts.push(`Temperatura: ${nf(d.weather.temp, 1)} °C.`);
    try {
      const r = await aiApi.explainOpportunity("Osservazione della realtà invisibile", facts, "observation");
      setAiText(r.text);
    } catch { setAiText(null); } finally { setAiLoading(false); }
  };

  if (!obs || !d) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }

  const dateStr = new Date(d.ts).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const qrValue = `frontend://observation?id=${obs.id}`;

  return (
    <SpaceBackground>
      <ScreenHeader title={observationCode(obs.seq)} subtitle={dateStr} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false} testID="observation-view">

        <ViewShot ref={shotRef} style={{ width: cardW, height: cardH, alignSelf: "center", borderRadius: 18, overflow: "hidden" }}>
          <Image source={{ uri: obs.uri }} style={{ width: cardW, height: cardH }} contentFit="cover" />

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

        {published ? (
          <Pressable testID="published-open-feed" style={styles.publishedBtn} onPress={() => router.push(`/observation-detail?id=${published}` as never)}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.publishedText}>Pubblicata nel feed mondiale · Apri</Text>
          </Pressable>
        ) : (
          <Pressable testID="publish-observation" style={[styles.publishBtn, publishing && { opacity: 0.6 }]} onPress={publish} disabled={publishing}>
            {publishing ? <ActivityIndicator color={colors.onBrand} /> : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.onBrand} />
                <Text style={styles.publishText}>Pubblica nel feed</Text>
              </>
            )}
          </Pressable>
        )}

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
