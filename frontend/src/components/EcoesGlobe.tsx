import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Circle, Defs, Path, RadialGradient, Stop, ClipPath, G } from "react-native-svg";
import { colors } from "@/src/theme";
import { CONTINENTS } from "@/src/lib/continents";
import { EcoesConn } from "@/src/lib/backend";

const D2R = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MAX_ZOOM = 12; // high enough to separate very close Connections

// Real subsolar point (approx) — drives day/night illumination from actual UTC.
function subsolarPoint(now: Date) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = (now.getTime() - start) / 86400000;
  const decl = 23.44 * Math.sin(2 * Math.PI * (dayOfYear - 80) / 365.24); // solar declination
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const lon = -(utcHours - 12) * 15; // where it is local solar noon
  return { lat: decl, lon: ((lon + 540) % 360) - 180 };
}

type Cluster = { sx: number; sy: number; members: { conn: EcoesConn; lat: number; lon: number }[]; meanLat: number; meanLon: number; intensity: number };

export function EcoesGlobe({ items, size, onSelect, onInteracting }: {
  items: EcoesConn[]; size: number; onSelect: (c: EcoesConn) => void; onInteracting?: (active: boolean) => void;
}) {
  const baseR = size * 0.46;
  const cx = size / 2, cy = size / 2;

  const [lon0, setLon0] = useState(20);
  const [lat0, setLat0] = useState(16);
  const [zoom, setZoom] = useState(1);
  const [tick, setTick] = useState(0);

  const lonRef = useRef(lon0); lonRef.current = lon0;
  const latRef = useRef(lat0); latRef.current = lat0;
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const idleRef = useRef(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startLon = useRef(0), startLat = useRef(0), startZoom = useRef(1);
  const clustersRef = useRef<Cluster[]>([]);

  // Continuous, very slow, elegant rotation — a living planet.
  useEffect(() => {
    const t = setInterval(() => {
      if (idleRef.current) { setLon0((l) => { const nv = (l + 0.12) % 360; lonRef.current = nv; return nv; }); }
      setTick((k) => (k + 1) % 100000);
    }, 60);
    return () => clearInterval(t);
  }, []);

  const pause = () => { idleRef.current = false; onInteracting?.(true); if (resumeTimer.current) clearTimeout(resumeTimer.current); };
  const resumeSoon = () => { onInteracting?.(false); if (resumeTimer.current) clearTimeout(resumeTimer.current); resumeTimer.current = setTimeout(() => { idleRef.current = true; }, 2500); };

  const beginPan = () => { pause(); startLon.current = lonRef.current; startLat.current = latRef.current; };
  const updatePan = (tx: number, ty: number) => {
    const k = 0.3 / zoomRef.current;
    setLon0((startLon.current - tx * k) % 360);
    setLat0(clamp(startLat.current + ty * k, -85, 85));
  };
  const beginPinch = () => { pause(); startZoom.current = zoomRef.current; };
  const updatePinch = (s: number) => setZoom(clamp(startZoom.current * s, 1, MAX_ZOOM));

  const onTap = (x: number, y: number) => {
    const thr = 24;
    const hits = clustersRef.current
      .map((c) => ({ c, dist: Math.hypot(c.sx - x, c.sy - y) }))
      .filter((h) => h.dist < thr + h.c.members.length * 2)
      .sort((a, b) => a.dist - b.dist);
    if (hits.length === 0) return;
    const cl = hits[0].c;
    if (cl.members.length === 1) {
      onSelect(cl.members[0].conn);
    } else {
      // A merged eco → zoom in toward it so the pulsations separate naturally.
      pause();
      setLon0(cl.meanLon); lonRef.current = cl.meanLon;
      setLat0(clamp(cl.meanLat, -85, 85)); latRef.current = clamp(cl.meanLat, -85, 85);
      setZoom((z) => clamp(z * 2.1, 1, MAX_ZOOM));
      resumeSoon();
    }
  };

  const gesture = useMemo(() => {
    const pan = Gesture.Pan().onBegin(() => runOnJS(beginPan)())
      .onUpdate((e) => runOnJS(updatePan)(e.translationX, e.translationY))
      .onEnd(() => runOnJS(resumeSoon)());
    const pinch = Gesture.Pinch().onBegin(() => runOnJS(beginPinch)())
      .onUpdate((e) => runOnJS(updatePinch)(e.scale))
      .onEnd(() => runOnJS(resumeSoon)());
    const tap = Gesture.Tap().maxDuration(260).onEnd((e) => runOnJS(onTap)(e.x, e.y));
    return Gesture.Exclusive(tap, Gesture.Simultaneous(pan, pinch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Physical geography only — filled landmasses, NO borders/labels/cities.
  const landPaths = useMemo(() => {
    const paths: string[] = [];
    for (const ring of CONTINENTS) {
      let d = ""; let pen = false;
      for (const [lon, lat] of ring) {
        const p = proj(lat, lon);
        if (p.z >= -0.02) { d += (pen ? "L" : "M") + p.sx.toFixed(1) + " " + p.sy.toFixed(1) + " "; pen = true; }
        else pen = false;
      }
      if (d) paths.push(d.trim() + " Z");
    }
    return paths;
  }, [proj]);

  // Sun-driven day/night: gradient centred on the projected subsolar point.
  const sun = useMemo(() => {
    const s = subsolarPoint(new Date());
    const p = proj(s.lat, s.lon);
    return { sx: p.sx, sy: p.sy, z: p.z };
  }, [proj]);
  // When the sun is on the far side, darkness dominates the visible disc.
  const dayCx = sun.z > -0.15 ? `${clamp((sun.sx / size) * 100, -20, 120)}%` : "50%";
  const dayCy = sun.z > -0.15 ? `${clamp((sun.sy / size) * 100, -20, 120)}%` : "50%";
  const nightStrength = sun.z > 0.1 ? 0.55 : sun.z > -0.15 ? 0.72 : 0.88;

  // Cluster nearby Connections into a single glow (no numbers). Separate on zoom.
  const clusters = useMemo(() => {
    const thr = 26;
    const visible = items.map((c) => {
      const p = proj(c.lat, c.lon);
      return p.z >= 0.02 ? { conn: c, sx: p.sx, sy: p.sy, lat: c.lat, lon: c.lon, z: p.z } : null;
    }).filter(Boolean) as { conn: EcoesConn; sx: number; sy: number; lat: number; lon: number; z: number }[];

    const cls: Cluster[] = [];
    for (const v of visible) {
      const near = cls.find((c) => Math.hypot(c.sx - v.sx, c.sy - v.sy) < thr);
      if (near) {
        near.members.push({ conn: v.conn, lat: v.lat, lon: v.lon });
        const n = near.members.length;
        near.sx = (near.sx * (n - 1) + v.sx) / n;
        near.sy = (near.sy * (n - 1) + v.sy) / n;
        near.meanLat = (near.meanLat * (n - 1) + v.lat) / n;
        near.meanLon = (near.meanLon * (n - 1) + v.lon) / n;
        near.intensity = Math.max(near.intensity, v.conn.intensity);
      } else {
        cls.push({ sx: v.sx, sy: v.sy, meanLat: v.lat, meanLon: v.lon, intensity: v.conn.intensity, members: [{ conn: v.conn, lat: v.lat, lon: v.lon }] });
      }
    }
    clustersRef.current = cls;
    return cls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, proj]);

  const phase = (tick % 22) / 22;

  return (
    <View style={{ width: size, height: size }}>
      <GestureDetector gesture={gesture}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="ec_ocean" cx="42%" cy="34%" r="82%">
                <Stop offset="0%" stopColor="#12365f" />
                <Stop offset="55%" stopColor="#0a2036" />
                <Stop offset="100%" stopColor="#04101d" />
              </RadialGradient>
              <RadialGradient id="ec_atmo" cx="50%" cy="50%" r="50%">
                <Stop offset="82%" stopColor={colors.blue} stopOpacity={0} />
                <Stop offset="100%" stopColor={colors.blue} stopOpacity={0.45} />
              </RadialGradient>
              <RadialGradient id="ec_day" cx={dayCx} cy={dayCy} r="75%">
                <Stop offset="0%" stopColor="#000814" stopOpacity={0} />
                <Stop offset="48%" stopColor="#000814" stopOpacity={0} />
                <Stop offset="72%" stopColor="#020914" stopOpacity={nightStrength * 0.7} />
                <Stop offset="100%" stopColor="#01060f" stopOpacity={nightStrength} />
              </RadialGradient>
              <ClipPath id="ec_clip"><Circle cx={cx} cy={cy} r={Rz} /></ClipPath>
            </Defs>

            <Circle cx={cx} cy={cy} r={Rz + 6} fill="url(#ec_atmo)" />
            <Circle cx={cx} cy={cy} r={Rz} fill="url(#ec_ocean)" stroke="rgba(88,166,255,0.35)" strokeWidth={1} />
            <G clipPath="url(#ec_clip)">
              {landPaths.map((d, i) => (
                <Path key={`l${i}`} d={d} fill="rgba(120,150,120,0.30)" stroke="rgba(150,180,150,0.35)" strokeWidth={0.6} strokeLinejoin="round" />
              ))}
              {/* real sun illumination overlay */}
              <Circle cx={cx} cy={cy} r={Rz} fill="url(#ec_day)" />
            </G>

            {clusters.map((c, i) => {
              const many = c.members.length > 1;
              const strong = c.intensity >= 0.45;
              const color = strong ? colors.brand : colors.blue;
              const pulse = 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI + i);
              const core = many ? 3.2 + Math.min(4, c.members.length) : 2.8;
              const halo = (many ? 8 + Math.min(10, c.members.length * 1.6) : 6) + 3 * pulse;
              return (
                <React.Fragment key={many ? `cl${i}` : c.members[0].conn.id}>
                  <Circle cx={c.sx} cy={c.sy} r={halo} fill={color} opacity={0.16 + 0.12 * pulse} />
                  <Circle cx={c.sx} cy={c.sy} r={core} fill={color} opacity={0.95} />
                  {many ? <Circle cx={c.sx} cy={c.sy} r={core + 3} fill="none" stroke={color} strokeWidth={0.8} opacity={0.5} /> : null}
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({});
