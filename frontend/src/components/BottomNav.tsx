import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter, usePathname, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, fonts, spacing, type } from "@/src/theme";
import { SenseMark } from "@/src/components/SenseMark";
import { useAuth } from "@/src/context/AuthContext";
import { dmApi } from "@/src/lib/backend";

const RING = require("@/assets/images/icon-ring.png");
const PULSE = require("@/assets/images/pulse-icon.png");

type Item = {
  key: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  match: string[];
  ring?: boolean;
  img?: number;
};

// Fixed OverView navigation. Center "Make a Sense" is the signature action.
// Pulse and Sense Vision are permanent, non-removable pillars.
const ITEMS: Item[] = [
  { key: "home", label: "Home", route: "/home", icon: "home-outline", iconActive: "home", match: ["/home"] },
  { key: "pulse", label: "Pulse", route: "/pulse", icon: "pulse-outline", iconActive: "pulse", match: ["/pulse"], img: PULSE },
  { key: "observe", label: "Observe", route: "/feed", icon: "globe-outline", iconActive: "globe", match: ["/feed"], ring: true },
  { key: "dm", label: "Messaggi", route: "/messages", icon: "chatbubbles-outline", iconActive: "chatbubbles", match: ["/messages", "/chat"] },
];

export function BottomNav({ active }: { active?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [dmUnread, setDmUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!user) { setDmUnread(0); return; }
    let alive = true;
    const tick = () => dmApi.list().then((r) => { if (alive) setDmUnread(r.items.reduce((s, c) => s + (c.unread || 0), 0)); }).catch(() => {});
    tick();
    const t = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [user]));

  const isActive = (it: Item) =>
    (active && active === it.key) || it.match.some((m) => pathname === m || pathname.startsWith(m + "?") || pathname.startsWith(m + "/"));

  const go = (route: string, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!current) router.push(route as never);
  };

  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  const Tab = ({ it }: { it: Item }) => {
    const on = isActive(it);
    const badge = it.key === "dm" ? dmUnread : 0;
    return (
      <Pressable key={it.key} testID={`tab-${it.key}`} style={styles.tab} onPress={() => go(it.route, on)} hitSlop={6}>
        <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
          {on ? <Animated.View entering={FadeIn.duration(240)} style={styles.activeRing} pointerEvents="none" /> : null}
          {it.ring ? (
            <Image source={RING} style={[styles.ringImg, { opacity: on ? 1 : 0.55, transform: [{ scale: on ? 1.08 : 1 }] }]} contentFit="contain" />
          ) : it.img ? (
            <Image source={it.img} style={[styles.pulseImg, { opacity: on ? 1 : 0.6, transform: [{ scale: on ? 1.12 : 1 }] }]} contentFit="contain" />
          ) : (
            <Ionicons name={on ? it.iconActive : it.icon} size={on ? 25 : 23} color={on ? colors.brand : colors.onSurfaceSecondary} />
          )}
          {badge > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text></View>
          ) : null}
        </View>
        <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{it.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || spacing.sm }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.bar}>
        {left.map((it) => <Tab key={it.key} it={it} />)}

        <Pressable testID="tab-sense-vision" style={styles.centerTab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/sense-vision" as never); }} hitSlop={8}>
          <View style={styles.centerBtn}><SenseMark size={40} /></View>
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
  tab: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4, paddingVertical: 2 },
  iconWrap: { width: 40, height: 30, alignItems: "center", justifyContent: "center" },
  iconWrapOn: {
    shadowColor: colors.brand, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  activeRing: {
    position: "absolute", width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: colors.brand, backgroundColor: "rgba(212,175,55,0.10)",
  },
  ringImg: { width: 24, height: 24 },
  pulseImg: { width: 26, height: 26 },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 3, letterSpacing: 0.2 },
  labelOn: { color: colors.brand, fontFamily: fonts.semibold },
  badge: { position: "absolute", top: -4, right: 0, backgroundColor: colors.brand, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#05060A" },
  badgeText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm - 4 },
  centerTab: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: -22 },
  centerBtn: {
    width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0E16", borderWidth: 1.5, borderColor: colors.brand,
    shadowColor: colors.brand, shadowOpacity: 0.55, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  centerLabel: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 0.2 },
});
