import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Modal, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop, Text as SvgText } from "react-native-svg";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { eventsApi, LiveEarthPoint, mediaUrl } from "@/src/lib/backend";
import { CONTINENTS } from "@/src/lib/continents";
import { CITIES } from "@/src/lib/cities";

const D2R = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Aurore: "sparkles", ISS: "earth", "Via Lattea": "planet", Pianeti: "planet",
  Luna: "moon", Sole: "sunny", Costellazioni: "star", Satelliti: "radio",
  "Campo magnetico": "magnet", Meteo: "cloud", Atmosfera: "cloud",
  "Satellite Intelligence": "globe", "Listening Layer": "musical-notes",
};

// Pre-sampled graticule (kept light — continents carry the detail).
function buildGraticule() {
  const lines: { lat: number; lon: number }[][] = [];
  for (let lon = -180; lon < 180; lon += 60) {
    const l: { lat: number; lon: number }[] = [];
    for (let lat = -90; lat <= 90; lat += 12) l.push({ lat, lon });
    lines.push(l);
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    const l: { lat: number; lon: number }[] = [];
    for (let lon = -180; lon <= 180; lon += 12) l.push({ lat, lon });
    lines.push(l);
  }
  return lines;
}

interface Props { size?: number; onInteracting?: (active: boolean) => void; variant?: "full" | "compact"; onExpand?: () => void }

export function LiveEarth({ size = 260, onInteracting, variant = "full", onExpand }: Props) {
  const router = useRouter();
  const compact = variant === "compact";
  const onExpandRef = useRef(onExpand);
  onExpandRef.current = onExpand;
  const baseR = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  const [points, setPoints] = useState<LiveEarthPoint[]>([]);
  const [meta, setMeta] = useState({ recent: 0, geo: 0, hours: 24 });
  const [lon0, setLon0] = useState(20);
  const [lat0, setLat0] = useState(18);
  const [zoom, setZoom] = useState(1);
  const [tick, setTick] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [listItems, setListItems] = useState<LiveEarthPoint[]>([]);

  // Mirrors for gesture closures (avoid stale state).
  const lonRef = useRef(20); const latRef = useRef(18); const zoomRef = useRef(1);
  const startLon = useRef(20); const startLat = useRef(18); const startZoom = useRef(1);
  const idleRef = useRef(true);      // auto-rotate only when idle
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotsRef = useRef<{ pt: LiveEarthPoint; sx: number; sy: number }[]>([]);
  const mounted = useRef(true);
  const graticule = useMemo(buildGraticule, []);

  const setLonV = (v: number) => { lonRef.current = v; setLon0(v); };
  const setLatV = (v: number) => { latRef.current = v; setLat0(v); };
  const setZoomV = (v: number) => { zoomRef.current = v; setZoom(v); };

  // ---- live data ----
  useEffect(() => {
    mounted.current = true;
    const fetchPoints = () => {
      eventsApi.liveEarth().then((r) => {
        if (!mounted.current) return;
        setPoints(r.points);
        setMeta({ recent: r.total_recent, geo: r.total_geolocated, hours: r.window_hours });
      }).catch(() => {});
    };
    fetchPoints();
    const dataTimer = setInterval(fetchPoints, 60000);
    return () => { mounted.current = false; clearInterval(dataTimer); };
  }, []);

  // ---- auto-rotation + pulse clock ----
  useEffect(() => {
    const t = setInterval(() => {
      if (idleRef.current) {
        setLon0((l) => { const nv = (l + 0.35) % 360; lonRef.current = nv; return nv; });
      }
      setTick((k) => (k + 1) % 100000);
    }, 60);
    return () => clearInterval(t);
  }, []);

  const pause = () => {
    idleRef.current = false;
    onInteracting?.(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const resumeSoon = () => {
    onInteracting?.(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { idleRef.current = true; }, 600);
  };

  const beginPan = () => { if (compact) return; pause(); startLon.current = lonRef.current; startLat.current = latRef.current; };
  const updatePan = (tx: number, ty: number) => {
    if (compact) return;
    const k = 0.34 / zoomRef.current;
    setLonV((startLon.current - tx * k) % 360);
    setLatV(clamp(startLat.current + ty * k, -85, 85));
  };
  const beginPinch = () => { if (compact) return; pause(); startZoom.current = zoomRef.current; };
  const updatePinch = (s: number) => { if (compact) return; setZoomV(clamp(startZoom.current * s, 1, 6)); };

  const openDetail = (id: string) => {
    setListOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/observation-detail?id=${id}` as never);
  };

  const handleDoubleTap = (x: number, y: number) => {
    if (compact) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onExpandRef.current?.(); return; }
    const thr = 30 + 6 * zoomRef.current;
    const hits = dotsRef.current
      .map((d) => ({ pt: d.pt, dist: Math.hypot(d.sx - x, d.sy - y) }))
      .filter((h) => h.dist < thr)
      .sort((a, b) => a.dist - b.dist);
    if (hits.length === 0) return;
    if (hits.length === 1) { openDetail(hits[0].pt.id); return; }
    // Overlapping cluster → open a tidy list to choose from.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListItems(hits.map((h) => h.pt));
    setListOpen(true);
  };

  const resetView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setZoomV(1); setLatV(18);
  };

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin(() => runOnJS(beginPan)())
      .onUpdate((e) => runOnJS(updatePan)(e.translationX, e.translationY))
      .onEnd(() => runOnJS(resumeSoon)());
    const pinch = Gesture.Pinch()
      .onBegin(() => runOnJS(beginPinch)())
      .onUpdate((e) => runOnJS(updatePinch)(e.scale))
      .onEnd(() => runOnJS(resumeSoon)());
    const dtap = Gesture.Tap().numberOfTaps(2).maxDuration(320)
      .onEnd((e) => runOnJS(handleDoubleTap)(e.x, e.y));
    return Gesture.Exclusive(dtap, Gesture.Simultaneous(pan, pinch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- projection ----
  const Rz = baseR * zoom;
  const proj = useCallback((lat: number, lon: number) => {
    const phi = lat * D2R, dl = (lon - lon0) * D2R;
    const sp0 = Math.sin(lat0 * D2R), cp0 = Math.cos(lat0 * D2R);
    const sp = Math.sin(phi), cp = Math.cos(phi), cl = Math.cos(dl);
    const x = cp * Math.sin(dl);
    const y = cp0 * sp - sp0 * cp * cl;
    const z = sp0 * sp + cp0 * cp * cl;
    return { sx: cx + Rz * x, sy: cy - Rz * y, z };
  }, [lon0, lat0, Rz, cx, cy]);

  const contPaths = useMemo(() => {
    const paths: string[] = [];
    for (const ring of CONTINENTS) {
      let d = ""; let pen = false;
      for (const [lon, lat] of ring) {
        const p = proj(lat, lon);
        if (p.z >= -0.03) {
          d += (pen ? "L" : "M") + p.sx.toFixed(1) + " " + p.sy.toFixed(1) + " ";
          pen = true;
        } else pen = false;
      }
      if (d) paths.push(d.trim());
    }
    return paths;
  }, [proj]);

  const gratPaths = useMemo(() => {
    const paths: string[] = [];
    for (const line of graticule) {
      let d = ""; let pen = false;
      for (const v of line) {
        const p = proj(v.lat, v.lon);
        if (p.z >= -0.02) { d += (pen ? "L" : "M") + p.sx.toFixed(1) + " " + p.sy.toFixed(1) + " "; pen = true; }
        else pen = false;
      }
      if (d) paths.push(d.trim());
    }
    return paths;
  }, [proj, graticule]);

  const cityMarks = useMemo(() => {
    if (zoom < 2.2) return [];
    return CITIES.map((c) => {
      const p = proj(c.lat, c.lon);
      if (p.z < 0.05) return null;
      return { name: c.name, sx: p.sx, sy: p.sy };
    }).filter(Boolean) as { name: string; sx: number; sy: number }[];
  }, [proj, zoom]);

  const dots = useMemo(() => {
    const phase = (tick % 16) / 16;
    const out = points.map((pt) => {
      const p = proj(pt.lat, pt.lon);
      if (p.z < 0) return null;
      const edge = 0.35 + 0.65 * p.z;
      const color = pt.intensity >= 50 ? colors.brand : colors.blue;
      const pulse = 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI + pt.lat);
      return { pt, sx: p.sx, sy: p.sy, color, edge, pulse };
    }).filter(Boolean) as { pt: LiveEarthPoint; sx: number; sy: number; color: string; edge: number; pulse: number }[];
    dotsRef.current = out.map((o) => ({ pt: o.pt, sx: o.sx, sy: o.sy }));
    return out;
  }, [points, proj, tick]);

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      {!compact && (
        <View style={styles.header}>
          <Text style={styles.title}>🌍 Live Earth</Text>
          <Text style={styles.subtitle}>Il pianeta osservato in tempo reale</Text>
        </View>
      )}

      <GestureDetector gesture={gesture}>
        <View style={[styles.stage, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="ocean" cx="38%" cy="32%" r="80%">
                <Stop offset="0%" stopColor="#0d2947" />
                <Stop offset="55%" stopColor="#071a2e" />
                <Stop offset="100%" stopColor="#030c16" />
              </RadialGradient>
              <RadialGradient id="atmo" cx="50%" cy="50%" r="50%">
                <Stop offset="80%" stopColor={colors.blue} stopOpacity={0} />
                <Stop offset="100%" stopColor={colors.blue} stopOpacity={0.4} />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={Rz + 5} fill="url(#atmo)" />
            <Circle cx={cx} cy={cy} r={Rz} fill="url(#ocean)" stroke={colors.border} strokeWidth={1} />
            {gratPaths.map((d, i) => (
              <Path key={`g${i}`} d={d} stroke={colors.blue} strokeWidth={0.5} strokeOpacity={0.18} fill="none" />
            ))}
            {contPaths.map((d, i) => (
              <Path key={`c${i}`} d={d} stroke={colors.brand} strokeWidth={zoom >= 2 ? 1.2 : 0.9}
                strokeOpacity={0.85} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {cityMarks.map((c, i) => (
              <React.Fragment key={`city${i}`}>
                <Circle cx={c.sx} cy={c.sy} r={1.6} fill={colors.onSurfaceSecondary} opacity={0.8} />
                <SvgText x={c.sx + 4} y={c.sy + 3} fill={colors.onSurfaceSecondary} fontSize={8} opacity={0.85}>{c.name}</SvgText>
              </React.Fragment>
            ))}
            {dots.map((o) => (
              <React.Fragment key={o.pt.id}>
                <Circle cx={o.sx} cy={o.sy} r={4 + 3 * o.pulse} fill={o.color} opacity={0.18 * o.edge} />
                <Circle cx={o.sx} cy={o.sy} r={2.6} fill={o.color} opacity={0.95 * o.edge} />
              </React.Fragment>
            ))}
          </Svg>
        </View>
      </GestureDetector>

      {!compact && (<>
      <View style={styles.legendPill}>
        <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
        <Text style={styles.legendText}>{meta.geo} osservazioni geolocalizzate</Text>
      </View>
      <View style={styles.controls}>
        <Pressable testID="earth-list" style={styles.ctrlBtn} onPress={() => { setListItems(points); setListOpen(true); }}>
          <Ionicons name="list" size={16} color={colors.onSurface} />
          <Text style={styles.ctrlText}>Lista ({points.length})</Text>
        </Pressable>
        <Pressable testID="earth-reset" style={styles.ctrlBtn} onPress={resetView}>
          <Ionicons name="contract-outline" size={16} color={colors.onSurface} />
          <Text style={styles.ctrlText}>Reset zoom</Text>
        </Pressable>
      </View>
      <Text style={styles.legendSub}>Trascina per ruotare · pizzica per zoomare · doppio tap su un&apos;Observation</Text>

      <Modal visible={listOpen} transparent animationType="slide" onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setListOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Osservazioni · {listItems.length}</Text>
          {listItems.length === 0 ? (
            <Text style={styles.legendSub}>Nessuna osservazione geolocalizzata al momento.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 430 }} contentContainerStyle={{ paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
              {listItems.map((pt) => {
                const uri = mediaUrl(pt.image_url);
                return (
                  <Pressable key={pt.id} testID={`list-${pt.id}`} style={styles.listRow} onPress={() => openDetail(pt.id)}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.listThumb} contentFit="cover" transition={120} />
                    ) : (
                      <View style={[styles.listThumb, styles.listThumbEmpty]}>
                        <Ionicons name={ICON[pt.category] ?? "planet"} size={22} color={colors.brand} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.listCatRow}>
                        <Ionicons name={ICON[pt.category] ?? "planet"} size={13} color={colors.brand} />
                        <Text style={styles.listCat}>{pt.category}</Text>
                      </View>
                      <Text style={styles.listMeta}>{pt.nickname ?? "—"} · SV {pt.intensity}</Text>
                      <Text style={styles.listCoord}>{pt.lat.toFixed(1)}°, {pt.lon.toFixed(1)}°</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <Pressable style={styles.sheetClose} onPress={() => setListOpen(false)}>
            <Text style={styles.sheetCloseText}>Chiudi</Text>
          </Pressable>
        </View>
      </Modal>
      </>)}
      {compact && <Text style={styles.compactHint}>Doppio tap per esplorare</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  wrapCompact: { alignItems: "center", gap: 2 },
  compactHint: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: type.sm - 2, letterSpacing: 0.5 },
  header: { alignItems: "center", gap: 2 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  stage: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  ctrlBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ctrlText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  legendPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  legendSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center", paddingHorizontal: spacing.lg },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing["2xl"], borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  listThumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.tertiary },
  listThumbEmpty: { alignItems: "center", justifyContent: "center" },
  listCatRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  listCat: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  listMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  listCoord: { color: colors.onSurfaceTertiary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  sheetClose: { alignItems: "center", paddingVertical: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
  sheetCloseText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
});
