import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import Animated, { FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useObserver } from "@/src/hooks/useObserver";
import { useAuth } from "@/src/context/AuthContext";
import { GIBS_LAYERS, gibsSnapshotUrl, defaultImageryDate } from "@/src/lib/satelliteImagery";
import { aiApi, socialApi } from "@/src/lib/backend";
import { nf } from "@/src/lib/format";

const COMPARE_PRESETS = [
  { label: "1 mese fa", days: 30 },
  { label: "6 mesi fa", days: 182 },
  { label: "1 anno fa", days: 365 },
];

export default function SatelliteObserve() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const obs = useObserver();
  const { user } = useAuth();
  const [layerIdx, setLayerIdx] = useState(0);
  const nowDate = defaultImageryDate(3);
  const [compareDays, setCompareDays] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<{ observe: string; explanations: string; cannot: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  const layer = GIBS_LAYERS[layerIdx];
  const hasLoc = obs.status === "granted";
  const lat = hasLoc ? obs.lat : 41.9;
  const lon = hasLoc ? obs.lon : 12.5;

  const compareDate = useMemo(() => {
    if (compareDays == null) return null;
    const d = new Date(nowDate); d.setDate(d.getDate() - compareDays);
    return d.toISOString().slice(0, 10);
  }, [compareDays, nowDate]);

  const nowUrl = useMemo(() => gibsSnapshotUrl(lat, lon, nowDate, layer.id), [lat, lon, nowDate, layer.id]);
  const thenUrl = useMemo(() => (compareDate ? gibsSnapshotUrl(lat, lon, compareDate, layer.id) : null), [lat, lon, compareDate, layer.id]);

  const locLabel = `${nf(lat, 2)}°, ${nf(lon, 2)}°`;

  const analyze = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiLoading(true);
    try {
      const r = await aiApi.analyzeSatellite({
        location: locLabel, date: nowDate, layer: layer.label, layer_desc: layer.desc,
        notes: compareDate ? `Confronto con ${compareDate} (Then/Now).` : undefined,
      });
      setAnalysis(r);
    } catch { setAnalysis(null); } finally { setAiLoading(false); }
  };

  const publish = async () => {
    if (!user) { router.push("/login" as never); return; }
    setPublishing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const path = FileSystem.cacheDirectory + `sat_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(nowUrl, path);
      const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
      const created = await socialApi.createObservation({
        media_type: "image", source: "satellite",
        caption: `${layer.label} · ${locLabel}`,
        image_base64: b64,
        data: {
          lat, lon, layers: [layer.label], layer_id: layer.id, acquired: nowDate,
          compare_date: compareDate, location: locLabel,
          analysis: analysis ?? undefined,
        } as never,
      });
      setPublished(created.id);
    } catch { /* ignore */ } finally { setPublishing(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Satellite Observation" subtitle="Earth Now · dati NASA GIBS" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="satellite-observe">
        {!hasLoc ? (
          <Text style={styles.note}>Posizione non attiva: mostro l&apos;Italia come esempio. Attiva il GPS per la tua area.</Text>
        ) : null}

        {/* Layer selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {GIBS_LAYERS.map((l, i) => (
            <Pressable key={l.id} testID={`sat-layer-${i}`} onPress={() => { Haptics.selectionAsync(); setLayerIdx(i); setAnalysis(null); }}
              style={[styles.chip, i === layerIdx && styles.chipActive]}>
              <Text style={[styles.chipText, i === layerIdx && { color: colors.onBrand }]}>{l.emoji} {l.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.layerDesc}>{layer.desc}</Text>

        {/* Imagery */}
        {compareDate ? (
          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>THEN · {compareDate}</Text>
              <Image source={{ uri: thenUrl! }} style={styles.halfImg} contentFit="cover" transition={200} />
            </View>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>NOW · {nowDate}</Text>
              <Image source={{ uri: nowUrl }} style={styles.halfImg} contentFit="cover" transition={200} />
            </View>
          </View>
        ) : (
          <Image source={{ uri: nowUrl }} style={styles.fullImg} contentFit="cover" transition={250} />
        )}

        {/* Then / Now */}
        <View style={styles.thenNow}>
          <Text style={styles.thenNowLabel}>Then / Now</Text>
          <View style={styles.presetRow}>
            <Pressable onPress={() => setCompareDays(null)} style={[styles.preset, compareDays == null && styles.presetActive]}>
              <Text style={[styles.presetText, compareDays == null && { color: colors.onBrand }]}>Solo oggi</Text>
            </Pressable>
            {COMPARE_PRESETS.map((p) => (
              <Pressable key={p.days} onPress={() => setCompareDays(p.days)} style={[styles.preset, compareDays === p.days && styles.presetActive]}>
                <Text style={[styles.presetText, compareDays === p.days && { color: colors.onBrand }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* AI analysis */}
        <Pressable testID="sat-analyze" style={styles.analyzeBtn} onPress={analyze} disabled={aiLoading}>
          {aiLoading ? <ActivityIndicator color={colors.onBrand} /> : (
            <><Ionicons name="sparkles" size={18} color={colors.onBrand} /><Text style={styles.analyzeText}>Analizza con l&apos;AI</Text></>
          )}
        </Pressable>

        {analysis ? (
          <Animated.View entering={FadeIn.duration(400)} style={{ gap: spacing.md }}>
            <AnalysisCard title="WHAT WE OBSERVE" icon="eye" color={colors.blue} text={analysis.observe} />
            {analysis.explanations ? <AnalysisCard title="POSSIBLE EXPLANATIONS" icon="git-branch" color={colors.brand} text={analysis.explanations} /> : null}
            {analysis.cannot ? <AnalysisCard title="WHAT WE CANNOT CONCLUDE" icon="hand-left" color="#FF9F0A" text={analysis.cannot} /> : null}
          </Animated.View>
        ) : null}

        {published ? (
          <Pressable testID="sat-published" style={styles.publishedBtn} onPress={() => router.push(`/observation-detail?id=${published}` as never)}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.publishedText}>Pubblicata nel feed · Apri</Text>
          </Pressable>
        ) : (
          <Pressable testID="sat-publish" style={[styles.publishBtn, publishing && { opacity: 0.6 }]} onPress={publish} disabled={publishing}>
            {publishing ? <ActivityIndicator color={colors.onBrand} /> : (
              <><Ionicons name="cloud-upload-outline" size={18} color={colors.onBrand} /><Text style={styles.publishText}>Pubblica Satellite Observation</Text></>
            )}
          </Pressable>
        )}

        <Text style={styles.note}>Immagini: NASA GIBS / Worldview (dati pubblici di osservazione della Terra). L&apos;AI interpreta solo il tipo di dato e i suoi limiti, senza inventare ciò che è presente nell&apos;immagine.</Text>
      </ScrollView>
    </SpaceBackground>
  );
}

function AnalysisCard({ title, icon, color, text }: { title: string; icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={[styles.analysisCard, { borderLeftColor: color }]}>
      <View style={styles.analysisHead}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={[styles.analysisTitle, { color }]}>{title}</Text>
      </View>
      <Text style={styles.analysisText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  layerDesc: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  fullImg: { width: "100%", aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.tertiary },
  compareRow: { flexDirection: "row", gap: spacing.sm },
  compareCol: { flex: 1, gap: spacing.xs },
  compareLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2, letterSpacing: 0.5 },
  halfImg: { width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.tertiary },
  thenNow: { gap: spacing.sm },
  thenNowLabel: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  preset: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  presetActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  presetText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg },
  analyzeText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  analysisCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderLeftWidth: 3, gap: spacing.sm },
  analysisHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  analysisTitle: { fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1 },
  analysisText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  publishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg },
  publishText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  publishedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.success },
  publishedText: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.65 },
});
