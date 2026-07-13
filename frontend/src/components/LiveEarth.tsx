import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { eventsApi, LiveEarthPoint } from "@/src/lib/backend";

const D2R = Math.PI / 180;

// Orthographic projection of (lat, lon) with the globe rotated to center longitude lon0.
function project(lat: number, lon: number, lon0: number) {
  const phi = lat * D2R;
  const dl = (lon - lon0) * D2R;
  const x = Math.cos(phi) * Math.sin(dl);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(dl); // >= 0 → facing viewer
  return { x, y, z };
}

// Pre-sampled graticule (meridians + parallels) as raw lat/lon vertices.
function buildGraticule() {
  const meridians: { lat: number; lon: number }[][] = [];
  for (let lon = -180; lon < 180; lon += 45) {
    const line: { lat: number; lon: number }[] = [];
    for (let lat = -90; lat <= 90; lat += 9) line.push({ lat, lon });
    meridians.push(line);
  }
  const parallels: { lat: number; lon: number }[][] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const line: { lat: number; lon: number }[] = [];
    for (let lon = -180; lon <= 180; lon += 9) line.push({ lat, lon });
    parallels.push(line);
  }
  return [...meridians, ...parallels];
}

interface Props { size?: number }

export function LiveEarth({ size = 240 }: Props) {
  const R = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const [points, setPoints] = useState<LiveEarthPoint[]>([]);
  const [meta, setMeta] = useState({ recent: 0, geo: 0, hours: 24 });
  const [lon0, setLon0] = useState(0);
  const [tick, setTick] = useState(0); // drives dot pulse
  const graticule = useMemo(buildGraticule, []);
  const mounted = useRef(true);

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
    const dataTimer = setInterval(fetchPoints, 60000); // refresh live data each minute
    return () => { mounted.current = false; clearInterval(dataTimer); };
  }, []);

  // Slow rotation + pulse clock.
  useEffect(() => {
    const t = setInterval(() => {
      setLon0((l) => (l + 2) % 360);
      setTick((k) => (k + 1) % 1000);
    }, 120);
    return () => clearInterval(t);
  }, []);

  const gratPaths = useMemo(() => {
    const paths: string[] = [];
    for (const line of graticule) {
      let d = "";
      let pen = false;
      for (const v of line) {
        const p = project(v.lat, v.lon, lon0);
        if (p.z >= -0.02) {
          const sx = cx + R * p.x;
          const sy = cy - R * p.y;
          d += (pen ? "L" : "M") + sx.toFixed(1) + " " + sy.toFixed(1) + " ";
          pen = true;
        } else {
          pen = false;
        }
      }
      if (d) paths.push(d.trim());
    }
    return paths;
  }, [graticule, lon0, R, cx, cy]);

  const dots = useMemo(() => {
    const phase = (tick % 12) / 12; // 0..1 pulse cycle
    return points.map((pt) => {
      const p = project(pt.lat, pt.lon, lon0);
      if (p.z < 0) return null;
      const sx = cx + R * p.x;
      const sy = cy - R * p.y;
      const edge = 0.4 + 0.6 * p.z; // fade near the limb
      const base = pt.intensity >= 50 ? colors.brand : colors.blue;
      const pulse = 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI + pt.lat);
      return { key: pt.id, sx, sy, color: base, edge, pulse };
    }).filter(Boolean) as { key: string; sx: number; sy: number; color: string; edge: number; pulse: number }[];
  }, [points, lon0, tick, R, cx, cy]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>🌍 Live Earth</Text>
        <Text style={styles.subtitle}>Il pianeta osservato in tempo reale</Text>
      </View>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="ocean" cx="38%" cy="34%" r="75%">
            <Stop offset="0%" stopColor="#12314f" />
            <Stop offset="55%" stopColor="#0a1c30" />
            <Stop offset="100%" stopColor="#05101c" />
          </RadialGradient>
          <RadialGradient id="atmo" cx="50%" cy="50%" r="50%">
            <Stop offset="82%" stopColor={colors.blue} stopOpacity={0} />
            <Stop offset="100%" stopColor={colors.blue} stopOpacity={0.35} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={R + 5} fill="url(#atmo)" />
        <Circle cx={cx} cy={cy} r={R} fill="url(#ocean)" stroke={colors.border} strokeWidth={1} />
        {gratPaths.map((d, i) => (
          <Path key={i} d={d} stroke={colors.blue} strokeWidth={0.6} strokeOpacity={0.25} fill="none" />
        ))}
        {dots.map((dpt) => (
          <React.Fragment key={dpt.key}>
            <Circle cx={dpt.sx} cy={dpt.sy} r={4 + 3 * dpt.pulse} fill={dpt.color} opacity={0.18 * dpt.edge} />
            <Circle cx={dpt.sx} cy={dpt.sy} r={2.2} fill={dpt.color} opacity={0.9 * dpt.edge} />
          </React.Fragment>
        ))}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendPill}>
          <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
          <Text style={styles.legendText}>{meta.geo} osservazioni geolocalizzate</Text>
        </View>
        <Text style={styles.legendSub}>{meta.recent} Observation nelle ultime {meta.hours}h</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.md },
  header: { alignItems: "center", gap: 2 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  legend: { alignItems: "center", gap: 4 },
  legendPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  legendSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
});
