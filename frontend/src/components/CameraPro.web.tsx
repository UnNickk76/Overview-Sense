import React, { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, type } from "@/src/theme";

export interface CameraProHandle {
  capture: () => Promise<{ uri: string; base64?: string } | null>;
}

// Web / Expo Go fallback: the pro camera (VisionCamera) requires a native build.
export const CameraPro = forwardRef<CameraProHandle, { enhance?: boolean; hudBottom?: number; onChromeChange?: (m: "full" | "dim" | "hidden") => void }>((_props, ref) => {
  useImperativeHandle(ref, () => ({ capture: async () => null }), []);
  return (
    <View style={styles.wrap}>
      <Ionicons name="camera-outline" size={40} color={colors.brand} />
      <Text style={styles.title}>Sense Vision Pro</Text>
      <Text style={styles.sub}>La fotocamera avanzata (tap-to-focus, esposizione, zoom ottico, super-risoluzione) è disponibile sulla build nativa iPhone.</Text>
    </View>
  );
});

CameraPro.displayName = "CameraPro";

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, backgroundColor: "#050810", alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  title: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.lg },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", lineHeight: 19 },
});
