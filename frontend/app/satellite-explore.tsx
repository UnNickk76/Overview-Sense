import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions, Modal, TextInput, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SnapshotStudio, SnapshotInput } from "@/src/components/SnapshotStudio";
import { GIBS_LAYERS, layerImageUrl } from "@/src/lib/satelliteImagery";
import { useObserver } from "@/src/hooks/useObserver";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wrapLon = (l: number) => ((l + 540) % 360) - 180;
// Zoom levels = half-width of the viewport in degrees (smaller = closer). The
// deepest levels (< 0.5°) reach a "near" view with the Sentinel-2 / OSM layers.
const DELTAS = [60, 30, 15, 8, 4, 2, 1, 0.5, 0.2, 0.08, 0.03, 0.012];

// Iconic real destinations for Satellite Journey™ (real coordinates).
const DESTINATIONS: { name: string; lat: number; lon: number; emoji: string }[] = [
  { name: "Grand Canyon", lat: 36.1, lon: -112.1, emoji: "🏜️" },
  { name: "Everest", lat: 27.99, lon: 86.93, emoji: "🏔️" },
  { name: "Grande Barriera Corallina", lat: -18.3, lon: 147.7, emoji: "🐠" },
  { name: "Deserto del Sahara", lat: 23.4, lon: 12.0, emoji: "🐪" },
  { name: "Foresta Amazzonica", lat: -3.4, lon: -62.2, emoji: "🌳" },
  { name: "Venezia", lat: 45.44, lon: 12.34, emoji: "🛶" },
  { name: "Ghiacci della Groenlandia", lat: 72.0, lon: -40.0, emoji: "🧊" },
  { name: "Isole Maldive", lat: 3.2, lon: 73.2, emoji: "🏝️" },
  { name: "Gran Canyon del Colca", lat: -15.6, lon: -71.9, emoji: "🦅" },
  { name: "Aurora · Islanda", lat: 64.9, lon: -19.0, emoji: "🌌" },
];

function satelliteName(layerId: string): string {
  if (layerId.startsWith("VIIRS")) return "VIIRS · Suomi NPP";
  if (layerId.startsWith("MODIS_Terra")) return "MODIS · Terra";
  if (layerId.startsWith("MODIS_Aqua")) return "MODIS · Aqua";
  if (layerId.startsWith("MODIS")) return "MODIS · Terra/Aqua";
  if (layerId.startsWith("GHRSST")) return "GHRSST · multi-satellite";
  if (layerId.startsWith("s2cloudless")) return "Sentinel-2 · ESA (EOX cloudless)";
  if (layerId === "OSM-WMS") return "OpenStreetMap";
  return "NASA GIBS";
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

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
  // Go There deep-link: recreate a shared Senshot's viewpoint (place, zoom, layer).
  const goParams = useLocalSearchParams<{ lat?: string; lon?: string; zoom?: string; layer?: string }>();

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
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [flying, setFlying] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const splitStart = useRef(0.5);
  const delta = DELTAS[zoom];
  const layer = GIBS_LAYERS[layerIdx];
  const cmpLayer = GIBS_LAYERS[cmpLayerIdx];
  const date = dateDaysAgo(days);

  // Apply Go There deep-link once (recreate the shared Senshot's exact viewpoint).
  const goDone = useRef(false);
  useEffect(() => {
    if (goDone.current || goParams.lat == null || goParams.lon == null) return;
    const lat = Number(goParams.lat), lon = Number(goParams.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    goDone.current = true;
    setCenter({ lat, lon });
    if (goParams.zoom != null) {
      const z = Number(goParams.zoom);
      if (Number.isFinite(z)) setZoom(clamp(Math.round(z), 0, DELTAS.length - 1));
    } else {
      // Arriving from a shared Senshot without an explicit zoom → land "near"
      // (like a map app) instead of a far regional view.
      setZoom(9);
    }
    if (goParams.layer) {
      const i = GIBS_LAYERS.findIndex((l) => l.id === goParams.layer);
      if (i >= 0) setLayerIdx(i);
    } else {
      // Default to the high-detail Sentinel-2 layer for a close, real view.
      const s2 = GIBS_LAYERS.findIndex((l) => l.kind === "sentinel2");
      if (s2 >= 0) setLayerIdx(s2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goParams.lat, goParams.lon]);

  const nowUrl = useMemo(() => layerImageUrl(layer, center.lat, center.lon, date, delta, 720),
    [center.lat, center.lon, date, layer, delta]);
  const cmpUrl = useMemo(() => layerImageUrl(cmpLayer, center.lat, center.lon, date, delta, 720),
    [center.lat, center.lon, date, cmpLayer, delta]);

  // Double-buffer: the last fully-loaded image stays on screen while the next one
  // loads underneath/over it → never a black frame during pan/zoom (continuous feel).
  const [readyUrl, setReadyUrl] = useState(nowUrl);
  useEffect(() => { setReadyUrl((prev) => prev ?? nowUrl); }, [nowUrl]);

  React.useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

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

  // ---- Satellite Journey™ — cinematic fly-to (all free imagery) ----
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const journeyTo = (destLat: number, destLon: number) => {
    clearTimers();
    setJourneyOpen(false);
    setFlying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const startC = { ...center };
    setZoom(0); // pull back to the whole world
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      timers.current.push(setTimeout(() => {
        const e = easeInOut(i / steps);
        setCenter({ lat: lerp(startC.lat, destLat, e), lon: wrapLon(lerp(startC.lon, destLon, e)) });
      }, 400 + i * 150));
    }
    // Then descend to detail.
    const base = 400 + steps * 150 + 250;
    [1, 2, 3, 4, 5].forEach((z, k) => timers.current.push(setTimeout(() => {
      setZoom(z);
      if (z === 5) { setFlying(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    }, base + k * 360)));
  };

  const searchAndFly = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const local = DESTINATIONS.find((d) => d.name.toLowerCase().includes(q.toLowerCase()));
      if (local) { journeyTo(local.lat, local.lon); return; }
      const res = await Location.geocodeAsync(q); // free OS geocoder
      if (res?.[0]) journeyTo(res[0].latitude, res[0].longitude);
    } catch { /* ignore */ } finally { setSearching(false); setQuery(""); }
  };

  const takeSnapshot = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let base64: string | undefined;
    try {
      const path = `${FileSystem.cacheDirectory}sat_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(nowUrl, path);
      base64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
    } catch { /* remote uri fallback */ }
    // Reverse-geocode the place name (free OS geocoder; falls back to coords).
    let place = `${center.lat.toFixed(2)}°, ${center.lon.toFixed(2)}°`;
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: center.lat, longitude: center.lon });
      const g = geo?.[0];
      const parts = [g?.city || g?.subregion || g?.region, g?.country].filter(Boolean);
      if (parts.length) place = parts.join(", ");
    } catch { /* keep coords */ }
    const sat = satelliteName(layer.id);
    setSnap({
      uri: nowUrl, base64,
      title: place,
      layerName: layer.label,
      source: `${sat} · NASA GIBS · ${date}`,
      hashtags: ["Senshot", "Satellite", "EarthObservation", layer.label.replace(/[^\p{L}\p{N}]/gu, "")],
      dataLines: [
        { icon: "📍", label: `${place} · ${center.lat.toFixed(3)}°, ${center.lon.toFixed(3)}°` },
        { icon: "🛰️", label: `${sat} · ${layer.label}` },
        { icon: "🗓️", label: `Acquisizione: ${date} · zoom ${zoom + 1}/${DELTAS.length}` },
      ],
      socialSource: "satellite", snapKind: "satellite",
      data: { from: "satellite-explore", place, lat: center.lat, lon: center.lon, zoom, layer: layer.id, satellite: sat, date, senshot: true },
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
              {/* Persistent previous frame — keeps the map visible while the next tile loads */}
              <Image source={{ uri: readyUrl }} style={[StyleSheet.absoluteFill, { transform: [{ translateX: drag.x }, { translateY: drag.y }, { scale }] }]} contentFit="cover" cachePolicy="memory-disk" />
              <Image
                source={{ uri: nowUrl }}
                style={[StyleSheet.absoluteFill, { transform: [{ translateX: drag.x }, { translateY: drag.y }, { scale }] }]}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={260}
                onLoad={() => setReadyUrl(nowUrl)}
              />
              {compare && (
                <View style={[styles.splitClip, { width: SIZE * split, transform: [{ translateX: drag.x }, { translateY: drag.y }, { scale }] }]}>
                  <Image source={{ uri: cmpUrl }} style={{ width: SIZE, height: SIZE }} contentFit="cover" cachePolicy="memory-disk" transition={260} />
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
          {flying && (
            <View style={styles.flyOverlay} pointerEvents="none">
              <Ionicons name="rocket" size={26} color={colors.brand} />
              <Text style={styles.flyText}>Satellite Journey™ · volo in corso…</Text>
            </View>
          )}
        </View>

        {/* Actions: Journey + Senshot */}
        <View style={styles.actRow}>
          <Pressable testID="sat-journey" style={styles.journeyBtn} onPress={() => setJourneyOpen(true)}>
            <Ionicons name="rocket-outline" size={18} color={colors.onSurface} />
            <Text style={styles.journeyText}>Satellite Journey™</Text>
          </Pressable>
          <Pressable testID="sat-snapshot" style={styles.snapBtn} onPress={takeSnapshot}>
            <Ionicons name="camera" size={18} color={colors.onBrand} />
            <Text style={styles.snapText}>Senshot™</Text>
          </Pressable>
        </View>

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

        <Text style={styles.note}>Immagini: NASA GIBS / Worldview (dati pubblici, gratuiti). Mostriamo la risoluzione realmente disponibile per l&apos;area — nessun dettaglio inventato. Fonte, satellite e data di acquisizione sono sempre indicati nel Senshot™.</Text>
      </ScrollView>

      <SnapshotStudio visible={snapOpen} input={snap} onClose={() => setSnapOpen(false)} />

      {/* Satellite Journey™ picker */}
      <Modal visible={journeyOpen} transparent animationType="slide" onRequestClose={() => setJourneyOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setJourneyOpen(false)} />
        <View style={[styles.jSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.jHandle} />
          <Text style={styles.jTitle}>Satellite Journey™</Text>
          <Text style={styles.jSub}>Scegli una destinazione: OverView ti porterà lì con un volo cinematografico.</Text>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.onSurfaceSecondary} />
            <TextInput testID="sat-search" style={styles.searchInput} value={query} onChangeText={setQuery}
              placeholder="Cerca un luogo…" placeholderTextColor={colors.onSurfaceSecondary}
              onSubmitEditing={searchAndFly} returnKeyType="search" />
            {searching ? <ActivityIndicator color={colors.brand} /> : query ? (
              <Pressable testID="sat-search-go" onPress={searchAndFly}><Ionicons name="arrow-forward-circle" size={24} color={colors.brand} /></Pressable>
            ) : null}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.md }}>
            {DESTINATIONS.map((d) => (
              <Pressable key={d.name} testID={`sat-dest-${d.name}`} style={styles.destRow} onPress={() => journeyTo(d.lat, d.lon)}>
                <Text style={styles.destEmoji}>{d.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.destName}>{d.name}</Text>
                  <Text style={styles.destCoord}>{d.lat.toFixed(1)}°, {d.lon.toFixed(1)}°</Text>
                </View>
                <Ionicons name="rocket-outline" size={18} color={colors.brand} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  snapBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md },
  snapText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  actRow: { flexDirection: "row", gap: spacing.sm },
  journeyBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  journeyText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  flyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "rgba(0,0,0,0.35)" },
  flyText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 6 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  jSheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "80%", backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  jHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  jTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  jSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginBottom: spacing.sm },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base },
  destRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  destEmoji: { fontSize: 24 },
  destName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  destCoord: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
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
