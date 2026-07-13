import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
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

interface Props { size?: number; onInteracting?: (active: boolean) => void }

export function LiveEarth({ size = 260, onInteracting }: Props) {
  const router = useRouter();
  const baseR = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  const [points, setPoints] = useState<LiveEarthPoint[]>([]);
  const [meta, setMeta] = useState({ recent: 0, geo: 0, hours: 24 });
  const [lon0, setLon0] = useState(20);
  const [lat0, setLat0] = useState(18);
  const [zoom, setZoom] = useState(1);
  const [tick, setTick] = useState(0);

  // Mirrors for gesture closures (avoid stale state).
  const lonRef = useRef(20); const latRef = useRef(18); const zoomRef = useRef(1);
  const startLon = useRef(20); const startLat = useRef(18); const startZoom = useRef(1);
  const idleRef = useRef(true);      // auto-rotate only when idle
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotsRef = useRef<{ id: string; sx: number; sy: number }[]>([]);
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

  const beginPan = () => { pause(); startLon.current = lonRef.current; startLat.current = latRef.current; };
  const updatePan = (tx: number, ty: number) => {
    const k = 0.34 / zoomRef.current;
    setLonV((startLon.current - tx * k) % 360);
    setLatV(clamp(startLat.current + ty * k, -85, 85));
  };
  const beginPinch = () => { pause(); startZoom.current = zoomRef.current; };
  const updatePinch = (s: number) => { setZoomV(clamp(startZoom.current * s, 1, 6)); };

  const handleDoubleTap = (x: number, y: number) => {
    let best: { id: string; d: number } | null = null;
    const thr = 20 + 8 * zoomRef.current;
    for (const d of dotsRef.current) {
      const dist = Math.hypot(d.sx - x, d.sy - y);
      if (dist < thr && (!best || dist < best.d)) best = { id: d.id, d: dist };
    }
    if (best) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push(`/observation-detail?id=${best.id}` as never);
    }
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
    dotsRef.current = out.map((o) => ({ id: o.pt.id, sx: o.sx, sy: o.sy }));
    return out;
  }, [points, proj, tick]);

  const showThumbs = zoom >= 1.8;
  const showIcons = zoom >= 1.5;
  const thumbR = clamp(14 * zoom, 16, 34);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>🌍 Live Earth</Text>
        <Text style={styles.subtitle}>Il pianeta osservato in tempo reale</Text>
      </View>

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
                <Circle cx={o.sx} cy={o.sy} r={(4 + 4 * o.pulse) * (zoom >= 2 ? 1.3 : 1)} fill={o.color} opacity={0.16 * o.edge} />
                <Circle cx={o.sx} cy={o.sy} r={2.4} fill={o.color} opacity={0.95 * o.edge} />
              </React.Fragment>
            ))}
          </Svg>

          {/* Sense Vision previews + labels appear as you zoom in (visual only). */}
          {showThumbs || showIcons ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {dots.map((o) => {
                const uri = mediaUrl(o.pt.image_url);
                if (showThumbs && uri) {
                  return (
                    <View key={`t${o.pt.id}`} style={[styles.thumbWrap, {
                      left: o.sx - thumbR, top: o.sy - thumbR - (thumbR + 6),
                      width: thumbR * 2, height: thumbR * 2, borderRadius: thumbR, opacity: o.edge,
                    }]}>
                      <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: thumbR }} contentFit="cover" transition={150} />
                    </View>
                  );
                }
                if (showIcons) {
                  return (
                    <View key={`i${o.pt.id}`} style={[styles.iconChip, { left: o.sx + 5, top: o.sy - 8, opacity: o.edge }]}>
                      <Ionicons name={ICON[o.pt.category] ?? "planet"} size={11} color={o.color} />
                    </View>
                  );
                }
                return null;
              })}
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <View style={styles.controls}>
        <View style={styles.legendPill}>
          <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
          <Text style={styles.legendText}>{meta.geo} osservazioni geolocalizzate</Text>
        </View>
        {zoom > 1.05 ? (
          <Pressable testID="earth-reset" onPress={resetView} style={styles.resetBtn} hitSlop={8}>
            <Ionicons name="contract-outline" size={14} color={colors.onSurface} />
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.legendSub}>Trascina per ruotare · pizzica per zoomare · doppio tap su un&apos;Observation</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  header: { alignItems: "center", gap: 2 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  stage: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbWrap: { position: "absolute", borderWidth: 1.5, borderColor: colors.brand, overflow: "hidden", backgroundColor: "#000" },
  iconChip: { position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  legendPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  resetText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  legendSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center", paddingHorizontal: spacing.lg },
});
