import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer } from "@/src/hooks/useSensors";
import { computeSky, SkyObject } from "@/src/lib/skyObjects";
import { project, angDiff, FOV_H, cameraAltFromAccel } from "@/src/lib/project";
import { celestialThumb, wikiThumb } from "@/src/lib/liveThumbs";
import { useLiveSense, isCategoryActive, activeCategories } from "@/src/lib/liveSense";
import { aiApi, LiveRecognition } from "@/src/lib/backend";
import { colors, fonts, type } from "@/src/theme";

type SnapFn = () => Promise<string | null>;

interface Props { zoomFactor?: number; active: boolean; snapshot?: SnapFn; facing?: "back" | "front"; sky?: boolean }

// Live Sense™ — OverView's single universal recognition engine embedded in the
// camera. It has two honest sources under one experience:
//  • Live Sky Sense™: celestial objects from real sensors + astronomy (zero AI).
//  • Live Sense™ (AI): terrestrial/general subjects, shown only when reliable.
// For the user there is only one thing: point the camera, OverView tells you what
// you're observing. Beyond View: nothing is ever invented.
export function LiveSense({ zoomFactor = 1, active, snapshot, facing = "back", sky = true }: Props) {
  const settings = useLiveSense();
  const skyOn = sky && active && settings.on && isCategoryActive("astronomy", settings);
  const aiCats = active && settings.on
    ? activeCategories(settings).filter((c) => c !== "astronomy")
    : [];
  const aiOn = aiCats.length > 0 && !!snapshot;
  if (!skyOn && !aiOn) return null;
  return (
    <>
      {skyOn ? <LiveSkyEngine zoomFactor={zoomFactor} facing={facing} /> : null}
      {aiOn ? <LiveAIEngine snapshot={snapshot!} categories={aiCats} /> : null}
    </>
  );
}

// ------------------------------- Sky (real data) ----------------------------
const KIND_RANK: Record<SkyObject["kind"], number> = {
  moon: 6, sun: 6, planet: 5, galcenter: 4, deepsky: 4, satellite: 3, star: 1,
};

interface Marked { o: SkyObject; x: number; y: number; center: number; score: number }

function LiveSkyEngine({ zoomFactor, facing }: { zoomFactor: number; facing: "back" | "front" }) {
  const { width, height } = useWindowDimensions();
  const obs = useObserver();
  const heading = useHeading(true, 150);
  const accel = useAccelerometer(true, 150);
  const now = useNow(2000);

  // Front camera looks the opposite way to the phone's back → offset azimuth 180°.
  const camAz = facing === "front" ? (heading + 180) % 360 : heading;
  const mirror = facing === "front";
  const cameraAlt = useMemo(
    () => cameraAltFromAccel(accel),
    [accel.x, accel.y, accel.z],
  );

  const prev = useRef({ h: camAz, a: cameraAlt, t: Date.now() });
  const [stable, setStable] = useState(false);
  useEffect(() => {
    const dt = Math.max(1, Date.now() - prev.current.t);
    const speed = (Math.abs(angDiff(camAz, prev.current.h)) + Math.abs(cameraAlt - prev.current.a)) / (dt / 1000);
    prev.current = { h: camAz, a: cameraAlt, t: Date.now() };
    setStable(speed < 8);
  }, [camAz, cameraAlt]);

  const objects = useMemo(() => {
    if (obs.status !== "granted") return [] as SkyObject[];
    return computeSky(now, obs.lat, obs.lon).filter((o) => o.alt > -2);
  }, [obs.status, obs.lat, obs.lon, now]);

  const fovH = FOV_H / Math.max(1, zoomFactor);
  const marked: Marked[] = useMemo(() => {
    const cx = width / 2, cy = height / 2;
    const out: Marked[] = [];
    for (const o of objects) {
      const p = project(o.az, o.alt, camAz, cameraAlt, width, height, fovH);
      if (!p) continue;
      const x = mirror ? width - p.x : p.x;
      const center = Math.hypot(x - cx, p.y - cy) / Math.hypot(cx, cy);
      const bright = Math.max(0, 1 - (o.magnitude + 2) / 8);
      const score = KIND_RANK[o.kind] * 2 + bright * 3 - center * 4;
      out.push({ o, x, y: p.y, center, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [objects, camAz, cameraAlt, width, height, fovH, mirror]);

  const primary = marked[0] ?? null;
  const [phase, setPhase] = useState<"idle" | "analyzing" | "revealed">("idle");
  const primaryId = primary?.o.id ?? null;
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (!primaryId) { setPhase("idle"); lastId.current = null; return; }
    if (!stable) return;                         // keep current phase while moving
    if (primaryId !== lastId.current) { lastId.current = primaryId; setPhase("analyzing"); }
    const t = setTimeout(() => setPhase("revealed"), 500);  // always resolves → never stuck
    return () => clearTimeout(t);
  }, [primaryId, stable]);

  // Sky context (sensor-only, honest): is the camera actually aimed at open sky?
  const skyVisible = cameraAlt >= 18;
  const ctxMsg = skyVisible ? null
    : cameraAlt < -12 ? "Fotocamera verso il basso · punta verso il cielo"
    : "Cielo vicino all'orizzonte · alza la fotocamera";

  const thumb = primary ? celestialThumb(primary.o.id, primary.o.name) : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SkyStatus visible={skyVisible} msg={ctxMsg} width={width} />
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
                {!skyVisible ? <Text style={styles.ctxNote} numberOfLines={2}>In questa direzione, ma il cielo non è visibile ora.</Text> : null}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

// Discrete sky-context indicator (sensor-only). Tells the user WHY objects may or
// may not be observable right now — the astronomy is always computed correctly.
function SkyStatus({ visible, msg, width }: { visible: boolean; msg: string | null; width: number }) {
  return (
    <View style={[styles.skyStatusWrap, { width }]} pointerEvents="none">
      <Animated.View entering={FadeIn.duration(300)} style={[styles.skyStatusPill, !visible && styles.skyStatusHidden]}>
        <Text style={styles.skyStatusText}>{visible ? "🌌 Sky Visible" : "🌌 Sky Hidden"}</Text>
      </Animated.View>
      {msg ? (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.skyHint}>
          <Text style={styles.skyHintText}>{msg}</Text>
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
    () => cameraAltFromAccel(accel),
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
  const [phase, setPhase] = useState<"idle" | "analyzing" | "revealed" | "none">("idle");
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catsKey = categories.join(",");

  // Show "not found" briefly, then quietly return to idle — never leave "Analizzo…" hanging.
  const showNotFound = () => {
    resultRef.current = null; setResult(null); setThumb(null); setPhase("none");
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setPhase("idle"), 2600);
  };

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);

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
        // Hard timeout: if recognition doesn't return in time, stop "Analizzo…".
        const timeout = new Promise<null>((res) => setTimeout(() => res(null), 7000));
        const r = await Promise.race([aiApi.liveRecognize(b64, categories), timeout]);
        lastTs.current = Date.now();
        dirty.current = false;
        if (cancelled) return;
        if (r && r.recognized) {
          resultRef.current = r; setResult(r); setPhase("revealed"); setThumb(null);
          const t = await wikiThumb(r.wiki || r.label || "");
          if (!cancelled) setThumb(t);
        } else {
          showNotFound();
        }
      } catch {
        if (!cancelled) { if (resultRef.current) setPhase("revealed"); else showNotFound(); }
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
      ) : phase === "none" ? (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} style={styles.aiCard}>
          <Text style={styles.hintText}>Nessun oggetto identificato · continua a osservare</Text>
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
  hintText: { color: "rgba(240,240,245,0.9)", fontFamily: fonts.medium, fontSize: type.sm - 1, letterSpacing: 0.2 },
  ctxNote: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 2, marginTop: 3, lineHeight: 15 },
  skyStatusWrap: { position: "absolute", top: 148, left: 0, alignItems: "center" },
  skyStatusPill: { backgroundColor: "rgba(10,12,16,0.55)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.45)" },
  skyStatusHidden: { borderColor: "rgba(255,255,255,0.2)" },
  skyStatusText: { color: "rgba(240,240,245,0.92)", fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.3 },
  skyHint: { marginTop: 5, backgroundColor: "rgba(10,12,16,0.45)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  skyHintText: { color: "rgba(220,220,225,0.85)", fontFamily: fonts.regular, fontSize: type.sm - 3, letterSpacing: 0.2 },
});
