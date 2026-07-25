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
  { key: "search", label: "Cerca", route: "/search", icon: "search-outline", iconActive: "search", match: ["/search"] },
  { key: "pulse", label: "Challenges", route: "/challenges", icon: "flash-outline", iconActive: "flash", match: ["/challenges", "/pulse", "/pulse-global"], img: PULSE },
  { key: "observe", label: "Observe", route: "/feed", icon: "globe-outline", iconActive: "globe", match: ["/feed"], ring: true },
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

  const left = ITEMS.slice(0, 3);
  const right = ITEMS.slice(3);

  const Tab = ({ it }: { it: Item }) => {
    const on = isActive(it);
    const badge = it.key === "dm" ? dmUnread : 0;
    return (
      <Pressable key={it.key} testID={`tab-${it.key}`} style={styles.tab} onPress={() => go(it.route, on)} hitSlop={8}>
        <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
          {on ? <Animated.View entering={FadeIn.duration(240)} style={styles.activeRing} pointerEvents="none" /> : null}
          {it.ring ? (
            <Image source={RING} style={[styles.ringImg, { opacity: on ? 1 : 0.55, transform: [{ scale: on ? 1.08 : 1 }] }]} contentFit="contain" />
          ) : it.img ? (
            <Image source={it.img} style={[styles.pulseImg, { opacity: on ? 1 : 0.6, transform: [{ scale: on ? 1.12 : 1 }] }]} contentFit="contain" />
          ) : (
            <Ionicons name={on ? it.iconActive : it.icon} size={on ? 26 : 24} color={on ? colors.brand : colors.onSurfaceSecondary} />
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
        {left.map((it) => <Tab key={it.key} it={it} />)}
        <View style={styles.centerSlot} />
        {right.map((it) => <Tab key={it.key} it={it} />)}

        <View style={styles.centerHolder} pointerEvents="box-none">
          <Pressable testID="tab-sense-vision" style={styles.centerBtn} hitSlop={10}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/sense-vision" as never); }}>
            <SenseMark size={38} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    alignItems: "center",
  },
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    alignSelf: "center", width: "90%", maxWidth: 440, height: 60,
    borderRadius: 30, paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  blurClip: { ...StyleSheet.absoluteFillObject, borderRadius: 30, overflow: "hidden", backgroundColor: "rgba(5,6,10,0.72)" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%" },
  centerSlot: { flex: 1 },
  iconWrap: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  iconWrapOn: {
    shadowColor: colors.brand, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  activeRing: {
    position: "absolute", width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: colors.brand, backgroundColor: "rgba(212,175,55,0.10)",
  },
  ringImg: { width: 25, height: 25 },
  pulseImg: { width: 27, height: 27 },
  badge: { position: "absolute", top: 0, right: 2, backgroundColor: colors.brand, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#05060A" },
  badgeText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm - 4 },
  centerHolder: { position: "absolute", left: 0, right: 0, top: -22, alignItems: "center" },
  centerBtn: {
    width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0E16", borderWidth: 1.5, borderColor: colors.brand,
    shadowColor: colors.brand, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
});
