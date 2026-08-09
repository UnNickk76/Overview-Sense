import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { colors } from "@/src/theme";
import { CONTINENTS } from "@/src/lib/continents";

const D2R = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface GlobeCtx {
  proj: (lat: number, lon: number) => { sx: number; sy: number; z: number };
  cx: number; cy: number; Rz: number; zoom: number; tick: number;
}
export interface GlobeHandle {
  focus: (lat: number, lon: number, zoomMul?: number) => void;
  reset: () => void;
}

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

interface Props {
  size: number;
  onInteracting?: (active: boolean) => void;
  initialLon?: number;
  initialLat?: number;
  maxZoom?: number;
  overlay?: (ctx: GlobeCtx) => React.ReactNode;
  onTap?: (x: number, y: number, ctx: GlobeCtx) => void;
  onDoubleTap?: (x: number, y: number, ctx: GlobeCtx) => void;
}

/**
 * Shared, stable Earth for OverView (used by Observe → Live Earth and
 * Ecoes → Ecoes Globe). It owns the sphere, continents, slow auto-rotation,
 * manual drag rotation and pinch-to-zoom, and a stable orthographic projection.
 * Consumers only add their own layer via `overlay(ctx)` (observation dots,
 * Ecoes pulsations, …) — never touching the globe geometry.
 */
export const GlobeBase = forwardRef<GlobeHandle, Props>(function GlobeBase(
  { size, onInteracting, initialLon = 20, initialLat = 18, maxZoom = 12, overlay, onTap, onDoubleTap }, ref,
) {
  const baseR = size / 2 - 6;
  const cx = size / 2, cy = size / 2;

  const [lon0, setLon0] = useState(initialLon);
  const [lat0, setLat0] = useState(initialLat);
  const [zoom, setZoom] = useState(1);
  const [tick, setTick] = useState(0);

  const lonRef = useRef(initialLon); const latRef = useRef(initialLat); const zoomRef = useRef(1);
  const startLon = useRef(initialLon); const startLat = useRef(initialLat); const startZoom = useRef(1);
  const idleRef = useRef(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graticule = useMemo(buildGraticule, []);
  const ctxRef = useRef<GlobeCtx | null>(null);

  const setLonV = (v: number) => { lonRef.current = v; setLon0(v); };
  const setLatV = (v: number) => { latRef.current = v; setLat0(v); };
  const setZoomV = (v: number) => { zoomRef.current = v; setZoom(v); };

  useEffect(() => {
    const t = setInterval(() => {
      if (idleRef.current) setLonV((lonRef.current + 0.15) % 360);
      setTick((k) => (k + 1) % 100000);
    }, 60);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = () => { idleRef.current = false; onInteracting?.(true); if (resumeTimer.current) clearTimeout(resumeTimer.current); };
  const resumeSoon = () => { onInteracting?.(false); if (resumeTimer.current) clearTimeout(resumeTimer.current); resumeTimer.current = setTimeout(() => { idleRef.current = true; }, 2500); };

  const beginPan = () => { pause(); startLon.current = lonRef.current; startLat.current = latRef.current; };
  const updatePan = (tx: number, ty: number) => {
    const k = 0.3 / zoomRef.current;
    setLonV((startLon.current - tx * k) % 360);
    setLatV(clamp(startLat.current + ty * k, -85, 85));
  };
  const beginPinch = () => { pause(); startZoom.current = zoomRef.current; };
  const updatePinch = (s: number) => setZoomV(clamp(startZoom.current * s, 1, maxZoom));

  useImperativeHandle(ref, () => ({
    focus: (lat: number, lon: number, zoomMul = 2) => {
      pause();
      setLonV(lon); setLatV(clamp(lat, -85, 85));
      setZoomV(clamp(zoomRef.current * zoomMul, 1, maxZoom));
      resumeSoon();
    },
    reset: () => { setZoomV(1); resumeSoon(); },
  }));

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

  const ctx: GlobeCtx = { proj, cx, cy, Rz, zoom, tick };
  ctxRef.current = ctx;

  const contPaths = useMemo(() => {
    const paths: string[] = [];
    for (const ring of CONTINENTS) {
      let d = ""; let pen = false;
      for (const [lon, lat] of ring) {
        const p = proj(lat, lon);
        if (p.z >= -0.03) { d += (pen ? "L" : "M") + p.sx.toFixed(1) + " " + p.sy.toFixed(1) + " "; pen = true; }
        else pen = false;
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

  const gesture = useMemo(() => {
    const pan = Gesture.Pan().onBegin(() => runOnJS(beginPan)())
      .onUpdate((e) => runOnJS(updatePan)(e.translationX, e.translationY))
      .onEnd(() => runOnJS(resumeSoon)());
    const pinch = Gesture.Pinch().onBegin(() => runOnJS(beginPinch)())
      .onUpdate((e) => runOnJS(updatePinch)(e.scale))
      .onEnd(() => runOnJS(resumeSoon)());
    const moving = Gesture.Simultaneous(pan, pinch);
    const gs: ReturnType<typeof Gesture.Race>[] | any[] = [];
    const tapFns: any[] = [];
    if (onDoubleTap) {
      tapFns.push(Gesture.Tap().numberOfTaps(2).maxDuration(320)
        .onEnd((e) => { const c = ctxRef.current; if (c) runOnJS(onDoubleTap)(e.x, e.y, c); }));
    }
    if (onTap) {
      tapFns.push(Gesture.Tap().numberOfTaps(1).maxDuration(260)
        .onEnd((e) => { const c = ctxRef.current; if (c) runOnJS(onTap)(e.x, e.y, c); }));
    }
    if (tapFns.length === 0) return moving;
    return Gesture.Exclusive(...tapFns, moving);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTap, onDoubleTap]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="gb_ocean" cx="38%" cy="32%" r="80%">
              <Stop offset="0%" stopColor="#0d2947" />
              <Stop offset="55%" stopColor="#071a2e" />
              <Stop offset="100%" stopColor="#030c16" />
            </RadialGradient>
            <RadialGradient id="gb_atmo" cx="50%" cy="50%" r="50%">
              <Stop offset="80%" stopColor={colors.blue} stopOpacity={0} />
              <Stop offset="100%" stopColor={colors.blue} stopOpacity={0.4} />
            </RadialGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={Rz + 5} fill="url(#gb_atmo)" />
          <Circle cx={cx} cy={cy} r={Rz} fill="url(#gb_ocean)" stroke={colors.border} strokeWidth={1} />
          {gratPaths.map((d, i) => (
            <Path key={`g${i}`} d={d} stroke={colors.blue} strokeWidth={0.5} strokeOpacity={0.18} fill="none" />
          ))}
          {contPaths.map((d, i) => (
            <Path key={`c${i}`} d={d} stroke={colors.brand} strokeWidth={zoom >= 2 ? 1.2 : 0.9}
              strokeOpacity={0.85} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {overlay ? overlay(ctx) : null}
        </Svg>
      </View>
    </GestureDetector>
  );
});
