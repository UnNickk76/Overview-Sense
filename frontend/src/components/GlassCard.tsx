import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius } from "@/src/theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  testID?: string;
}

export function GlassCard({ children, style, intensity = 28, testID }: Props) {
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(26,29,36,0.75)" },
  content: { padding: 16 },
});
