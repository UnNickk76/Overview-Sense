import React from "react";
import { StyleSheet, View, Text } from "react-native";
import Svg, { Circle, Rect, Line, Path, G } from "react-native-svg";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { azDelta } from "@/src/lib/guidance";

/**
 * SenseRadar — intelligent framing + orientation guide for Sense Vision.
 * • Zoom mode: a 1× frame with a golden rectangle marking the area actually
 *   observed at high zoom, so you never lose track of where you're pointing.
 * • Guide mode: a compass showing where a requested target is relative to the
 *   direction you're facing (drives OverView Guide™).
 * Designed to grow into full tracking/OverView Guide integration.
 */
export function SenseRadar({
  zoom = 1,
  heading = 0,
  target,
  size = 96,
}: {
  zoom?: number;
  heading?: number;
  target?: { az: number; alt: number; name?: string } | null;
  size?: number;
}) {
  const inner = Math.max(0.06, 1 / Math.max(1, zoom)); // fraction of frame observed
  const pad = 8;
  const box = size - pad * 2;
  const iw = box * inner;

  const c = size / 2;
  const ringR = size / 2 - 8;
  const rel = target ? azDelta(target.az, heading) : 0; // deg from facing dir
  const relRad = (rel - 90) * (Math.PI / 180); // 0 rel => top
  const dotX = c + ringR * Math.cos(relRad);
  const dotY = c + ringR * Math.sin(relRad);
  const behind = target ? Math.abs(rel) > 135 : false;

  return (
    <View style={styles.wrap}>
      {target ? (
        // Guide compass
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle cx={c} cy={c} r={ringR} stroke={colors.brand} strokeOpacity={0.3} strokeWidth={1.5} fill="rgba(0,0,0,0.25)" />
            {/* facing direction (up) */}
            <Path d={`M ${c} ${c - ringR - 1} l -4 7 l 8 0 z`} fill={colors.onSurfaceSecondary} />
            {/* target dot */}
            <G>
              <Circle cx={dotX} cy={dotY} r={5} fill={colors.brand} />
              <Line x1={c} y1={c} x2={dotX} y2={dotY} stroke={colors.brand} strokeOpacity={0.5} strokeWidth={1.2} />
            </G>
            <Circle cx={c} cy={c} r={2.5} fill={colors.onSurface} />
          </Svg>
          <Text style={styles.caption} numberOfLines={1}>
            {behind ? "dietro di te" : target.name || "target"}
          </Text>
        </View>
      ) : (
        // Zoom framing radar
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Rect x={pad} y={pad} width={box} height={box} rx={4} stroke={colors.onSurfaceSecondary} strokeWidth={1.5} fill="rgba(0,0,0,0.3)" />
            <Rect x={c - iw / 2} y={c - iw / 2} width={iw} height={iw} rx={2} stroke={colors.brand} strokeWidth={2} fill="rgba(212,175,55,0.15)" />
          </Svg>
          <Text style={styles.caption}>{zoom.toFixed(zoom < 10 ? 1 : 0)}×</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: radius.md, padding: spacing.xs, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  caption: { position: "absolute", bottom: 2, alignSelf: "center", color: colors.brand, fontFamily: fonts.mono, fontSize: type.sm - 4, letterSpacing: 0.5 },
});
