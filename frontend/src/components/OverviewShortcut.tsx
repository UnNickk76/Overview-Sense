import React from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";

// The golden "O" mark → the social OverView Sense Universe (the app's social home / feed).
// Placed top-right, near the profile icon, in every section for one-tap access.
const RING = require("@/assets/images/icon-ring.png");

export function OverviewShortcut({ size = 28, style }: { size?: number; style?: ViewStyle }) {
  const router = useRouter();
  const box = size + 12;
  return (
    <Pressable
      testID="overview-shortcut"
      hitSlop={10}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/feed" as never); }}
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
