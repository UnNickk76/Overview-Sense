import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Line, Circle, Text as SvgText, G, Polygon } from "react-native-svg";
import type { SkyOverlay } from "@/src/lib/senseFrame";

const AG = Animated.createAnimatedComponent(G);
const ACircle = Animated.createAnimatedComponent(Circle);

interface Props {
  data: SkyOverlay;
  w: number;
  h: number;
  legendOn?: boolean;          // text labels (names)
  hiddenObj?: Set<string>;     // per-object hide
  showConstNames?: boolean;    // render constellation names inside the overlay (preview)
  animate?: boolean;           // play the WOW reveal
  animKey?: string | number;   // change to replay the reveal
}

// The SINGLE celestial overlay renderer, shared by the live Sense Vision preview
// and the final saved photo. It draws exactly the same stars, lines, figures,
// planets, satellites, ISS, Moon, galactic-center — pixel-consistent between the
// two — and plays the signature Sense Vision™ "reveal": a discovery unfolding of
// what was invisible. Sequence (≈650ms, elegant & fast):
//   stars twinkle in → light impulse (ping) → constellation lines draw → names fade in.
//   planets: impulse ring → glowing halo → name.
export function SenseSkyOverlay({ data, w, h, legendOn = true, hiddenObj, showConstNames, animate = false, animKey }: Props) {
  const hidden = hiddenObj ?? new Set<string>();
  const anim = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) { anim.setValue(1); return; }
    anim.setValue(0);
    const a = Animated.timing(anim, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [animate, animKey, anim]);

  const oStars = anim.interpolate({ inputRange: [0, 0.22], outputRange: [0, 1], extrapolate: "clamp" });
  const oMarks = anim.interpolate({ inputRange: [0.05, 0.35], outputRange: [0, 1], extrapolate: "clamp" });
  const oLines = anim.interpolate({ inputRange: [0.3, 0.6], outputRange: [0, 1], extrapolate: "clamp" });
  const oFig = anim.interpolate({ inputRange: [0.45, 0.72], outputRange: [0, 1], extrapolate: "clamp" });
  const oLabels = anim.interpolate({ inputRange: [0.58, 0.9], outputRange: [0, 1], extrapolate: "clamp" });
  const pingR = anim.interpolate({ inputRange: [0.05, 0.4], outputRange: [4, 34], extrapolate: "clamp" });
  const pingO = anim.interpolate({ inputRange: [0.05, 0.18, 0.45], outputRange: [0, 0.6, 0], extrapolate: "clamp" });

  const planets = data.planets.filter((p) => !hidden.has(p.name));
  const sats = data.satellites.filter((s) => !hidden.has(s.name));
  const issShown = data.iss?.pt && !hidden.has("ISS") ? data.iss : null;
  const moonShown = data.moon && !hidden.has("Luna") ? data.moon : null;

  // Light-impulse ("il punto si accende") at each object's exact position.
  const pings: { x: number; y: number; c: string }[] = [
    ...planets.map((p) => ({ x: p.pt.x, y: p.pt.y, c: "#D4AF37" })),
    ...(issShown?.pt ? [{ x: issShown.pt.x, y: issShown.pt.y, c: "#D4AF37" }] : []),
    ...sats.map((s) => ({ x: s.pt.x, y: s.pt.y, c: "#8FD0FF" })),
    ...(moonShown ? [{ x: moonShown.x, y: moonShown.y, c: "#FFFFFF" }] : []),
  ];

  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Constellation light figures — appear late, very subtle */}
      <AG opacity={oFig}>
        {data.figures.map((f) => f.poly ? (
          <Polygon key={`fig${f.c.key}`} points={f.poly} fill="#7FC0FF" opacity={0.1} />
        ) : null)}
      </AG>

      {/* Constellation lines — draw after the stars */}
      <AG opacity={oLines}>
        {data.lines.map((l, i) => (
          <Line key={`l${i}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#7FC0FF" strokeWidth={1.3} opacity={0.75} />
        ))}
      </AG>

      {/* Stars light up first */}
      <AG opacity={oStars}>
        {data.stars.map((s, i) => (
          <Circle key={`st${i}`} cx={s.x} cy={s.y} r={2.2} fill="#EAF2FF" />
        ))}
      </AG>

      {/* Light impulse at each recognized object */}
      {pings.map((m, i) => (
        <ACircle key={`ping${i}`} cx={m.x} cy={m.y} r={pingR} fill="none" stroke={m.c} strokeWidth={1.5} opacity={pingO} />
      ))}

      {/* Object marks (dots / halos) */}
      <AG opacity={oMarks}>
        {planets.map((pl, i) => (
          <G key={`pl${i}`}>
            <Circle cx={pl.pt.x} cy={pl.pt.y} r={13} fill="#D4AF37" opacity={0.14} />
            <Circle cx={pl.pt.x} cy={pl.pt.y} r={7} stroke="#D4AF37" strokeWidth={1.2} fill="none" opacity={0.85} />
            <Circle cx={pl.pt.x} cy={pl.pt.y} r={2.4} fill="#D4AF37" />
          </G>
        ))}
        {sats.map((s, i) => (
          <G key={`sat${i}`}>
            <Circle cx={s.pt.x} cy={s.pt.y} r={11} fill="#0A84FF" opacity={0.16} />
            <Circle cx={s.pt.x} cy={s.pt.y} r={2.2} fill="#8FD0FF" />
          </G>
        ))}
        {issShown?.pt ? (
          <G>
            <Circle cx={issShown.pt.x} cy={issShown.pt.y} r={13} fill="#D4AF37" opacity={0.16} />
            <Circle cx={issShown.pt.x} cy={issShown.pt.y} r={7} fill="none" stroke="#D4AF37" strokeWidth={2} />
          </G>
        ) : null}
        {moonShown ? <SvgText x={moonShown.x} y={moonShown.y} fill="#fff" fontSize={16}>☾</SvgText> : null}
      </AG>

      {/* Names — appear last */}
      {legendOn ? (
        <AG opacity={oLabels}>
          {planets.map((pl, i) => (
            <G key={`pll${i}`}>
              <Line x1={pl.pt.x} y1={pl.pt.y - 13} x2={pl.pt.x} y2={pl.pt.y - 27} stroke="#D4AF37" strokeWidth={1} opacity={0.65} />
              <SvgText x={pl.pt.x} y={pl.pt.y - 31} fill="#F0DC9A" fontSize={11} fontWeight="600" textAnchor="middle">{pl.name}</SvgText>
            </G>
          ))}
          {sats.map((s, i) => (
            <G key={`satl${i}`}>
              <Line x1={s.pt.x} y1={s.pt.y - 11} x2={s.pt.x} y2={s.pt.y - 24} stroke="#8FD0FF" strokeWidth={1} opacity={0.6} />
              <SvgText x={s.pt.x} y={s.pt.y - 28} fill="#8FD0FF" fontSize={9.5} textAnchor="middle">{s.name}</SvgText>
            </G>
          ))}
          {issShown?.pt ? (
            <G>
              <Line x1={issShown.pt.x} y1={issShown.pt.y - 13} x2={issShown.pt.x} y2={issShown.pt.y - 27} stroke="#D4AF37" strokeWidth={1} opacity={0.7} />
              <SvgText x={issShown.pt.x} y={issShown.pt.y - 31} fill="#F0DC9A" fontSize={11} fontWeight="700" textAnchor="middle">ISS</SvgText>
            </G>
          ) : null}
          {showConstNames ? data.figures.map((f) => (
            <SvgText key={`cn${f.c.key}`} x={f.cx} y={Math.max(12, f.cy - 34)} fill="#BFE0FF" fontSize={11} fontWeight="600" textAnchor="middle" opacity={0.9}>{f.c.name}</SvgText>
          )) : null}
          {data.gc ? <SvgText x={data.gc.x - 20} y={data.gc.y} fill="#F0C674" fontSize={10}>◄ Via Lattea</SvgText> : null}
        </AG>
      ) : null}
    </Svg>
  );
}
