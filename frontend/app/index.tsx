import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useAuth } from "@/src/context/AuthContext";

const SPLASH = require("../assets/images/overview-splash.png");
const SPLASH_MS = 4000;

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [elapsed, setElapsed] = useState(false);
  const routed = useRef(false);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setElapsed(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, [opacity]);

  useEffect(() => {
    if (elapsed && !loading && !routed.current) {
      routed.current = true;
      router.replace(user ? "/home" : "/welcome");
    }
  }, [elapsed, loading, user, router]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.root} testID="splash-screen">
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        <Image source={SPLASH} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
});
