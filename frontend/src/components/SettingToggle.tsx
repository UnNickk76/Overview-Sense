import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

export function SettingToggle({ title, subtitle, value, onChange, testID }: {
  title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; testID?: string;
}) {
  return (
    <Pressable testID={testID} style={styles.row} onPress={() => { Haptics.selectionAsync(); onChange(!value); }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2, lineHeight: 16 },
  track: { width: 46, height: 28, borderRadius: 999, backgroundColor: colors.surfaceTertiary, padding: 3, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  trackOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
});

export const settingsCardStyle = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing.md },
});
