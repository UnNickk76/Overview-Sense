import React from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop, RadialGradient, Ellipse } from "react-native-svg";

interface Props {
  width: number;
  height?: number;
}

// A thin, realistic curvature of the Earth seen from space (ISS-like limb):
// only the top arc of the planet, blue atmospheric glow, and a day/night
// terminator running left(lit)→right(shadow).
export function EarthLimb({ width, height = 220 }: Props) {
  const W = width;
  const R = 1200; // large radius = gentle curvature
  const cx = W / 2;
  const cy = R + 64; // push most of the sphere below the container
  const yAt = (x: number) => cy - Math.sqrt(Math.max(0, R * R - (x - cx) * (x - cx)));
  const yEdge = yAt(0);

  // planet cap path (fill down to bottom)
  const surface = `M 0 ${yEdge} A ${R} ${R} 0 0 1 ${W} ${yEdge} L ${W} ${height} L 0 ${height} Z`;
  // atmosphere arc (the limb line itself)
  const limb = `M 0 ${yEdge} A ${R} ${R} 0 0 1 ${W} ${yEdge}`;

  return (
    <View style={{ width: W, height, overflow: "hidden" }} pointerEvents="none">
      <Svg width={W} height={height}>
        <Defs>
          <LinearGradient id="terminator" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#1B3A5B" />
            <Stop offset="0.45" stopColor="#0B1E30" />
            <Stop offset="0.75" stopColor="#04080D" />
            <Stop offset="1" stopColor="#000000" />
          </LinearGradient>
          <RadialGradient id="atmoGlow" cx="50%" cy="100%" r="90%">
            <Stop offset="0.7" stopColor="#0A84FF" stopOpacity="0" />
            <Stop offset="0.93" stopColor="#3AA0FF" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#BFE4FF" stopOpacity="0.65" />
          </RadialGradient>
        </Defs>

        {/* atmospheric halo above the limb */}
        <Ellipse cx={cx} cy={cy} rx={R + 26} ry={R + 26} fill="url(#atmoGlow)" opacity={0.9} />
        {/* planet surface */}
        <Path d={surface} fill="url(#terminator)" />
        {/* bright atmosphere edge */}
        <Path d={limb} stroke="#BFE4FF" strokeWidth={1.4} fill="none" opacity={0.85} />
        <Path d={limb} stroke="#0A84FF" strokeWidth={5} fill="none" opacity={0.25} />
      </Svg>
    </View>
  );
}
