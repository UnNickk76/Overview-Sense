import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer } from "@/src/hooks/useSensors";
import { computeSky, SkyObject } from "@/src/lib/skyObjects";
import { project, angDiff, FOV_H } from "@/src/lib/project";
import { celestialThumb } from "@/src/lib/liveThumbs";
import { useLiveSense, isCategoryActive } from "@/src/lib/liveSense";
import { colors, fonts, type } from "@/src/theme";

// Notability: brighter + rarer objects win the "primary" discovery slot.
const KIND_RANK: Record<SkyObject["kind"], number> = {
  moon: 6, sun: 6, planet: 5, galcenter: 4, deepsky: 4, satellite: 3, star: 1,
};

interface Marked { o: SkyObject; x: number; y: number; center: number; score: number }

// Live Sky Sense™ — the real-data half of Live Sense™. Recognizes the celestial
// objects actually in front of the camera from compass + tilt + GPS + astronomy.
// Zero AI, zero cost, Beyond View: everything is computed, nothing invented.
export function LiveSense({ zoomFactor = 1, active }: { zoomFactor?: number; active: boolean }) {
  const settings = useLiveSense();
  const skyOn = active && settings.on && isCategoryActive("astronomy", settings);
  // Gate BEFORE any sensor/GPS hook so we never wake sensors (or prompt for
  // location) unless Live Sky Sense is actually enabled by the user.
  if (!skyOn) return null;
  return <LiveSkyEngine zoomFactor={zoomFactor} />;
}

function LiveSkyEngine({ zoomFactor }: { zoomFactor: number }) {
  const { width, height } = useWindowDimensions();
  const obs = useObserver();
  const heading = useHeading(true, 150);
  const accel = useAccelerometer(true, 150);
  const now = useNow(2000);

  const cameraAlt = useMemo(
    () => -Math.atan2(accel.z, Math.hypot(accel.x, accel.y)) * (180 / Math.PI),
    [accel.x, accel.y, accel.z],
  );

  // Motion detection — "wait while moving, reveal when stable".
  const prev = useRef({ h: heading, a: cameraAlt, t: Date.now() });
  const [stable, setStable] = useState(false);
  useEffect(() => {
    const dt = Math.max(1, Date.now() - prev.current.t);
    const speed = (Math.abs(angDiff(heading, prev.current.h)) + Math.abs(cameraAlt - prev.current.a)) / (dt / 1000);
    prev.current = { h: heading, a: cameraAlt, t: Date.now() };
    setStable(speed < 8); // deg/sec — hand-held steadiness threshold
  }, [heading, cameraAlt]);

  const objects = useMemo(() => {
    if (obs.status !== "granted") return [] as SkyObject[];
    return computeSky(now, obs.lat, obs.lon).filter((o) => o.alt > -2);
  }, [obs.status, obs.lat, obs.lon, now]);

  const fovH = FOV_H / Math.max(1, zoomFactor);
  const marked: Marked[] = useMemo(() => {
    const cx = width / 2, cy = height / 2;
    const out: Marked[] = [];
    for (const o of objects) {
      const p = project(o.az, o.alt, heading, cameraAlt, width, height, fovH);
      if (!p) continue;
      const center = Math.hypot(p.x - cx, p.y - cy) / Math.hypot(cx, cy); // 0=center..1=edge
      const bright = Math.max(0, 1 - (o.magnitude + 2) / 8); // brighter → higher
      const score = KIND_RANK[o.kind] * 2 + bright * 3 - center * 4;
      out.push({ o, x: p.x, y: p.y, center, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [objects, heading, cameraAlt, width, height, fovH]);

  const primary = marked[0] ?? null;

  // Elegant discovery reveal: "Analizzo…" → ✔ Name (with real thumbnail).
  const [phase, setPhase] = useState<"idle" | "analyzing" | "revealed">("idle");
  const primaryId = primary?.o.id ?? null;
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (!primaryId || !stable) { if (!primaryId) { setPhase("idle"); lastId.current = null; } return; }
    if (primaryId !== lastId.current) {
      lastId.current = primaryId;
      setPhase("analyzing");
      const t = setTimeout(() => setPhase("revealed"), 500);
      return () => clearTimeout(t);
    }
  }, [primaryId, stable]);

  if (!marked.length) return null;
  const thumb = primary ? celestialThumb(primary.o.id, primary.o.name) : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Discreet markers for every recognized object in frame */}
      {marked.map((m) => {
        const isPrimary = m.o.id === primaryId;
        return (
          <Animated.View key={m.o.id} entering={FadeIn.duration(350)} exiting={FadeOut.duration(250)}
            style={[styles.marker, { left: m.x - 60, top: m.y - 44, width: 120 }]}>
            {!isPrimary ? (
              <>
                <Text style={styles.markerName} numberOfLines={1}>{m.o.name}</Text>
                <View style={styles.tick} />
                <View style={styles.halo}><View style={styles.dot} /></View>
              </>
            ) : (
              <View style={styles.primaryHalo}><View style={styles.primaryDot} /></View>
            )}
          </Animated.View>
        );
      })}

      {/* Primary discovery card — the "scoperta" moment */}
      {primary && stable ? (
        <Animated.View key={`${primaryId}-${phase}`} entering={FadeInDown.duration(420)}
          style={[styles.card, { left: Math.min(Math.max(primary.x - 96, 12), width - 204), top: Math.min(primary.y + 16, height - 130) }]}>
          {phase === "analyzing" ? (
            <View style={styles.analyzeRow}>
              <View style={styles.spinnerDot} />
              <Text style={styles.analyzeText}>Analizzo…</Text>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(320)} style={styles.revealRow}>
              {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" transition={200} /> : null}
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.check}>✔</Text>
                  <Text style={styles.revealName} numberOfLines={1}>{primary.o.name}</Text>
                </View>
                <Text style={styles.revealSub} numberOfLines={1}>{primary.o.subtitle}</Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { position: "absolute", alignItems: "center" },
  markerName: { color: "rgba(240,240,245,0.92)", fontFamily: fonts.medium, fontSize: type.sm - 1, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 4 },
  tick: { width: 1, height: 12, backgroundColor: "rgba(255,255,255,0.5)", marginTop: 2 },
  halo: { width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center", marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.9)" },
  primaryHalo: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(212,175,55,0.16)", alignItems: "center", justifyContent: "center", marginTop: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  primaryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  card: { position: "absolute", width: 192, backgroundColor: "rgba(10,12,16,0.66)", borderRadius: 14, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.55)" },
  analyzeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 4 },
  spinnerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  analyzeText: { color: "rgba(240,240,245,0.9)", fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 0.3 },
  revealRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surfaceTertiary },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  check: { color: colors.brand, fontSize: type.sm },
  revealName: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base, flex: 1 },
  revealSub: { color: "rgba(200,200,205,0.85)", fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
});
