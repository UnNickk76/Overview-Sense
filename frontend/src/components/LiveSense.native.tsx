import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer } from "@/src/hooks/useSensors";
import { computeSky, SkyObject } from "@/src/lib/skyObjects";
import { project, angDiff, FOV_H } from "@/src/lib/project";
import { celestialThumb, wikiThumb } from "@/src/lib/liveThumbs";
import { useLiveSense, isCategoryActive, activeCategories } from "@/src/lib/liveSense";
import { aiApi, LiveRecognition } from "@/src/lib/backend";
import { colors, fonts, type } from "@/src/theme";

type SnapFn = () => Promise<string | null>;

interface Props { zoomFactor?: number; active: boolean; snapshot?: SnapFn }

// Live Sense™ — OverView's single universal recognition engine embedded in the
// camera. It has two honest sources under one experience:
//  • Live Sky Sense™: celestial objects from real sensors + astronomy (zero AI).
//  • Live Sense™ (AI): terrestrial/general subjects, shown only when reliable.
// For the user there is only one thing: point the camera, OverView tells you what
// you're observing. Beyond View: nothing is ever invented.
export function LiveSense({ zoomFactor = 1, active, snapshot }: Props) {
  const settings = useLiveSense();
  const skyOn = active && settings.on && isCategoryActive("astronomy", settings);
  const aiCats = active && settings.on
    ? activeCategories(settings).filter((c) => c !== "astronomy")
    : [];
  const aiOn = aiCats.length > 0 && !!snapshot;
  if (!skyOn && !aiOn) return null;
  return (
    <>
      {skyOn ? <LiveSkyEngine zoomFactor={zoomFactor} /> : null}
      {aiOn ? <LiveAIEngine snapshot={snapshot!} categories={aiCats} /> : null}
    </>
  );
}

// ------------------------------- Sky (real data) ----------------------------
const KIND_RANK: Record<SkyObject["kind"], number> = {
  moon: 6, sun: 6, planet: 5, galcenter: 4, deepsky: 4, satellite: 3, star: 1,
};

interface Marked { o: SkyObject; x: number; y: number; center: number; score: number }

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

  const prev = useRef({ h: heading, a: cameraAlt, t: Date.now() });
  const [stable, setStable] = useState(false);
  useEffect(() => {
    const dt = Math.max(1, Date.now() - prev.current.t);
    const speed = (Math.abs(angDiff(heading, prev.current.h)) + Math.abs(cameraAlt - prev.current.a)) / (dt / 1000);
    prev.current = { h: heading, a: cameraAlt, t: Date.now() };
    setStable(speed < 8);
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
      const center = Math.hypot(p.x - cx, p.y - cy) / Math.hypot(cx, cy);
      const bright = Math.max(0, 1 - (o.magnitude + 2) / 8);
      const score = KIND_RANK[o.kind] * 2 + bright * 3 - center * 4;
      out.push({ o, x: p.x, y: p.y, center, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [objects, heading, cameraAlt, width, height, fovH]);

  const primary = marked[0] ?? null;
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

// ------------------------------- Universal (AI) -----------------------------
function LiveAIEngine({ snapshot, categories }: { snapshot: SnapFn; categories: string[] }) {
  const { width, height } = useWindowDimensions();
  const accel = useAccelerometer(true, 220);
  const tick = useNow(1200);

  const pitch = useMemo(
    () => -Math.atan2(accel.z, Math.hypot(accel.x, accel.y)) * (180 / Math.PI),
    [accel.x, accel.y, accel.z],
  );

  // Smart cadence: analyze only when steady + the scene has changed; keep result
  // otherwise. Movement marks the scene "dirty" so we re-analyze once still again.
  const prev = useRef({ p: pitch, mx: accel.x, my: accel.y, t: Date.now() });
  const dirty = useRef(true);
  const [stable, setStable] = useState(false);
  useEffect(() => {
    const dt = Math.max(1, Date.now() - prev.current.t);
    const speed = (Math.abs(pitch - prev.current.p) + Math.abs(accel.x - prev.current.mx) * 40 + Math.abs(accel.y - prev.current.my) * 40) / (dt / 1000);
    prev.current = { p: pitch, mx: accel.x, my: accel.y, t: Date.now() };
    if (speed > 14) dirty.current = true;
    setStable(speed < 9);
  }, [pitch, accel.x, accel.y]);

  const busy = useRef(false);
  const lastTs = useRef(0);
  const resultRef = useRef<LiveRecognition | null>(null);
  const [result, setResult] = useState<LiveRecognition | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "analyzing" | "revealed">("idle");
  const catsKey = categories.join(",");

  useEffect(() => {
    if (!stable || busy.current) return;
    if (!dirty.current && resultRef.current) return;         // same scene → keep
    if (Date.now() - lastTs.current < 2600) return;           // throttle AI calls
    let cancelled = false;
    (async () => {
      busy.current = true;
      setPhase("analyzing");
      const b64 = await snapshot();
      if (!b64) { busy.current = false; setPhase(resultRef.current ? "revealed" : "idle"); return; }
      try {
        const r = await aiApi.liveRecognize(b64, categories);
        lastTs.current = Date.now();
        dirty.current = false;
        if (cancelled) return;
        if (r.recognized) {
          resultRef.current = r; setResult(r); setPhase("revealed"); setThumb(null);
          const t = await wikiThumb(r.wiki || r.label || "");
          if (!cancelled) setThumb(t);
        } else {
          resultRef.current = null; setResult(null); setThumb(null); setPhase("idle");
        }
      } catch {
        setPhase(resultRef.current ? "revealed" : "idle");
      } finally {
        busy.current = false;
      }
    })();
    return () => { cancelled = true; };
  }, [tick, stable, catsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "idle" && !result) return null;
  const confirmed = result?.reliability === "confirmed";

  return (
    <View style={[styles.aiWrap, { top: height * 0.6, width }]} pointerEvents="none">
      {phase === "analyzing" ? (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={styles.aiCard}>
          <View style={styles.spinnerDot} />
          <Text style={styles.analyzeText}>Analizzo…</Text>
        </Animated.View>
      ) : result ? (
        <Animated.View key={`${result.label}-${result.reliability}`} entering={FadeInDown.duration(420)}
          style={[styles.aiCard, styles.aiCardWide, !confirmed && styles.aiCardProbable]}>
          {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" transition={220} /> : (
            <View style={[styles.thumb, styles.thumbEmoji]}><Text style={{ fontSize: 22 }}>{result.emoji || "🔍"}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.check, !confirmed && { color: "#9AA0A6" }]}>{confirmed ? "✔" : "≈"}</Text>
              <Text style={styles.revealName} numberOfLines={1}>{result.label}</Text>
            </View>
            {result.subtitle ? <Text style={styles.revealSub} numberOfLines={1}>{result.subtitle}</Text> : null}
            {!confirmed ? <Text style={styles.probableTag}>Probabile</Text> : null}
          </View>
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
  thumbEmoji: { alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  check: { color: colors.brand, fontSize: type.sm },
  revealName: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base, flex: 1 },
  revealSub: { color: "rgba(200,200,205,0.85)", fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  aiWrap: { position: "absolute", alignItems: "center" },
  aiCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(10,12,16,0.72)", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.6)" },
  aiCardWide: { maxWidth: 260, paddingRight: 16 },
  aiCardProbable: { borderColor: "rgba(255,255,255,0.28)" },
  probableTag: { color: "#9AA0A6", fontFamily: fonts.medium, fontSize: type.sm - 3, marginTop: 2, letterSpacing: 0.4 },
});
