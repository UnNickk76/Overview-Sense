import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { SceneRecognition, SVElement } from "@/src/lib/backend";
import { getViewerPref, setViewerPref } from "@/src/lib/sceneRecognition";

// Elegant, anti-clutter presentation of a Sense's recognition layer. The photo
// is NEVER modified — this is an optional, per-viewer knowledge layer. We show
// the scene + the most significant elements; the rest is behind "mostra tutto".
const TIER_META: Record<string, { label: string; color: string }> = {
  confirmed: { label: "", color: colors.brand },
  probable: { label: "Probabile", color: colors.blue },
  generic: { label: "", color: colors.onSurfaceSecondary },
};

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  water: "water", vegetation: "leaf", tree: "leaf", plant: "flower", rock: "triangle",
  mountain: "triangle", building: "business", monument: "flag", city: "business",
  place: "location", bridge: "git-compare", road: "trail-sign", path: "trail-sign",
  person: "person", vehicle: "car", animal: "paw", nature: "leaf", object: "cube",
};

function Row({ e, primary }: { e: SVElement; primary?: boolean }) {
  const tier = TIER_META[e.tier] ?? TIER_META.generic;
  const name = e.label_specific || e.label;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: tier.color }]}>
        <Ionicons name={KIND_ICON[e.kind] ?? "ellipse"} size={12} color="#04121f" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, primary && styles.namePrimary]} numberOfLines={1}>
          {e.tier === "probable" ? "Probabile: " : ""}{name}
        </Text>
        {e.label_specific && e.label_specific !== e.label ? (
          <Text style={styles.sub} numberOfLines={1}>{e.label}{e.distance_km ? ` · ${e.distance_km} km` : ""}</Text>
        ) : null}
      </View>
      {e.notable ? <Ionicons name="star" size={11} color={colors.brand} /> : null}
    </View>
  );
}

export function RecognitionLayer({ recognition, obsId, onDeepen, deepening }: {
  recognition: SceneRecognition | null | undefined;
  obsId: string;
  onDeepen?: () => void;      // owner-only "Approfondisci" (re-analyze)
  deepening?: boolean;
}) {
  const defOn = (recognition?.overlay_default ?? "on") !== "off";
  const [show, setShow] = useState(defOn);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { getViewerPref(obsId, defOn).then(setShow); }, [obsId, defOn]);

  const subjects = recognition?.subjects ?? [];
  const elements = recognition?.elements ?? [];
  const scene = recognition?.scene;

  // Anti-clutter: primary = scene + subjects + top notable elements (budget ~5).
  const primaryElements = useMemo(() => {
    const notable = elements.filter((e) => e.notable);
    const rest = elements.filter((e) => !e.notable);
    return [...notable, ...rest].slice(0, Math.max(0, 5 - subjects.length));
  }, [elements, subjects.length]);
  const hiddenCount = elements.length - primaryElements.length;

  if (!recognition || (!scene && subjects.length === 0 && elements.length === 0)) {
    return null;
  }

  const toggle = () => { const v = !show; setShow(v); setViewerPref(obsId, v); Haptics.selectionAsync(); };

  return (
    <View style={styles.card}>
      <Pressable style={styles.head} onPress={toggle}>
        <View style={styles.headLeft}>
          <Ionicons name="scan-outline" size={16} color={colors.brand} />
          <Text style={styles.headTitle}>Riconoscimento scena</Text>
        </View>
        <View style={styles.headRight}>
          <Text style={styles.headToggle}>{show ? "Nascondi" : "Mostra"}</Text>
          <Ionicons name={show ? "eye" : "eye-off"} size={16} color={colors.onSurfaceSecondary} />
        </View>
      </Pressable>

      {show ? (
        <View style={styles.body}>
          {scene ? (
            <View style={styles.sceneRow}>
              <Text style={styles.sceneLabel}>SCENA</Text>
              <Text style={styles.sceneValue}>{scene.label_specific || scene.label}</Text>
            </View>
          ) : null}
          {subjects.map((e) => <Row key={e.id} e={e} primary />)}
          {primaryElements.map((e) => <Row key={e.id} e={e} />)}
          {expanded ? elements.slice(primaryElements.length).map((e) => <Row key={e.id} e={e} />) : null}
          {hiddenCount > 0 ? (
            <Pressable onPress={() => setExpanded((x) => !x)} style={styles.moreBtn}>
              <Text style={styles.moreText}>{expanded ? "Mostra meno" : `Mostra altri ${hiddenCount}`}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.note}>Livello informativo opzionale · non modifica la foto originale. Se non è determinabile, non viene mostrato.</Text>
          {onDeepen ? (
            <Pressable style={styles.deepBtn} onPress={onDeepen} disabled={deepening}>
              {deepening ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="sparkles-outline" size={14} color={colors.brand} />}
              <Text style={styles.deepText}>Approfondisci il riconoscimento</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  headRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  headToggle: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm },
  sceneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sceneLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.bold, fontSize: type.sm - 4, letterSpacing: 0.8 },
  sceneValue: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  name: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base - 1 },
  namePrimary: { fontFamily: fonts.semibold },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
  moreBtn: { alignSelf: "flex-start", paddingVertical: 2 },
  moreText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  note: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, fontStyle: "italic", marginTop: 2, lineHeight: 15 },
  deepBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 4, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  deepText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 1 },
});
