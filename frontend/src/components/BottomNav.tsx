import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, type } from "@/src/theme";
import { SenseMark } from "@/src/components/SenseMark";

type Item = {
  key: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  match: string[];
};

// Fixed bottom navigation (iOS-style). The center "Make a Sense" is the signature action.
const ITEMS: Item[] = [
  { key: "home", label: "Home", route: "/home", icon: "home", match: ["/home"] },
  { key: "dm", label: "Messaggi", route: "/messages", icon: "chatbubble-ellipses", match: ["/messages"] },
  { key: "feed", label: "Universe", route: "/feed", icon: "planet", match: ["/feed"] },
  { key: "activity", label: "Attività", route: "/activity", icon: "notifications", match: ["/activity"] },
];

export function BottomNav({ active }: { active?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (it: Item) =>
    (active && active === it.key) || it.match.some((m) => pathname === m || pathname.startsWith(m + "?"));

  const go = (route: string, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!current) router.push(route as never);
  };

  const openSense = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/sense-vision" as never);
  };

  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  const Tab = ({ it }: { it: Item }) => {
    const on = isActive(it);
    return (
      <Pressable key={it.key} testID={`tab-${it.key}`} style={styles.tab} onPress={() => go(it.route, on)} hitSlop={6}>
        <Ionicons name={it.icon} size={23} color={on ? colors.brand : colors.onSurfaceSecondary} />
        <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{it.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || spacing.sm }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.bar}>
        {left.map((it) => <Tab key={it.key} it={it} />)}

        <Pressable testID="tab-sense-vision" style={styles.centerTab} onPress={openSense} hitSlop={8}>
          <View style={styles.centerBtn}>
            <SenseMark size={40} />
          </View>
          <Text style={styles.centerLabel}>Make a Sense</Text>
        </Pressable>

        {right.map((it) => <Tab key={it.key} it={it} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: "rgba(5,6,10,0.82)", overflow: "hidden",
  },
  bar: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: spacing.sm, paddingHorizontal: spacing.xs },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 2 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 3, letterSpacing: 0.2 },
  labelOn: { color: colors.brand },
  centerTab: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: -22 },
  centerBtn: {
    width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0E16", borderWidth: 1.5, borderColor: colors.brand,
    shadowColor: colors.brand, shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  centerLabel: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 0.2 },
});
