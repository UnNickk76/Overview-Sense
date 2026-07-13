import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SnapshotStudio, SnapshotInput } from "@/src/components/SnapshotStudio";
import { GIBS_LAYERS, gibsSnapshotUrl } from "@/src/lib/satelliteImagery";
import { useObserver } from "@/src/hooks/useObserver";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrapLon = (l: number) => ((l + 540) % 360) - 180;
// Zoom levels = half-width of the viewport in degrees (smaller = closer).
const DELTAS = [60, 30, 15, 8, 4, 2, 1, 0.5];

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(2, days));
  return d.toISOString().slice(0, 10);
}

export default function SatelliteExplore() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const observer = useObserver();
  const { width } = useWindowDimensions();
  const SIZE = Math.min(width - spacing.lg * 2, 460);

  const startLat = observer.status === "granted" ? observer.lat : 41.9;
  const startLon = observer.status === "granted" ? observer.lon : 12.5;

  const [center, setCenter] = useState({ lat: startLat, lon: startLon });
  const [zoom, setZoom] = useState(2);
  const [layerIdx, setLayerIdx] = useState(0);
  const [days, setDays] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [compare, setCompare] = useState(false);
  const [cmpLayerIdx, setCmpLayerIdx] = useState(3);
  const [split, setSplit] = useState(0.5);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [snap, setSnap] = useState<SnapshotInput | null>(null);
  const [snapOpen, setSnapOpen] = useState(false);

  const splitStart = useRef(0.5);
  const delta = DELTAS[zoom];
  const layer = GIBS_LAYERS[layerIdx];
  const cmpLayer = GIBS_LAYERS[cmpLayerIdx];
  const date = dateDaysAgo(days);

  const nowUrl = useMemo(() => gibsSnapshotUrl(center.lat, center.lon, date, layer.id, delta, 720),
    [center.lat, center.lon, date, layer.id, delta]);
  const cmpUrl = useMemo(() => gibsSnapshotUrl(center.lat, center.lon, date, cmpLayer.id, delta, 720),
    [center.lat, center.lon, date, cmpLayer.id, delta]);

  // ---- Map gestures ----
  const commitPan = (tx: number, ty: number) => {
    const dLon = (tx / SIZE) * (2 * delta);
    const dLat = (ty / SIZE) * (2 * delta);
    setCenter((c) => ({ lat: clamp(c.lat + dLat, -85, 85), lon: wrapLon(c.lon - dLon) }));
    setDrag({ x: 0, y: 0 });
  };
  const commitPinch = (s: number) => {
    setScale(1);
    if (s > 1.25) setZoom((z) => Math.min(z + 1, DELTAS.length - 1));
    else if (s < 0.8) setZoom((z) => Math.max(z - 1, 0));
  };
  const zoomIn = () => { Haptics.selectionAsync(); setZoom((z) => Math.min(z + 1, DELTAS.length - 1)); };

  const pan = Gesture.Pan()
    .onUpdate((e) => runOnJS(setDrag)({ x: e.translationX, y: e.translationY }))
    .onEnd((e) => runOnJS(commitPan)(e.translationX, e.translationY));
  const pinch = Gesture.Pinch()
    .onUpdate((e) => runOnJS(setScale)(e.scale))
    .onEnd((e) => runOnJS(commitPinch)(e.scale));
  const dtap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(zoomIn)());
  const mapGesture = Gesture.Exclusive(dtap, Gesture.Simultaneous(pan, pinch));

  // ---- Divider gesture ----
  const beginSplit = () => { splitStart.current = split; };
  const moveSplit = (tx: number) => setSplit(clamp(splitStart.current + tx / SIZE, 0.06, 0.94));
  const dividerGesture = Gesture.Pan()
    .onBegin(() => runOnJS(beginSplit)())
    .onUpdate((e) => runOnJS(moveSplit)(e.translationX));

  // ---- Time slider gesture ----
  const setScrubDays = (x: number) => setScrub(clamp(Math.round((x / SIZE) * 60), 0, 60));
  const commitScrub = () => { if (scrub != null) { setDays(scrub); setScrub(null); } };
  const timeGesture = Gesture.Pan()
    .onBegin((e) => runOnJS(setScrubDays)(e.x))
    .onUpdate((e) => runOnJS(setScrubDays)(e.x))
    .onEnd(() => runOnJS(commitScrub)());
  const shownDays = scrub ?? days;

  const takeSnapshot = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let base64: string | undefined;
    try {
      const path = `${FileSystem.cacheDirectory}sat_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(nowUrl, path);
      base64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
    } catch { /* remote uri fallback */ }
    setSnap({
      uri: nowUrl, base64,
      title: `${layer.label} · ${center.lat.toFixed(1)}°, ${center.lon.toFixed(1)}°`,
      layerName: layer.label,
      source: `NASA GIBS · ${date}`,
      hashtags: ["Satellite", "EarthObservation", layer.label.replace(/[^\p{L}\p{N}]/gu, "")],
      dataLines: [
        { icon: "🛰️", label: `${layer.label} · ${date}` },
        { icon: "📍", label: `${center.lat.toFixed(2)}°, ${center.lon.toFixed(2)}° · zoom ${zoom + 1}/${DELTAS.length}` },
      ],
      socialSource: "satellite", snapKind: "satellite",
      data: { from: "satellite-explore", lat: center.lat, lon: center.lon, layer: layer.id, date },
    });
    setSnapOpen(true);
  }, [nowUrl, layer.label, layer.id, center.lat, center.lon, date, zoom]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Satellite Observation" subtitle="Terra esplorabile · NASA GIBS" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false}>

        {/* Explorable Earth */}
        <View style={[styles.map, { width: SIZE, height: SIZE }]}>
          <GestureDetector gesture={mapGesture}>
            <View style={StyleSheet.absoluteFill}>
              <Image key={nowUrl} source={{ uri: nowUrl }} style={[StyleSheet.absoluteFill, { transform: [{ translateX: drag.x }, { translateY: drag.y }, { scale }] }]} contentFit="cover" transition={180} />
              {compare && (
                <View style={[styles.splitClip, { width: SIZE * split, transform: [{ translateX: drag.x }, { translateY: drag.y }, { scale }] }]}>
                  <Image key={cmpUrl} source={{ uri: cmpUrl }} style={{ width: SIZE, height: SIZE }} contentFit="cover" transition={180} />
                </View>
              )}
            </View>
          </GestureDetector>

          {compare && (
            <>
              <View style={[styles.dividerLine, { left: SIZE * split }]} pointerEvents="none" />
              <GestureDetector gesture={dividerGesture}>
                <View style={[styles.dividerHandle, { left: SIZE * split - 18, top: SIZE / 2 - 18 }]}>
                  <Ionicons name="code-outline" size={20} color={colors.onBrand} />
                </View>
              </GestureDetector>
              <Text style={[styles.cmpTag, { left: 8 }]}>{cmpLayer.emoji} {cmpLayer.label}</Text>
              <Text style={[styles.cmpTag, { right: 8 }]}>{layer.emoji} {layer.label}</Text>
            </>
          )}

          {/* Zoom controls */}
          <View style={styles.zoomCol}>
            <Pressable testID="sat-zoom-in" style={styles.zoomBtn} onPress={() => setZoom((z) => Math.min(z + 1, DELTAS.length - 1))}><Ionicons name="add" size={20} color={colors.onSurface} /></Pressable>
            <Pressable testID="sat-zoom-out" style={styles.zoomBtn} onPress={() => setZoom((z) => Math.max(z - 1, 0))}><Ionicons name="remove" size={20} color={colors.onSurface} /></Pressable>
            <Pressable testID="sat-reset" style={styles.zoomBtn} onPress={() => { setCenter({ lat: startLat, lon: startLon }); setZoom(2); }}><Ionicons name="locate" size={18} color={colors.brand} /></Pressable>
          </View>
          <Text style={styles.coords}>{center.lat.toFixed(2)}°, {center.lon.toFixed(2)}° · z{zoom + 1}</Text>
          <Text style={styles.hint}>Trascina · pizzica · doppio tap per zoom</Text>
        </View>

        {/* Snapshot */}
        <Pressable testID="sat-snapshot" style={styles.snapBtn} onPress={takeSnapshot}>
          <Ionicons name="camera" size={18} color={colors.onBrand} />
          <Text style={styles.snapText}>Snapshot Overview → pubblica</Text>
        </Pressable>

        {/* Layer selector */}
        <Text style={styles.section}>Layer satellitare</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {GIBS_LAYERS.map((l, i) => (
            <Pressable key={l.id} testID={`sat-layer-${i}`} onPress={() => { Haptics.selectionAsync(); setLayerIdx(i); }}
              style={[styles.chip, i === layerIdx && styles.chipActive]}>
              <Text style={[styles.chipText, i === layerIdx && { color: colors.onBrand }]}>{l.emoji} {l.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.layerDesc}>{layer.desc}</Text>

        {/* Compare */}
        <Pressable testID="sat-compare" style={[styles.cmpToggle, compare && styles.cmpToggleOn]} onPress={() => setCompare((c) => !c)}>
          <Ionicons name={compare ? "git-compare" : "git-compare-outline"} size={18} color={compare ? colors.onBrand : colors.onSurface} />
          <Text style={[styles.cmpToggleText, compare && { color: colors.onBrand }]}>{compare ? "Confronto attivo · trascina il divisore" : "Confronta due layer"}</Text>
        </Pressable>
        {compare && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {GIBS_LAYERS.map((l, i) => (
              <Pressable key={l.id} testID={`sat-cmp-${i}`} onPress={() => { Haptics.selectionAsync(); setCmpLayerIdx(i); }}
                style={[styles.chip, i === cmpLayerIdx && styles.chipActive]}>
                <Text style={[styles.chipText, i === cmpLayerIdx && { color: colors.onBrand }]}>{l.emoji} {l.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Then / Now time slider */}
        <View style={styles.timeHeader}>
          <Text style={styles.section}>Then / Now</Text>
          <Text style={styles.timeVal}>{shownDays === 0 ? "Più recente" : `${shownDays} giorni fa`} · {dateDaysAgo(shownDays)}</Text>
        </View>
        <GestureDetector gesture={timeGesture}>
          <View style={[styles.timeTrack, { width: SIZE }]}>
            <View style={[styles.timeFill, { width: `${(shownDays / 60) * 100}%` }]} />
            <View style={[styles.timeKnob, { left: (shownDays / 60) * (SIZE - 22) }]} />
          </View>
        </GestureDetector>

        <Pressable testID="sat-analysis" style={styles.link} onPress={() => router.push("/satellite-observe" as never)}>
          <Ionicons name="analytics-outline" size={16} color={colors.brand} />
          <Text style={styles.linkText}>Analisi AI dettagliata (Then/Now classico)</Text>
        </Pressable>

        <Text style={styles.note}>Immagini: NASA GIBS / Worldview (dati pubblici di osservazione della Terra). Ogni livello di zoom ricarica l&apos;immagine più dettagliata disponibile per l&apos;area.</Text>
      </ScrollView>

      <SnapshotStudio visible={snapOpen} input={snap} onClose={() => setSnapOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05070c" },
  map: { alignSelf: "center", borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#05070c", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  splitClip: { position: "absolute", left: 0, top: 0, height: "100%", overflow: "hidden", borderRightWidth: 2, borderRightColor: colors.brand },
  dividerLine: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: colors.brand },
  dividerHandle: { position: "absolute", width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", zIndex: 5 },
  cmpTag: { position: "absolute", top: 8, color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 1, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  zoomCol: { position: "absolute", right: 8, top: 8, gap: 6 },
  zoomBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(10,16,26,0.85)", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  coords: { position: "absolute", left: 8, bottom: 26, color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 1, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  hint: { position: "absolute", left: 8, bottom: 8, color: "rgba(255,255,255,0.75)", fontFamily: fonts.regular, fontSize: type.sm - 2 },
  snapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md },
  snapText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  section: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  layerDesc: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  cmpToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cmpToggleOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  cmpToggleText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  timeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  timeVal: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  timeTrack: { height: 22, justifyContent: "center", alignSelf: "center" },
  timeFill: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: colors.brand },
  timeKnob: { position: "absolute", width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brand, borderWidth: 2, borderColor: "#fff" },
  link: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.sm },
  linkText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  note: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 16, marginTop: spacing.sm },
});
