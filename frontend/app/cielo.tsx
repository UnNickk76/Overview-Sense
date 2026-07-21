import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions, Linking, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import BottomSheet from "@gorhom/bottom-sheet";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ObjectSheet } from "@/src/components/ObjectSheet";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useHeading, useAccelerometer } from "@/src/hooks/useSensors";
import { computeSky, SkyObject } from "@/src/lib/skyObjects";
import { compassPoint, nf } from "@/src/lib/format";
import { project, FOV_H, cameraAltFromAccel } from "@/src/lib/project";
import { pitchVisibility, combineVisibility, sceneToMode, skyBucket, SKY_THRESHOLD, SENSE_MODES, AUTO_MODES, type Scene, type SenseModeKey } from "@/src/lib/skyVisibility";
import { aiApi } from "@/src/lib/backend";
import { api, Weather, SpaceWeather } from "@/src/lib/api";
import { loadSatrecs, computeSatellites, SatPos } from "@/src/lib/satellites";
import { buildObservation } from "@/src/lib/observationData";
import { saveObservation } from "@/src/lib/gallery";
import { activeConstellations, type Constellation } from "@/src/lib/constellations";
import { ConstellationLayer, DEFAULT_LAYERS, type Layers } from "@/src/components/SkyVision";
import { ConstellationSheet } from "@/src/components/ConstellationSheet";
import { storage } from "@/src/utils/storage";

export default function Cielo() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const obs = useObserver();
  const now = useNow(1000);
  const heading = useHeading(perm?.granted === true);
  const accel = useAccelerometer(perm?.granted === true, 120);
  const sheetRef = useRef<BottomSheet>(null);
  const [selected, setSelected] = useState<SkyObject | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [showConst, setShowConst] = useState(true);
  const [showSats, setShowSats] = useState(true);
  const [showNames] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const satsReady = useRef(false);

  useEffect(() => {
    api.satellites().then((r) => { if (r.available) { loadSatrecs(r.satellites); satsReady.current = true; } }).catch(() => {});
    api.spaceWeather().then(setSpace).catch(() => {});
  }, []);
  useEffect(() => {
    if (obs.status === "granted") api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  const cameraAlt = useMemo(
    () => cameraAltFromAccel(accel),
    [accel.x, accel.y, accel.z],
  );

  // --- Sky Visibility™ + Sense Auto Mode™ ---
  const [aiScene, setAiScene] = useState<{ v: number | null; scene: Scene }>({ v: null, scene: "unknown" });
  const [manualMode, setManualMode] = useState<SenseModeKey | null>(null);
  const [modePicker, setModePicker] = useState(false);
  const analyzing = useRef(false);

  const pitchScore = useMemo(() => pitchVisibility(cameraAlt), [cameraAlt]);
  const skyScore = useMemo(() => combineVisibility(pitchScore, aiScene.v, aiScene.scene), [pitchScore, aiScene]);
  const skyBkt = skyBucket(skyScore);
  const skyVisible = manualMode === "sky" || (manualMode === null && skyScore >= SKY_THRESHOLD);
  const autoMode: SenseModeKey = skyScore >= SKY_THRESHOLD ? "sky" : sceneToMode(aiScene.scene);
  const activeMode = manualMode ?? autoMode;

  // Periodic AI scene read — refines pitch (tells walls/ceilings/ground from open sky).
  useEffect(() => {
    if (perm?.granted !== true) return;
    let alive = true;
    const run = async () => {
      if (analyzing.current || !cameraRef.current) return;
      analyzing.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.2, base64: true, skipProcessing: true });
        if (alive && photo?.base64) {
          const r = await aiApi.scene(photo.base64);
          if (alive) setAiScene({ v: r.sky_visibility, scene: (r.scene as Scene) || "unknown" });
        }
      } catch { /* web / no camera: device orientation stays authoritative */ } finally { analyzing.current = false; }
    };
    const first = setTimeout(run, 3000);
    const t = setInterval(run, 9000);
    return () => { alive = false; clearTimeout(first); clearInterval(t); };
  }, [perm?.granted]);

  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [constSel, setConstSel] = useState<Constellation | null>(null);
  const [firstDisc, setFirstDisc] = useState(false);
  const discovered = useRef<Set<string>>(new Set());
  useEffect(() => {
    storage.getItem<string>("discovered_constellations", "[]").then((v) => {
      try { discovered.current = new Set(JSON.parse(v)); } catch { /* ignore */ }
    });
  }, []);

  const objects = useMemo(() => {
    if (obs.status !== "granted") return [];
    return computeSky(now, obs.lat, obs.lon).filter((o) => o.alt > -5);
  }, [now, obs.lat, obs.lon, obs.status]);

  const sats = useMemo<SatPos[]>(() => {
    if (obs.status !== "granted" || !satsReady.current) return [];
    return computeSatellites(now, obs.lat, obs.lon, (obs.altitude ?? 0) / 1000);
  }, [now, obs.lat, obs.lon, obs.status, obs.altitude]);

  const visibleCount = objects.filter((o) => o.alt > 0).length + sats.filter((s) => s.alt > 0).length;

  const open = (o: SkyObject) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(o);
    sheetRef.current?.snapToIndex(0);
  };

  const openSat = (s: SatPos) => {
    open({
      id: s.id, name: s.name, kind: "satellite", alt: s.alt, az: s.az, magnitude: 5,
      color: colors.blue, subtitle: "Satellite in orbita",
      facts: [`Distanza dall'osservatore: ~${nf(s.rangeKm, 0)} km.`, "Posizione propagata in tempo reale (SGP4) da TLE ufficiali.", "Si muove rapidamente: osservalo tra pochi secondi."],
      distanceStr: `~${nf(s.rangeKm, 0)} km`, lightAgeLy: null,
    });
  };

  const capture = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri && obs.status === "granted") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        const data = buildObservation(now, obs.lat, obs.lon, obs.altitude, heading, cameraAlt, sats, weather, space);
        const saved = await saveObservation(photo.uri, data);
        router.push(`/observation?id=${saved.id}` as never);
      }
    } catch { /* ignore */ }
    setBusy(false);
  };

  if (!perm) return <SpaceBackground><ScreenHeader title="Cielo" /></SpaceBackground>;

  if (!perm.granted) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Cielo" />
        <View style={styles.permCenter}>
          <Ionicons name="telescope-outline" size={44} color={colors.brand} />
          <Text style={styles.permTitle}>Punta il telefono verso il cielo</Text>
          <Text style={styles.permText}>Serve la fotocamera per registrare un&apos;Observation: la foto reale con sopra ciò che era davvero presente (stelle, pianeti, satelliti).</Text>
          {perm.canAskAgain ? (
            <Pressable testID="grant-camera-button" style={styles.cta} onPress={() => requestPerm()}>
              <Text style={styles.ctaText}>Consenti fotocamera</Text>
            </Pressable>
          ) : (
            <Pressable testID="open-settings-button" style={styles.cta} onPress={() => Linking.openSettings()}>
              <Text style={styles.ctaText}>Apri Impostazioni</Text>
            </Pressable>
          )}
          <SkyList objects={objects} onSelect={open} />
        </View>
        <ObjectSheet ref={sheetRef} object={selected} onClose={() => setSelected(null)} />
      </SpaceBackground>
    );
  }

  // Projected in-frame star points (only real, currently-visible stars).
  const starPts = new Map<string, { x: number; y: number }>();
  objects.filter((o) => o.kind === "star" && o.alt > 0).forEach((o) => {
    const p = project(o.az, o.alt, heading, cameraAlt, width, height, FOV_H);
    if (p) starPts.set(o.name, p);
  });
  const activeConsts = activeConstellations(new Set(starPts.keys()));
  const constStarNames = new Set(activeConsts.flatMap((c) => c.stars));

  const openConstellation = (c: Constellation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isFirst = !discovered.current.has(c.key);
    if (isFirst) {
      discovered.current.add(c.key);
      storage.setItem("discovered_constellations", JSON.stringify(Array.from(discovered.current)));
    }
    setFirstDisc(isFirst);
    setConstSel(c);
  };
  const openStar = (name: string) => {
    const so = objects.find((o) => o.name === name);
    if (so) open(so);
  };

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />

      {skyVisible && showConst ? (
        <ConstellationLayer points={starPts} layers={layers} onTapStar={openStar} onTapConstellation={openConstellation} />
      ) : null}

      {skyVisible ? objects.map((o) => {
        if (o.kind === "star" && showConst && constStarNames.has(o.name)) return null;
        const p = project(o.az, o.alt, heading, cameraAlt, width, height, FOV_H);
        if (!p) return null;
        return (
          <Pressable key={o.id} testID={`sky-marker-${o.id}`} onPress={() => open(o)} style={[styles.anchor, { left: p.x, top: p.y }]} hitSlop={14}>
            <View style={[styles.glow, { backgroundColor: o.color }]} />
            <View style={[styles.ring, { borderColor: o.color }]} />
            <View style={[styles.core, { backgroundColor: o.color }]} />
            {showNames ? (
              <>
                <View style={styles.leader} />
                <View style={styles.tagWrap}>
                  <Text style={styles.tag} numberOfLines={1}>{o.name}</Text>
                </View>
              </>
            ) : null}
          </Pressable>
        );
      }) : null}

      {skyVisible && showSats ? sats.map((s) => {
        const p = project(s.az, s.alt, heading, cameraAlt, width, height, FOV_H);
        if (!p) return null;
        return (
          <Pressable key={s.id} testID={`sat-marker-${s.id}`} onPress={() => openSat(s)} style={[styles.anchor, { left: p.x, top: p.y }]} hitSlop={14}>
            <View style={[styles.glow, styles.glowSat]} />
            <View style={[styles.ring, { borderColor: colors.blue }]} />
            <View style={[styles.core, styles.coreSat]} />
            {showNames ? (
              <>
                <View style={[styles.leader, styles.leaderSat]} />
                <View style={styles.tagWrap}>
                  <Text style={[styles.tag, styles.tagSat]} numberOfLines={1}>{s.name}</Text>
                </View>
              </>
            ) : null}
          </Pressable>
        );
      }) : null}

      {!skyVisible ? (
        <View style={styles.senseCenter} pointerEvents="none">
          <View style={styles.senseCard}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.senseEmoji}>{SENSE_MODES[activeMode].emoji}</Text>
            <Text style={styles.senseTitle}>{activeMode === "sky" ? "Sky Hidden™" : SENSE_MODES[activeMode].label}</Text>
            <Text style={styles.senseMsg}>
              {activeMode === "sky"
                ? "Il cielo non è visibile. Punta la fotocamera verso il cielo per attivare Sky Vision."
                : "Sense Vision sta osservando questa scena. Non ci sono oggetti astronomici da mostrare qui."}
            </Text>
            <View style={styles.skyVisBar}>
              <View style={[styles.skyVisFill, { width: `${skyBkt}%` }]} />
            </View>
            <Text style={styles.skyVisLabel}>Sky Visibility™ {skyBkt}%</Text>
          </View>
        </View>
      ) : null}

      {/* Sense Auto Mode™ chip */}
      <View style={[styles.modeWrap, { top: insets.top + 54 }]} pointerEvents="box-none">
        <Pressable testID="sense-mode-chip" style={styles.modeChip} onPress={() => { Haptics.selectionAsync(); setModePicker((v) => !v); }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.modeEmoji}>{SENSE_MODES[activeMode].emoji}</Text>
          <Text style={styles.modeText}>{SENSE_MODES[activeMode].label}</Text>
          <View style={[styles.modeBadge, manualMode !== null && styles.modeBadgeManual]}>
            <Text style={styles.modeBadgeTxt}>{manualMode === null ? "AUTO" : "MANUAL"}</Text>
          </View>
          <Ionicons name={modePicker ? "chevron-up" : "chevron-down"} size={14} color="#fff" />
        </Pressable>
        {modePicker ? (
          <View style={styles.modeMenu}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <Pressable testID="mode-auto" style={styles.modeItem} onPress={() => { Haptics.selectionAsync(); setManualMode(null); setModePicker(false); }}>
              <Ionicons name="sparkles" size={16} color={colors.brand} />
              <Text style={styles.modeItemTxt}>Auto</Text>
              {manualMode === null ? <Ionicons name="checkmark" size={16} color={colors.brand} style={{ marginLeft: "auto" }} /> : null}
            </Pressable>
            {AUTO_MODES.map((k) => (
              <Pressable key={k} testID={`mode-${k}`} style={styles.modeItem} onPress={() => { Haptics.selectionAsync(); setManualMode(k); setModePicker(false); }}>
                <Text style={styles.modeEmoji}>{SENSE_MODES[k].emoji}</Text>
                <Text style={styles.modeItemTxt}>{SENSE_MODES[k].label}</Text>
                {manualMode === k ? <Ionicons name="checkmark" size={16} color={colors.brand} style={{ marginLeft: "auto" }} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.floatHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="cielo-back" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.compassPill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.compassText}>{compassPoint(heading)} · {heading.toFixed(0)}°  ↕ {cameraAlt.toFixed(0)}°  ·  Sky {skyBkt}%</Text>
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {skyVisible && layersOpen ? (
          <View style={styles.layersPanel}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            {([
              ["name", "Nome"], ["stars", "Stelle"], ["lines", "Linee"], ["figure", "Figura di luce"], ["info", "Info"],
            ] as [keyof Layers, string][]).map(([k, label]) => (
              <Pressable key={k} testID={`layer-${k}`} style={styles.layerRow} onPress={() => { Haptics.selectionAsync(); setLayers((l) => ({ ...l, [k]: !l[k] })); }}>
                <Ionicons name={layers[k] ? "checkbox" : "square-outline"} size={18} color={layers[k] ? colors.brand : "#fff"} />
                <Text style={styles.layerTxt}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.toggles}>
          <Toggle label="Costellazioni" active={showConst} onPress={() => setShowConst((v) => !v)} testID="toggle-const" />
          <Toggle label="Layers" active={layersOpen} onPress={() => setLayersOpen((v) => !v)} testID="toggle-layers" />
          <Toggle label="Satelliti" active={showSats} onPress={() => setShowSats((v) => !v)} testID="toggle-sats" />
        </View>
        <View style={styles.captureRow}>
          <Text style={styles.countInline} numberOfLines={1}>{skyVisible ? `${visibleCount} sopra di te` : `${SENSE_MODES[activeMode].emoji} ${SENSE_MODES[activeMode].label}`}</Text>
          <Pressable testID="capture-button" style={[styles.shutter, busy && { opacity: 0.5 }]} onPress={capture}>
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.rightSlot}>
            <Pressable testID="observations-button" style={styles.obsBtn} onPress={() => router.push("/observations" as never)}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="images" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      <ObjectSheet ref={sheetRef} object={selected} onClose={() => setSelected(null)} />
      {constSel ? <ConstellationSheet c={constSel} firstDiscovery={firstDisc} onClose={() => setConstSel(null)} /> : null}
    </View>
  );
}

function Toggle({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.toggle, active && styles.toggleActive]}>
      <BlurView intensity={active ? 0 : 25} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={[styles.toggleText, active && { color: colors.onBrand }]}>{label}</Text>
    </Pressable>
  );
}

function SkyList({ objects, onSelect }: { objects: SkyObject[]; onSelect: (o: SkyObject) => void }) {
  const visible = objects.filter((o) => o.alt > 0).sort((a, b) => b.alt - a.alt);
  return (
    <View style={styles.listWrap}>
      <Text style={styles.listTitle}>Visibile ora ({visible.length})</Text>
      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
        {visible.map((o) => (
          <Pressable key={o.id} testID={`list-item-${o.id}`} style={styles.listItem} onPress={() => onSelect(o)}>
            <View style={[styles.listDot, { backgroundColor: o.color }]} />
            <Text style={styles.listName}>{o.name}</Text>
            <Text style={styles.listMeta}>{compassPoint(o.az)} · {o.alt.toFixed(0)}°</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  dim: { backgroundColor: "rgba(0,0,0,0.25)" },
  senseCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  senseCard: { width: "100%", maxWidth: 340, borderRadius: 24, overflow: "hidden", alignItems: "center", padding: spacing.xl, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  senseEmoji: { fontSize: 42 },
  senseTitle: { color: "#fff", fontFamily: fonts.bold, fontSize: type["2xl"], textAlign: "center" },
  senseMsg: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  skyVisBar: { width: "80%", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden", marginTop: spacing.sm },
  skyVisFill: { height: "100%", borderRadius: 3, backgroundColor: colors.brand },
  skyVisLabel: { color: colors.brand, fontFamily: fonts.mono, fontSize: type.sm, letterSpacing: 0.5 },
  modeWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 20 },
  modeChip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.22)" },
  modeEmoji: { fontSize: 16 },
  modeText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm },
  modeBadge: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  modeBadgeManual: { backgroundColor: colors.blue },
  modeBadgeTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.5 },
  modeMenu: { marginTop: 6, borderRadius: 16, overflow: "hidden", width: 210, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  modeItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  modeItemTxt: { color: "#fff", fontFamily: fonts.medium, fontSize: type.base },
  layersPanel: { position: "absolute", bottom: 88, alignSelf: "center", borderRadius: 16, overflow: "hidden", paddingVertical: 8, paddingHorizontal: 14, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.2)" },
  layerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  layerTxt: { color: "#fff", fontFamily: fonts.medium, fontSize: type.base },
  permCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
  permTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl, textAlign: "center", marginTop: spacing.md },
  permText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999 },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  marker: { position: "absolute", alignItems: "center", width: 44 },
  dot: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  markerLabel: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 1, marginTop: 3, textShadowColor: "#000", textShadowRadius: 4 },
  satDot: { width: 8, height: 8, backgroundColor: colors.blue, borderWidth: 1, borderColor: "#fff" },
  satLabel: { color: "#8FD0FF", fontFamily: fonts.medium, fontSize: type.sm - 2, marginTop: 3, textShadowColor: "#000", textShadowRadius: 4 },
  // Elegant "augmented photo" object tagging: soft glow + core + leader line + name.
  anchor: { position: "absolute", alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", left: -17, top: -17, width: 34, height: 34, borderRadius: 17, opacity: 0.16 },
  glowSat: { backgroundColor: colors.blue },
  ring: { position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, opacity: 0.75, backgroundColor: "transparent" },
  core: { position: "absolute", left: -2.5, top: -2.5, width: 5, height: 5, borderRadius: 2.5 },
  coreSat: { backgroundColor: colors.blue },
  leader: { position: "absolute", left: -0.5, top: -33, width: 1, height: 17, backgroundColor: "rgba(255,255,255,0.55)" },
  leaderSat: { backgroundColor: "rgba(143,208,255,0.6)" },
  tagWrap: { position: "absolute", top: -52, left: -60, width: 120, alignItems: "center" },
  tag: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 1, letterSpacing: 0.3, textShadowColor: "#000", textShadowRadius: 5 },
  tagSat: { color: "#8FD0FF" },
  floatHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  glassBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compassPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compassText: { color: "#fff", fontFamily: fonts.monoMedium, fontSize: type.sm },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, gap: spacing.md },
  toggles: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  toggle: { overflow: "hidden", borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toggleActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  toggleText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm },
  captureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  countInline: { flex: 1, color: "#fff", fontFamily: fonts.regular, fontSize: type.sm - 1, opacity: 0.85 },
  rightSlot: { flex: 1, alignItems: "flex-end" },
  shutter: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff" },
  obsBtn: { width: 46, height: 46, borderRadius: 23, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  listWrap: { alignSelf: "stretch", marginTop: spacing.lg },
  listTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.sm },
  listItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  listDot: { width: 12, height: 12, borderRadius: 6 },
  listName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flex: 1 },
  listMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
});
