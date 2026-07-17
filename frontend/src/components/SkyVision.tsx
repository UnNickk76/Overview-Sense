import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Circle, Polygon } from "react-native-svg";
import { CONSTELLATIONS, Constellation } from "@/src/lib/constellations";
import { colors, fonts, type } from "@/src/theme";

export interface Layers {
  name: boolean;
  stars: boolean;
  lines: boolean;
  figure: boolean;
  info: boolean;
}

export const DEFAULT_LAYERS: Layers = { name: true, stars: true, lines: true, figure: true, info: true };

type Pt = { x: number; y: number };

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

// Renders every constellation whose stars are currently in frame, each with its
// own one-shot WOW reveal. Positions keep updating live; the intro plays once.
export function ConstellationLayer({ points, layers, onTapStar, onTapConstellation }: {
  points: Map<string, Pt>;
  layers: Layers;
  onTapStar?: (name: string) => void;
  onTapConstellation?: (c: Constellation) => void;
}) {
  const active = useMemo(() => {
    const visible = new Set(points.keys());
    return CONSTELLATIONS.filter((c) => {
      const present = c.stars.filter((s) => visible.has(s)).length;
      const need = c.stars.length <= 3 ? c.stars.length : Math.max(3, Math.ceil(c.stars.length * 0.5));
      return present >= need;
    });
  }, [points]);

  return (
    <>
      {active.map((c) => (
        <ConstellationView key={c.key} c={c} points={points} layers={layers}
          onTapStar={onTapStar} onTapConstellation={onTapConstellation} />
      ))}
    </>
  );
}

function ConstellationView({ c, points, layers, onTapStar, onTapConstellation }: {
  c: Constellation; points: Map<string, Pt>; layers: Layers;
  onTapStar?: (name: string) => void; onTapConstellation?: (c: Constellation) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 1050, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [c.key, anim]);

  const starPts = c.stars.map((n) => ({ n, p: points.get(n) })).filter((s) => s.p) as { n: string; p: Pt }[];
  if (starPts.length < 2) return null;

  const lineSegs = c.lines
    .map(([a, b]) => ({ a: points.get(a), b: points.get(b) }))
    .filter((l) => l.a && l.b) as { a: Pt; b: Pt }[];

  const figurePts = c.figure.map((n) => points.get(n)).filter(Boolean) as Pt[];
  const centroid = starPts.reduce((acc, s) => ({ x: acc.x + s.p.x, y: acc.y + s.p.y }), { x: 0, y: 0 });
  centroid.x /= starPts.length; centroid.y /= starPts.length;

  const nameOpacity = anim.interpolate({ inputRange: [0, 0.16], outputRange: [0, 1], extrapolate: "clamp" });
  const figureOpacity = anim.interpolate({ inputRange: [0.78, 1], outputRange: [0, 0.16], extrapolate: "clamp" });

  const stageOpacity = (start: number) =>
    anim.interpolate({ inputRange: [start, Math.min(1, start + 0.1)], outputRange: [0, 1], extrapolate: "clamp" });
  const stageScale = (start: number) =>
    anim.interpolate({ inputRange: [start, Math.min(1, start + 0.14)], outputRange: [0.2, 1], extrapolate: "clamp" });

  return (
    <>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Light figure — generated from the real stars, drawn like light */}
        {layers.figure && figurePts.length >= 3 ? (
          <AnimatedPolygon
            points={figurePts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={colors.brand} opacity={figureOpacity}
          />
        ) : null}

        {/* Constellation lines — reveal one after another (the light pulse) */}
        {layers.lines ? lineSegs.map((l, i) => {
          const t = 0.4 + (i / Math.max(1, lineSegs.length)) * 0.42;
          return (
            <AnimatedLine key={`l${i}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y}
              stroke="#7FC0FF" strokeWidth={1.4} opacity={stageOpacity(t)} />
          );
        }) : null}

        {/* Highlighted stars — light up one by one */}
        {layers.stars ? starPts.map((s, i) => {
          const t = 0.12 + (i / Math.max(1, starPts.length)) * 0.34;
          const op = stageOpacity(t);
          const sc = stageScale(t);
          return (
            <React.Fragment key={s.n}>
              <AnimatedCircle cx={s.p.x} cy={s.p.y} r={7} fill="#BFE0FF" opacity={Animated.multiply(op, 0.28)} />
              <AnimatedCircle cx={s.p.x} cy={s.p.y} r={2.6} fill="#EAF4FF"
                opacity={op} style={{ transform: [{ scale: sc }] }} />
            </React.Fragment>
          );
        }) : null}
      </Svg>

      {/* Star hit targets */}
      {layers.stars && onTapStar ? starPts.map((s) => (
        <Pressable key={`h${s.n}`} testID={`star-${s.n}`} onPress={() => onTapStar(s.n)}
          style={[styles.starHit, { left: s.p.x - 16, top: s.p.y - 16 }]} hitSlop={8} />
      )) : null}

      {/* Constellation name */}
      {layers.name ? (
        <Animated.View style={[styles.nameWrap, { left: centroid.x - 90, top: centroid.y - 58, opacity: nameOpacity }]}>
          <Pressable testID={`const-${c.key}`} style={styles.namePill} onPress={() => onTapConstellation?.(c)} disabled={!onTapConstellation}>
            <Text style={styles.nameText}>{c.name}</Text>
            {layers.info && onTapConstellation ? <Text style={styles.nameHint}>Tap · Sense Summary™</Text> : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  starHit: { position: "absolute", width: 32, height: 32 },
  nameWrap: { position: "absolute", width: 180, alignItems: "center" },
  namePill: { backgroundColor: "rgba(10,12,18,0.66)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(127,192,255,0.5)" },
  nameText: { color: "#EAF4FF", fontFamily: fonts.semibold, fontSize: type.base, letterSpacing: 1 },
  nameHint: { color: "rgba(127,192,255,0.85)", fontFamily: fonts.mono, fontSize: 9, marginTop: 1 },
});
