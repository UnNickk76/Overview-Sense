import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, Modal, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { GLView } from "expo-gl";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { UniverseScene, makeControls, ControlState } from "@/src/components/universe/UniverseScene";
import { OverviewShortcut } from "@/src/components/OverviewShortcut";
import {
  UObject, UScale, SCALES, objectsForScale, searchUniverse, KIND_LABEL, REP_LABEL,
  JOURNEYS, Journey,
} from "@/src/lib/universe";
import {
  fetchAsteroids, catalogForScale, searchCatalog, CATALOG_META, CatKey,
} from "@/src/lib/liveCatalog";
import { SnapshotStudio, SnapshotInput } from "@/src/components/SnapshotStudio";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const DEFAULT_RAD: Record<UScale, number> = { 1: 34, 2: 26, 3: 40, 4: 20, 5: 60 };

export default function UniverseExplorer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // GO INSIDE / Go There deep-link: focus an object, scale, journey, or full viewpoint.
  const params = useLocalSearchParams<{ focus?: string; scale?: string; journey?: string; az?: string; pol?: string; rad?: string }>();
  const [scale, setScale] = useState<UScale>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hudHidden, setHudHidden] = useState(false);

  // Guided Journey
  const [journey, setJourney] = useState<Journey | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [journeyPlaying, setJourneyPlaying] = useState(false);
  const [journeyPicker, setJourneyPicker] = useState(false);

  // Snapshot (shared SnapshotStudio engine)
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapInput, setSnapInput] = useState<SnapshotInput | null>(null);

  // Live + curated catalogs
  const [asteroids, setAsteroids] = useState<UObject[]>([]);
  const [catEnabled, setCatEnabled] = useState<Set<CatKey>>(
    () => new Set<CatKey>(["asteroid", "comet", "pulsar", "quasar", "spacecraft"]));
  const [catPanel, setCatPanel] = useState(false);

  useEffect(() => { fetchAsteroids().then(setAsteroids).catch(() => {}); }, []);

  const objects = useMemo(
    () => [...objectsForScale(scale), ...catalogForScale(scale, asteroids, catEnabled)],
    [scale, asteroids, catEnabled],
  );
  const selected = objects.find((o) => o.id === selectedId) ?? null;

  const toggleCat = (k: CatKey) => {
    Haptics.selectionAsync();
    setCatEnabled((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };

  const ctrl = useRef<ControlState>(makeControls(DEFAULT_RAD[1]));
  const start = useRef({ az: 0, pol: 0, rad: 0 });
  const idle = useRef(true);
  const resumeT = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle drift — keeps the scene alive when untouched.
  useEffect(() => {
    const t = setInterval(() => { if (idle.current) ctrl.current.az += 0.0016; }, 55);
    return () => clearInterval(t);
  }, []);

  const goScale = (s: UScale, focus?: UObject | null) => {
    setScale(s);
    setSelectedId(focus?.id ?? null);
    ctrl.current.target = focus ? focus.pos : [0, 0, 0];
    ctrl.current.rad = focus ? Math.max(focus.size * 4 + 2, 6) : DEFAULT_RAD[s];
    ctrl.current.az = 0.6; ctrl.current.pol = 1.15;
  };

  const pause = () => { idle.current = false; if (resumeT.current) clearTimeout(resumeT.current); };
  const resumeSoon = () => { if (resumeT.current) clearTimeout(resumeT.current); resumeT.current = setTimeout(() => { idle.current = true; }, 700); };

  const flyTo = (o: UObject) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedId(o.id);
    ctrl.current.target = o.pos;
    ctrl.current.rad = Math.max(o.size * 4 + 2, 5);
  };

  const onDoubleTap = (x: number, y: number) => {
    const thr = 46;
    let best: { o: UObject; d: number } | null = null;
    for (const s of ctrl.current.screen) {
      if (!s.visible) continue;
      const o = objects.find((ob) => ob.id === s.id);
      if (!o) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < thr && (!best || d < best.d)) best = { o, d };
    }
    if (best) flyTo(best.o);
    else ctrl.current.rad = clamp(ctrl.current.rad * 0.7, 4, 120);
  };

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .onBegin(() => pause())
      .onStart(() => { start.current = { az: ctrl.current.az, pol: ctrl.current.pol, rad: ctrl.current.rad }; })
      .onUpdate((e) => {
        const k = 0.005;
        ctrl.current.az = start.current.az - e.translationX * k;
        ctrl.current.pol = clamp(start.current.pol - e.translationY * k, 0.15, Math.PI - 0.15);
      })
      .onEnd(() => resumeSoon());
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => pause())
      .onStart(() => { start.current.rad = ctrl.current.rad; })
      .onUpdate((e) => { ctrl.current.rad = clamp(start.current.rad / e.scale, 3, 130); })
      .onEnd(() => resumeSoon());
    const dtap = Gesture.Tap().numberOfTaps(2).maxDuration(320).runOnJS(true).onEnd((e) => onDoubleTap(e.x, e.y));
    return Gesture.Exclusive(dtap, Gesture.Simultaneous(pan, pinch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects]);

  const openDetail = (o: UObject) => {
    if (o.cosmicId) router.push(`/cosmic-object?id=${o.cosmicId}` as never);
    else setSelectedId(o.id); // stays on the in-scene card (no dedicated page yet)
  };

  // ---- Guided Journey ----
  const startJourney = (j: Journey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJourneyPicker(false);
    setJourney(j);
    setStepIdx(0);
    setJourneyPlaying(true);
  };
  const exitJourney = () => { setJourney(null); setJourneyPlaying(false); resumeSoon(); };

  // Deep link (GO INSIDE / Go There): fly to a focus object / scale / journey, restoring the
  // exact viewpoint (az/pol/rad) when provided so a shared Senshot's point of view can be recreated.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current) return;
    if (params.journey) {
      const j = JOURNEYS.find((x) => x.id === params.journey);
      if (j) { deepLinkDone.current = true; startJourney(j); return; }
    }
    if (params.focus) {
      for (const s of [1, 2, 3, 4, 5] as UScale[]) {
        const o = objectsForScale(s).find((ob) => ob.id === params.focus || ob.cosmicId === params.focus);
        if (o) {
          deepLinkDone.current = true;
          setScale(s);
          setSelectedId(o.id);
          ctrl.current.target = o.pos;
          const az = params.az != null ? Number(params.az) : 0.6;
          const pol = params.pol != null ? Number(params.pol) : 1.15;
          const rad = params.rad != null ? Number(params.rad) : Math.max(o.size * 4 + 2, 6);
          ctrl.current.az = Number.isFinite(az) ? az : 0.6;
          ctrl.current.pol = Number.isFinite(pol) ? pol : 1.15;
          ctrl.current.rad = Number.isFinite(rad) ? rad : DEFAULT_RAD[s];
          break;
        }
      }
    } else if (params.scale) {
      const s = Number(params.scale) as UScale;
      if (s >= 1 && s <= 5) { deepLinkDone.current = true; goScale(s); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focus, params.scale, params.journey]);

  // Move the camera to the current step + auto-advance while playing.
  useEffect(() => {
    if (!journey) return;
    const step = journey.steps[stepIdx];
    const obj = objectsForScale(step.scale).find((o) => o.id === step.objectId);
    setScale(step.scale);
    setSelectedId(obj?.id ?? null);
    if (obj) {
      ctrl.current.target = obj.pos;
      ctrl.current.rad = Math.max(obj.size * 4 + 2, 6);
      ctrl.current.az = 0.6; ctrl.current.pol = 1.15;
    }
    if (journeyPlaying) {
      const t = setTimeout(() => {
        setStepIdx((i) => {
          if (i < journey.steps.length - 1) return i + 1;
          setJourneyPlaying(false);
          return i;
        });
      }, step.dwell ?? 6000);
      return () => clearTimeout(t);
    }
  }, [journey, stepIdx, journeyPlaying]);

  // ---- Snapshot (clean, UI-free 3D capture → shared SnapshotStudio) ----
  const captureSnapshot = async () => {
    const r = ctrl.current.renderer as unknown as { domElement?: HTMLCanvasElement; getContext?: () => unknown };
    if (!r) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      let uri = ""; let base64: string | undefined;
      if (Platform.OS === "web" && r.domElement) {
        uri = r.domElement.toDataURL("image/png");
        base64 = uri.split(",")[1];
      } else if (r.getContext) {
        const snap = await GLView.takeSnapshotAsync(r.getContext() as never, { format: "png" });
        uri = typeof snap.uri === "string" ? snap.uri : "";
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      if (!uri) return;
      const cs = SCALES.find((s) => s.level === scale)!;
      setSnapInput({
        uri, base64,
        title: selected?.name ?? `Universe Explorer · ${cs.name}`,
        layerName: `Scala ${scale} · ${cs.name}`,
        source: selected?.source ?? "Universe Explorer · visualizzazione basata sui dati",
        hashtags: ["UniverseExplorer", "Cosmos", ...(selected?.name ? [selected.name.replace(/[^\p{L}\p{N}]/gu, "")] : [])],
        dataLines: [
          selected
            ? { icon: "🪐", label: `${selected.name} · ${selected.distanceLabel}` }
            : { icon: "🌌", label: cs.name },
        ],
        socialSource: "cosmos",
        snapKind: "universe",
        data: {
          from: "universe-explorer", scale, name: selected?.name, cosmicId: selected?.cosmicId,
          // Viewpoint (Senshot = point of view). Enables "Go There" recreation.
          viewpoint: {
            target: "universe-explorer",
            focus: selected?.id ?? null,
            scale,
            az: Number(ctrl.current.az.toFixed(3)),
            pol: Number(ctrl.current.pol.toFixed(3)),
            rad: Number(ctrl.current.rad.toFixed(2)),
          },
        },
      });
      setSnapOpen(true);
    } catch { /* ignore */ }
  };

  const curScale = SCALES.find((s) => s.level === scale)!;
  const journeyStep = journey ? journey.steps[stepIdx] : null;

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <UniverseScene objects={objects} selectedId={selectedId} ctrl={ctrl} />
        </View>
      </GestureDetector>

      {!hudHidden && (
        <>
          {/* Top bar: scale + search + hide */}
          <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
            <View style={styles.scalePill}>
              <Ionicons name="planet-outline" size={14} color={colors.brand} />
              <Text style={styles.scaleName}>Scala {scale} · {curScale.name}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable testID="u-journey" style={styles.iconBtn} onPress={() => setJourneyPicker(true)}>
                <Ionicons name="navigate" size={18} color={colors.brand} />
              </Pressable>
              <Pressable testID="u-catalog" style={styles.iconBtn} onPress={() => setCatPanel((p) => !p)}>
                <Ionicons name="layers" size={18} color={catPanel ? colors.brand : colors.onSurface} />
              </Pressable>
              <Pressable testID="u-snapshot" style={styles.iconBtn} onPress={captureSnapshot}>
                <Ionicons name="camera" size={18} color={colors.onSurface} />
              </Pressable>
              <Pressable testID="u-search" style={styles.iconBtn} onPress={() => setSearchOpen(true)}>
                <Ionicons name="search" size={18} color={colors.onSurface} />
              </Pressable>
              <Pressable testID="u-hide" style={styles.iconBtn} onPress={() => setHudHidden(true)}>
                <Ionicons name="eye-off-outline" size={18} color={colors.onSurface} />
              </Pressable>
              <Pressable testID="u-close" style={styles.iconBtn} onPress={() => router.back()}>
                <Ionicons name="close" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
          </View>

          {/* Catalog layers panel */}
          {catPanel && (
            <View style={[styles.catPanel, { top: insets.top + 60 }]} pointerEvents="auto">
              <Text style={styles.catTitle}>Cataloghi reali</Text>
              {CATALOG_META.map((c) => {
                const on = catEnabled.has(c.key);
                return (
                  <Pressable key={c.key} testID={`cat-${c.key}`} style={styles.catRow} onPress={() => toggleCat(c.key)}>
                    <Ionicons name={c.icon as never} size={15} color={on ? colors.brand : colors.onSurfaceSecondary} />
                    <Text style={[styles.catLabel, on && { color: colors.onSurface }]}>{c.label}</Text>
                    <Text style={styles.catScale}>S{c.scale}</Text>
                    <View style={[styles.catDot, on && styles.catDotOn]} />
                  </Pressable>
                );
              })}
              <Text style={styles.catNote}>Asteroidi live via NASA NeoWs · resto da cataloghi reali.</Text>
            </View>
          )}

          {/* Scale ladder (right) */}
          <View style={[styles.ladder, { top: insets.top + 70 }]} pointerEvents="box-none">
            {SCALES.map((s) => (
              <Pressable key={s.level} testID={`scale-${s.level}`} onPress={() => { Haptics.selectionAsync(); goScale(s.level); }}
                style={[styles.ladderDot, scale === s.level && styles.ladderDotActive]}>
                <Text style={[styles.ladderNum, scale === s.level && styles.ladderNumActive]}>{s.level}</Text>
              </Pressable>
            ))}
          </View>

          {/* Bottom controls */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
            {journey && journeyStep ? (
              <View style={styles.jCard} pointerEvents="auto">
                <View style={styles.jTop}>
                  <Text style={styles.jTitle} numberOfLines={1}>{journey.title}</Text>
                  <Text style={styles.jProg}>{stepIdx + 1}/{journey.steps.length}</Text>
                </View>
                <Text style={styles.jText}>{journeyStep.text}</Text>
                <View style={styles.jBtns}>
                  <Pressable testID="j-prev" style={styles.jNav} disabled={stepIdx === 0}
                    onPress={() => { setJourneyPlaying(false); setStepIdx((i) => Math.max(0, i - 1)); }}>
                    <Ionicons name="play-skip-back" size={16} color={stepIdx === 0 ? colors.onSurfaceTertiary : colors.onSurface} />
                  </Pressable>
                  <Pressable testID="j-play" style={styles.jPlay} onPress={() => setJourneyPlaying((p) => !p)}>
                    <Ionicons name={journeyPlaying ? "pause" : "play"} size={18} color={colors.onBrand} />
                    <Text style={styles.jPlayText}>{journeyPlaying ? "Pausa" : "Riprendi"}</Text>
                  </Pressable>
                  <Pressable testID="j-next" style={styles.jNav} disabled={stepIdx >= journey.steps.length - 1}
                    onPress={() => { setJourneyPlaying(false); setStepIdx((i) => Math.min(journey.steps.length - 1, i + 1)); }}>
                    <Ionicons name="play-skip-forward" size={16} color={stepIdx >= journey.steps.length - 1 ? colors.onSurfaceTertiary : colors.onSurface} />
                  </Pressable>
                  <Pressable testID="j-snap" style={styles.jNav} onPress={captureSnapshot}>
                    <Ionicons name="camera" size={16} color={colors.onSurface} />
                  </Pressable>
                  <Pressable testID="j-exit" style={styles.jExit} onPress={exitJourney}>
                    <Text style={styles.jExitText}>Esci</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.navRow}>
                  <Pressable testID="u-back-scale" style={styles.navBtn} disabled={scale <= 1}
                    onPress={() => goScale(clamp(scale - 1, 1, 5) as UScale)}>
                    <Ionicons name="chevron-back" size={16} color={scale <= 1 ? colors.onSurfaceTertiary : colors.onSurface} />
                    <Text style={[styles.navText, scale <= 1 && { color: colors.onSurfaceTertiary }]}>Scala prec.</Text>
                  </Pressable>
                  <Pressable testID="u-home" style={styles.homeBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); goScale(1, objectsForScale(1).find((o) => o.id === "earth")); }}>
                    <Ionicons name="earth" size={16} color={colors.onBrand} />
                    <Text style={styles.homeText}>Terra</Text>
                  </Pressable>
                  <Pressable testID="u-fwd-scale" style={styles.navBtn} disabled={scale >= 5}
                    onPress={() => goScale(clamp(scale + 1, 1, 5) as UScale)}>
                    <Text style={[styles.navText, scale >= 5 && { color: colors.onSurfaceTertiary }]}>Scala succ.</Text>
                    <Ionicons name="chevron-forward" size={16} color={scale >= 5 ? colors.onSurfaceTertiary : colors.onSurface} />
                  </Pressable>
                </View>

                {selected ? (
                  <View style={styles.card} pointerEvents="auto">
                    <View style={styles.cardHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{selected.name}</Text>
                        <Text style={styles.cardKind}>{KIND_LABEL[selected.kind]} · {selected.distanceLabel}</Text>
                      </View>
                      <Pressable onPress={() => setSelectedId(null)} hitSlop={8}><Ionicons name="close-circle" size={22} color={colors.onSurfaceSecondary} /></Pressable>
                    </View>
                    <Text style={styles.cardBlurb}>{selected.blurb}</Text>
                    <View style={styles.repRow}>
                      <Ionicons name="information-circle-outline" size={13} color={colors.onSurfaceSecondary} />
                      <Text style={styles.repText}>{REP_LABEL[selected.rep]} · {selected.source}</Text>
                    </View>
                    <View style={styles.cardBtns}>
                      <Pressable testID="u-flyto" style={styles.cardBtnGhost} onPress={() => flyTo(selected)}>
                        <Ionicons name="rocket-outline" size={15} color={colors.onSurface} />
                        <Text style={styles.cardBtnGhostText}>Avvicinati</Text>
                      </Pressable>
                      <Pressable testID="u-open-detail" style={styles.cardBtn} onPress={() => openDetail(selected)}>
                        <Text style={styles.cardBtnText}>Apri scheda</Text>
                        <Ionicons name="arrow-forward" size={15} color={colors.onBrand} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.hint}>Trascina per ruotare · pizzica per zoomare · doppio tap su un oggetto</Text>
                )}
              </>
            )}
          </View>
        </>
      )}

      {hudHidden && (
        <Pressable testID="u-show" style={[styles.showHud, { top: insets.top + spacing.sm }]} onPress={() => setHudHidden(false)}>
          <Ionicons name="eye-outline" size={18} color={colors.onSurface} />
        </Pressable>
      )}

      {/* Search */}
      <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={() => setSearchOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSearchOpen(false)} />
        <View style={[styles.searchSheet, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.onSurfaceSecondary} />
            <TextInput testID="u-search-input" style={styles.searchInput} value={query} onChangeText={setQuery} autoFocus
              placeholder="Cerca un oggetto (Marte, Andromeda…)" placeholderTextColor={colors.onSurfaceSecondary} />
            <Pressable onPress={() => setSearchOpen(false)}><Text style={styles.searchCancel}>Chiudi</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            {(query ? [...searchUniverse(query), ...searchCatalog(query, asteroids)] : objects).map((o) => (
              <Pressable key={o.id} testID={`sr-${o.id}`} style={styles.srRow}
                onPress={() => { setSearchOpen(false); setQuery(""); goScale(o.scale, o); }}>
                <View style={[styles.srDot, { backgroundColor: o.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.srName}>{o.name}</Text>
                  <Text style={styles.srMeta}>{KIND_LABEL[o.kind]} · Scala {o.scale} · {o.distanceLabel}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Journey picker */}
      <Modal visible={journeyPicker} transparent animationType="slide" onRequestClose={() => setJourneyPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => setJourneyPicker(false)} />
        <View style={[styles.jSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.jHandle} />
          <Text style={styles.jSheetTitle}>Viaggi guidati</Text>
          <Text style={styles.jSheetSub}>OverView ti accompagna in un viaggio narrato tra oggetti reali.</Text>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {JOURNEYS.map((j) => (
              <Pressable key={j.id} testID={`journey-${j.id}`} style={styles.jRow} onPress={() => startJourney(j)}>
                <View style={styles.jIcon}><Ionicons name="navigate" size={18} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jRowTitle}>{j.title}</Text>
                  <Text style={styles.jRowSub}>{j.subtitle} · {j.steps.length} tappe</Text>
                </View>
                <Ionicons name="play-circle" size={26} color={colors.brand} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Snapshot — shared engine */}
      <SnapshotStudio visible={snapOpen} input={snapInput} onClose={() => setSnapOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#02040a" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scalePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(10,16,26,0.8)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  scaleName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(10,16,26,0.8)", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ladder: { position: "absolute", right: spacing.lg, gap: spacing.sm },
  ladderDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,16,26,0.75)", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ladderDotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  ladderNum: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm },
  ladderNumActive: { color: colors.onBrand },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, gap: spacing.md },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(10,16,26,0.8)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  navText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  homeBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  homeText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  hint: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 1, textAlign: "center" },
  card: { backgroundColor: "rgba(10,16,26,0.94)", borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  cardName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  cardKind: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, marginTop: 2 },
  cardBlurb: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  repRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  repText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, flex: 1 },
  cardBtns: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  cardBtnGhost: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardBtnGhostText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  cardBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 10 },
  cardBtnText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  showHud: { position: "absolute", right: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(10,16,26,0.85)", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  catPanel: { position: "absolute", left: spacing.lg, width: 210, backgroundColor: "rgba(10,16,26,0.94)", borderRadius: radius.lg, padding: spacing.md, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  catTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm, marginBottom: 4 },
  catRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 7 },
  catLabel: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  catScale: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 3 },
  catDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border },
  catDotOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  catNote: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 3, marginTop: 6, lineHeight: 13 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  searchSheet: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.surface, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchInput: { flex: 1, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base },
  searchCancel: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  srRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  srDot: { width: 12, height: 12, borderRadius: 6 },
  srName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  srMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },

  // Guided Journey — narration card (bottom)
  jCard: { backgroundColor: "rgba(10,16,26,0.96)", borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  jTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  jTitle: { flex: 1, color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  jProg: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  jText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  jBtns: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  jNav: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  jPlay: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 11 },
  jPlayText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  jExit: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  jExitText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },

  // Journey picker sheet
  jSheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  jHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.onSurfaceTertiary, alignSelf: "center", marginBottom: spacing.sm },
  jSheetTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  jSheetSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginBottom: spacing.sm },
  jRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  jIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  jRowTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  jRowSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },

  // Snapshot sheet
  snapSheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  snapPreview: { width: "100%", height: 200, borderRadius: radius.md, backgroundColor: colors.tertiary },
  snapInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  snapStatus: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, textAlign: "center" },
  snapPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13 },
  snapPrimaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  snapRow: { flexDirection: "row", gap: spacing.sm },
  snapGhost: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  snapGhostText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
});
