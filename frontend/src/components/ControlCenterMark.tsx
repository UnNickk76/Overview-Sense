import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { colors } from "@/src/theme";

// Control Center™ mark — a mission-control / observatory glyph (NOT a gear).
// Concentric radar rings, a sweeping arc and a bright core: OverView's "command cabin".
export function ControlCenterMark({ size = 26, color = colors.brand, active = false }: { size?: number; color?: string; active?: boolean }) {
  const c = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.4} fill={active ? color : "none"} opacity={active ? 0.14 : 1} />
        <Circle cx={12} cy={12} r={6} stroke={color} strokeWidth={1.1} fill="none" opacity={0.75} />
        {/* radar sweep */}
        <Path d="M12 12 L12 2 A10 10 0 0 1 20.5 7 Z" fill={color} opacity={0.18} />
        {/* crosshair ticks */}
        <Line x1={12} y1={0.5} x2={12} y2={3} stroke={color} strokeWidth={1.2} />
        <Line x1={12} y1={21} x2={12} y2={23.5} stroke={color} strokeWidth={1.2} />
        <Line x1={0.5} y1={12} x2={3} y2={12} stroke={color} strokeWidth={1.2} />
        <Line x1={21} y1={12} x2={23.5} y2={12} stroke={color} strokeWidth={1.2} />
        <Circle cx={12} cy={12} r={2.1} fill={color} />
      </Svg>
    </View>
  );
}
