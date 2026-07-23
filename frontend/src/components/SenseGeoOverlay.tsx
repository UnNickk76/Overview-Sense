import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Line, Circle, Text as SvgText, G, Path } from "react-native-svg";
import { project } from "@/src/lib/project";
import type { PlaceItem } from "@/src/lib/places";

const AG = Animated.createAnimatedComponent(G);
const ACircle = Animated.createAnimatedComponent(Circle);

const TEAL = "#63E6C7";
const TEAL_DIM = "rgba(99,230,199,0.16)";

interface Props {
  places: PlaceItem[];
  camAz: number;
  camAlt: number;
  w: number;
  h: number;
  fovH: number;
  legendOn?: boolean;
  hiddenObj?: Set<string>;
  animate?: boolean;
  animKey?: string | number;
}

// Terrestrial Sense Vision layer: reveals real geographic features (cities,
// mountains, monuments…) in the observed direction, using the SAME projection
// pipeline as the celestial overlay. Positions are real (GPS + bearing +
// curvature-aware elevation) — nothing is invented. Distinct teal identity vs
// the gold celestial markers.
export function SenseGeoOverlay({ places, camAz, camAlt, w, h, fovH, legendOn = true, hiddenObj, animate = false, animKey }: Props) {
  const hidden = hiddenObj ?? new Set<string>();
  const anim = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) { anim.setValue(1); return; }
    anim.setValue(0);
    const a = Animated.timing(anim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [animate, animKey, anim]);

  const oMarks = anim.interpolate({ inputRange: [0.05, 0.35], outputRange: [0, 1], extrapolate: "clamp" });
  const oLabels = anim.interpolate({ inputRange: [0.5, 0.85], outputRange: [0, 1], extrapolate: "clamp" });
  const pingR = anim.interpolate({ inputRange: [0.05, 0.4], outputRange: [4, 30], extrapolate: "clamp" });
  const pingO = anim.interpolate({ inputRange: [0.05, 0.18, 0.45], outputRange: [0, 0.55, 0], extrapolate: "clamp" });

  // Project all visible places; terrestrial features are NOT occluded by the
  // horizon check (they sit on the ground) — visibility depends only on framing.
  const marks = places
    .filter((p) => !hidden.has(p.name))
    .map((p) => ({ p, pt: project(p.az, p.alt, camAz, camAlt, w, h, fovH) }))
    .filter((m) => m.pt) as { p: PlaceItem; pt: { x: number; y: number } }[];

  if (marks.length === 0) return null;

  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {marks.map((m, i) => (
        <ACircle key={`gp${i}`} cx={m.pt.x} cy={m.pt.y} r={pingR} fill="none" stroke={TEAL} strokeWidth={1.4} opacity={pingO} />
      ))}
      <AG opacity={oMarks}>
        {marks.map((m, i) => (
          <G key={`gm${i}`}>
            <Circle cx={m.pt.x} cy={m.pt.y} r={9} fill={TEAL_DIM} />
            {/* ground pin */}
            <Path d={`M ${m.pt.x} ${m.pt.y - 9} L ${m.pt.x - 4} ${m.pt.y - 16} L ${m.pt.x + 4} ${m.pt.y - 16} Z`} fill={TEAL} opacity={0.9} />
            <Circle cx={m.pt.x} cy={m.pt.y} r={2.4} fill={TEAL} />
          </G>
        ))}
      </AG>
      {legendOn ? (
        <AG opacity={oLabels}>
          {marks.map((m, i) => (
            <G key={`gl${i}`}>
              <SvgText x={m.pt.x} y={m.pt.y - 20} fill="#CFF7EC" fontSize={10.5} fontWeight="600" textAnchor="middle">{m.p.name}</SvgText>
              <SvgText x={m.pt.x} y={m.pt.y + 18} fill="rgba(207,247,236,0.7)" fontSize={8} textAnchor="middle">{m.p.distanceKm} km</SvgText>
            </G>
          ))}
        </AG>
      ) : null}
    </Svg>
  );
}
