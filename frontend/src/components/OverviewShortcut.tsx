import React from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";
import { expandNav } from "@/src/lib/navState";

// The golden "O" mark → launcher of the global OverView navigation (the 8-item
// BottomNav). Placed top-right in section/detail headers for one-tap access.
const RING = require("@/assets/images/icon-ring.png");

export function OverviewShortcut({ size = 28, style }: { size?: number; style?: ViewStyle }) {
  const box = size + 12;
  return (
    <Pressable
      testID="overview-shortcut"
      hitSlop={10}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); expandNav(); }}
      style={[styles.btn, { width: box, height: box, borderRadius: box / 2 }, style]}
    >
      <Image source={RING} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand,
    backgroundColor: "#000",
  },
});
