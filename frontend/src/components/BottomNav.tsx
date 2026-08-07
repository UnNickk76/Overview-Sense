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
import { useAuth } from "@/src/context/AuthContext";
import { dmApi } from "@/src/lib/backend";

const RING = require("@/assets/images/icon-ring.png");
const PULSE = require("@/assets/images/pulse-icon.png");
const SENSE = require("@/assets/images/sense-mark.png");
const ECOES = require("@/assets/images/ecoes-icon.png");

type Item = {
  key: string;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  match: string[];
  img?: number;
};

// OverView's two pillars — Sense and Ecoes — share the bar with equal weight.
// Eight sections, identical graphic weight; only the selected state differs.
// Sense keeps the central position but is NOT elevated or highlighted anymore.
const ITEMS: Item[] = [
  { key: "home", label: "Home", route: "/home", icon: "home-outline", iconActive: "home", match: ["/home"] },
  { key: "search", label: "Explore", route: "/search", icon: "search-outline", iconActive: "search", match: ["/search"] },
  { key: "pulse", label: "Challenges", route: "/challenges", icon: "flash-outline", iconActive: "flash", match: ["/challenges", "/pulse", "/pulse-global"], img: PULSE },
  { key: "observe", label: "Observe", route: "/feed", icon: "globe-outline", iconActive: "globe", match: ["/feed"], img: RING },
  { key: "sense", label: "Sense", route: "/sense-vision", icon: "sparkles-outline", iconActive: "sparkles", match: ["/sense-vision"], img: SENSE },
  { key: "ecoes", label: "Ecoes", route: "/ecoes-world", icon: "radio-outline", iconActive: "radio", match: ["/ecoes-world", "/ecoes"], img: ECOES },
  { key: "dm", label: "Messaggi", route: "/messages", icon: "chatbubbles-outline", iconActive: "chatbubbles", match: ["/messages", "/chat"] },
  { key: "gallery", label: "Galleria", route: "/observations", icon: "images-outline", iconActive: "images", match: ["/observations"] },
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

  const Tab = ({ it }: { it: Item }) => {
    const on = isActive(it);
    const badge = it.key === "dm" ? dmUnread : 0;
    return (
      <Pressable key={it.key} testID={`tab-${it.key}`} style={styles.tab} onPress={() => go(it.route, on)} hitSlop={6}>
        <View style={styles.iconWrap}>
          {on ? <Animated.View entering={FadeIn.duration(220)} style={styles.activeRing} pointerEvents="none" /> : null}
          {it.img ? (
            <Image source={it.img} style={[styles.img, { opacity: on ? 1 : 0.5 }]} contentFit="contain" />
          ) : (
            <Ionicons name={on ? it.iconActive : it.icon} size={23} color={on ? colors.brand : colors.onSurfaceSecondary} />
          )}
          {badge > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text></View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: (insets.bottom || spacing.sm) + spacing.xs }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.blurClip}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
        </View>
        {ITEMS.map((it) => <Tab key={it.key} it={it} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    alignSelf: "center", width: "96%", maxWidth: 480, height: 58,
    borderRadius: 29, paddingHorizontal: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  blurClip: { ...StyleSheet.absoluteFillObject, borderRadius: 29, overflow: "hidden", backgroundColor: "rgba(5,6,10,0.72)" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%" },
  iconWrap: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  activeRing: {
    position: "absolute", width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: colors.brand, backgroundColor: "rgba(212,175,55,0.10)",
  },
  img: { width: 24, height: 24 },
  badge: { position: "absolute", top: -2, right: 0, backgroundColor: colors.brand, minWidth: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#05060A" },
  badgeText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm - 4 },
});
