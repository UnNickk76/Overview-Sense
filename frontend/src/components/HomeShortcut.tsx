import React from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";

// One-tap return to Home. Same "apps" grid icon used in ScreenHeader, for use
// inside custom/immersive headers that don't use ScreenHeader.
export function HomeShortcut({ size = 26, style }: { size?: number; style?: ViewStyle }) {
  const router = useRouter();
  const box = size + 12;
  return (
    <Pressable
      testID="header-home-button"
      hitSlop={10}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.replace("/home" as never); }}
      style={[styles.btn, { width: box, height: box, borderRadius: box / 2 }, style]}
    >
      <Ionicons name="apps" size={Math.round(size * 0.66)} color={colors.onSurface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(10,12,16,0.55)",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
});
