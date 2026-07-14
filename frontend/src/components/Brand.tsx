import React from "react";
import { Text, StyleProp, TextStyle, StyleSheet } from "react-native";
import { fonts } from "@/src/theme";

// Official OverView™ ecosystem product marks. Rendering these through <BrandName>
// guarantees a consistent trademark (™) superscript everywhere in the app.
export type BrandKey =
  | "OverView"
  | "Sense Vision"
  | "SnapSense"
  | "Pulse"
  | "Observe"
  | "OverView Guide"
  | "Challenges";

/** Small raised ™ that inherits the surrounding color. */
export function Tm({ style }: { style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.tm, style]}>™</Text>;
}

/** Renders an official product name with a consistent ™ mark. */
export function BrandName({
  name,
  style,
  mark = true,
}: {
  name: BrandKey | string;
  style?: StyleProp<TextStyle>;
  mark?: boolean;
}) {
  return (
    <Text style={style}>
      {name}
      {mark ? <Tm style={style} /> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  // ~0.62em, lifted toward the cap height — reads as a proper superscript on RN.
  tm: {
    fontSize: 9,
    lineHeight: 14,
    fontFamily: fonts.medium,
    textAlignVertical: "top",
    includeFontPadding: false as unknown as boolean,
  },
});
