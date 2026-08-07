import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Pressable, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { colors, fonts, type } from "@/src/theme";
import { EcoesConn } from "@/src/lib/backend";

const D2R = Math.PI / 180;
// Orthographic globe centred slightly north; longitudes rotate slowly so every
// Connection eventually comes into view. The Earth is shown WITHOUT borders —
// only the planet and the living pulsations of ideas.
const LAT0 = 12 * D2R;

function PulseDot({ x, y, intensity, cosc, onPress }: { x: number; y: number; intensity: number; cosc: number; onPress: () => void }) {
  const p = useSharedValue(0);
  useEffect(() => {
    const dur = 1400 + (1 - intensity) * 2200; // calmer when weaker
    p.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [p, intensity]);

  const size = 6 + intensity * 8;
  const strong = intensity >= 0.45;
  const color = strong ? colors.brand : colors.blue;
  const ring = useAnimatedStyle(() => ({ opacity: (0.35 - p.value * 0.32) * (0.5 + cosc / 2), transform: [{ scale: 1 + p.value * (1.4 + intensity) }] }));
  const core = useAnimatedStyle(() => ({ opacity: (0.6 + p.value * 0.4) * (0.45 + cosc * 0.55) }));

  return (
    <Pressable onPress={onPress} hitSlop={10} style={[styles.dotWrap, { left: x - 18, top: y - 18 }]}>
      <Animated.View style={[styles.ring, { width: size * 3, height: size * 3, borderRadius: size * 1.5, borderColor: color }, ring]} />
      <Animated.View style={[styles.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color }, core]} />
    </Pressable>
  );
}

export function EcoesGlobe({ items, size, onSelect, selectedId }: { items: EcoesConn[]; size: number; onSelect: (c: EcoesConn) => void; selectedId?: string | null }) {
  const R = size / 2;
  const cx = R, cy = R;
  const [rot, setRot] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setRot((r) => (r + 0.5) % 360), 60); // ~8°/s, calm
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const projected = items.map((c) => {
    const lat = c.lat * D2R;
    const lon = (c.lon + rot) * D2R;
    const cosc = Math.sin(LAT0) * Math.sin(lat) + Math.cos(LAT0) * Math.cos(lat) * Math.cos(lon);
    const x = Math.cos(lat) * Math.sin(lon);
    const y = Math.cos(LAT0) * Math.sin(lat) - Math.sin(LAT0) * Math.cos(lat) * Math.cos(lon);
    return { c, cosc, sx: cx + x * R * 0.92, sy: cy - y * R * 0.92 };
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* planet body */}
      <View style={[styles.globe, { width: size, height: size, borderRadius: R }]} />
      <View style={[styles.globeInner, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35, top: size * 0.08, left: size * 0.12 }]} />
      <View style={[styles.terminator, { width: size, height: size, borderRadius: R }]} />
      {projected.filter((p) => p.cosc > 0.02).map((p) => (
        <PulseDot key={p.c.id} x={p.sx} y={p.sy} intensity={p.c.intensity} cosc={p.cosc} onPress={() => onSelect(p.c)} />
      ))}
      {items.length === 0 ? (
        <View style={[styles.empty, { width: size, height: size }]} pointerEvents="none">
          <Text style={styles.emptyText}>Nessuna Connection ancora viva sul pianeta.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  globe: { position: "absolute", backgroundColor: "#0A1428", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(88,166,255,0.35)" },
  globeInner: { position: "absolute", backgroundColor: "rgba(88,166,255,0.06)" },
  terminator: { position: "absolute", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" },
  dotWrap: { position: "absolute", width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1.5 },
  core: { shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  empty: { position: "absolute", alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center" },
});
