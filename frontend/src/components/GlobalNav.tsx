import React, { useEffect } from "react";
import { StyleSheet, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { BottomNav } from "@/src/components/BottomNav";
import { useNavExpanded, expandNav, collapseNav } from "@/src/lib/navState";

const RING = require("@/assets/images/icon-ring.png");

// Routes that MUST NOT show any global nav (pre-app / auth / onboarding).
const AUTH_ROUTES = ["/", "/index", "/welcome", "/login", "/register", "/before-you-begin", "/privacy-consent"];

// Routes that already mount their own permanent BottomNav (the main sections).
// The global layer stays silent here to avoid a duplicated bar.
const SELF_NAV_ROUTES = ["/home", "/search", "/challenges", "/feed", "/messages", "/observations", "/profile", "/activity", "/ecoes-world"];

// Immersive routes that keep their OWN header OverView ring as launcher. Here we
// don't add a second compact launcher (avoids two rings), but expanding still
// shows the full bar temporarily.
const IMMERSIVE_ROUTES = ["/sense-vision", "/earth-explorer", "/invisible-3d", "/visual-assistant", "/overview-guide"];

const norm = (p: string) => (p || "/").split("?")[0].replace(/\/+$/, "") || "/";

/**
 * Single, route-aware global navigation. On secondary/immersive screens it shows
 * the COMPACT OverView launcher; tapping it expands the full 8-item BottomNav for
 * 15s (auto-collapse). Main sections keep their own permanent bar untouched.
 */
export function GlobalNav() {
  const pathname = norm(usePathname());
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const expanded = useNavExpanded();

  // Any route change collapses the temporary bar back to COMPACT.
  useEffect(() => { collapseNav(); }, [pathname]);

  if (!user) return null;
  if (AUTH_ROUTES.includes(pathname)) return null;

  // Expanded: show the full bar everywhere EXCEPT where a permanent one already is.
  if (expanded && !SELF_NAV_ROUTES.includes(pathname)) {
    return (
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <BottomNav />
      </Animated.View>
    );
  }

  // Collapsed: a compact launcher only where the screen has no launcher of its own.
  if (expanded) return null; // self-nav route while expanded → nothing (permanent bar)
  if (SELF_NAV_ROUTES.includes(pathname)) return null;   // permanent bar present
  if (IMMERSIVE_ROUTES.includes(pathname)) return null;  // own header ring is the launcher

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: (insets.bottom || 8) + 14 }]}>
      <Pressable
        testID="global-nav-launcher"
        hitSlop={10}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); expandNav(); }}
        style={styles.launcher}
      >
        <Image source={RING} style={styles.ring} contentFit="cover" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, alignItems: "center", justifyContent: "center" },
  launcher: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center",
    overflow: "hidden", backgroundColor: "#000",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  ring: { width: 40, height: 40, borderRadius: 20 },
});
