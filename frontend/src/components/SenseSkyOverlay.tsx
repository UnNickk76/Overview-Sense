import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Line, Circle, Text as SvgText, G, Polygon } from "react-native-svg";
import type { SkyOverlay } from "@/src/lib/senseFrame";

interface Props {
  data: SkyOverlay;
  w: number;
  h: number;
  legendOn?: boolean;
  hiddenObj?: Set<string>;
  showConstNames?: boolean;   // render non-interactive constellation names (preview)
}

// The SINGLE celestial overlay renderer, shared by the live Sense Vision preview
// and the final saved photo. Given a frozen SkyOverlay (built by buildOverlay)
// it draws exactly the same stars, lines, figures, planets, satellites, ISS,
// Moon, Sun and galactic-center markers — pixel-consistent between the two.
export function SenseSkyOverlay({ data, w, h, legendOn = true, hiddenObj, showConstNames }: Props) {
  const hidden = hiddenObj ?? new Set<string>();
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      {data.figures.map((f) => f.poly ? (
        <Polygon key={`fig${f.c.key}`} points={f.poly} fill="#7FC0FF" opacity={0.1} />
      ) : null)}
      {data.lines.map((l, i) => (
        <Line key={`l${i}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="#7FC0FF" strokeWidth={1.3} opacity={0.75} />
      ))}
      {data.stars.map((s, i) => (
        <Circle key={`st${i}`} cx={s.x} cy={s.y} r={2.2} fill="#EAF2FF" />
      ))}
      {showConstNames ? data.figures.map((f) => (
        <SvgText key={`cn${f.c.key}`} x={f.cx} y={Math.max(12, f.cy - 34)} fill="#BFE0FF" fontSize={11} fontWeight="600" textAnchor="middle" opacity={0.9}>{f.c.name}</SvgText>
      )) : null}
      {data.planets.filter((pl) => !hidden.has(pl.name)).map((pl, i) => (
        <G key={`pl${i}`}>
          <Circle cx={pl.pt.x} cy={pl.pt.y} r={13} fill="#D4AF37" opacity={0.14} />
          <Circle cx={pl.pt.x} cy={pl.pt.y} r={7} stroke="#D4AF37" strokeWidth={1.2} fill="none" opacity={0.85} />
          <Circle cx={pl.pt.x} cy={pl.pt.y} r={2.4} fill="#D4AF37" />
          {legendOn ? (
            <>
              <Line x1={pl.pt.x} y1={pl.pt.y - 13} x2={pl.pt.x} y2={pl.pt.y - 27} stroke="#D4AF37" strokeWidth={1} opacity={0.65} />
              <SvgText x={pl.pt.x} y={pl.pt.y - 31} fill="#F0DC9A" fontSize={11} fontWeight="600" textAnchor="middle">{pl.name}</SvgText>
            </>
          ) : null}
        </G>
      ))}
      {data.satellites.filter((s) => !hidden.has(s.name)).map((s, i) => (
        <G key={`sat${i}`}>
          <Circle cx={s.pt.x} cy={s.pt.y} r={11} fill="#0A84FF" opacity={0.16} />
          <Circle cx={s.pt.x} cy={s.pt.y} r={2.2} fill="#8FD0FF" />
          {legendOn ? (
            <>
              <Line x1={s.pt.x} y1={s.pt.y - 11} x2={s.pt.x} y2={s.pt.y - 24} stroke="#8FD0FF" strokeWidth={1} opacity={0.6} />
              <SvgText x={s.pt.x} y={s.pt.y - 28} fill="#8FD0FF" fontSize={9.5} textAnchor="middle">{s.name}</SvgText>
            </>
          ) : null}
        </G>
      ))}
      {data.iss?.pt && !hidden.has("ISS") ? (
        <G>
          <Circle cx={data.iss.pt.x} cy={data.iss.pt.y} r={13} fill="#D4AF37" opacity={0.16} />
          <Circle cx={data.iss.pt.x} cy={data.iss.pt.y} r={7} fill="none" stroke="#D4AF37" strokeWidth={2} />
          {legendOn ? (
            <>
              <Line x1={data.iss.pt.x} y1={data.iss.pt.y - 13} x2={data.iss.pt.x} y2={data.iss.pt.y - 27} stroke="#D4AF37" strokeWidth={1} opacity={0.7} />
              <SvgText x={data.iss.pt.x} y={data.iss.pt.y - 31} fill="#F0DC9A" fontSize={11} fontWeight="700" textAnchor="middle">ISS</SvgText>
            </>
          ) : null}
        </G>
      ) : null}
      {data.moon && !hidden.has("Luna") ? <SvgText x={data.moon.x} y={data.moon.y} fill="#fff" fontSize={16}>☾</SvgText> : null}
      {data.gc ? <SvgText x={data.gc.x - 20} y={data.gc.y} fill="#F0C674" fontSize={10}>◄ Via Lattea</SvgText> : null}
    </Svg>
  );
}
