import React, { useMemo, useRef, useState } from "react";
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
import { compassPoint } from "@/src/lib/format";

const FOV_H = 60; // horizontal field of view (deg)
const FOV_V = 80;

function angDiff(a: number, b: number): number {
  let x = a - b;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

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

  const cameraAlt = useMemo(() => {
    const el = -Math.atan2(accel.z, Math.hypot(accel.x, accel.y)) * (180 / Math.PI);
    return el; // ~0 at horizon (portrait), positive when pointing up
  }, [accel.x, accel.y, accel.z]);

  const objects = useMemo(() => {
    if (obs.status !== "granted") return [];
    return computeSky(now, obs.lat, obs.lon).filter((o) => o.alt > -5);
  }, [now, obs.lat, obs.lon, obs.status]);

  const visibleCount = objects.filter((o) => o.alt > 0).length;

  const open = (o: SkyObject) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(o);
    sheetRef.current?.snapToIndex(0);
  };

  if (!perm) {
    return <SpaceBackground><ScreenHeader title="Cielo" /></SpaceBackground>;
  }

  if (!perm.granted) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Cielo" />
        <View style={styles.permCenter}>
          <Ionicons name="telescope-outline" size={44} color={colors.brand} />
          <Text style={styles.permTitle}>Punta il telefono verso il cielo</Text>
          <Text style={styles.permText}>
            Serve la fotocamera per sovrapporre stelle e pianeti reali. Overview calcola le loro posizioni per la tua località e non inventa nulla.
          </Text>
          {perm.canAskAgain ? (
            <Pressable testID="grant-camera-button" style={styles.cta} onPress={() => { requestPerm(); }}>
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

  return (
    <View style={styles.root}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
      <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />

      {/* Sky markers */}
      {objects.map((o) => {
        const dAz = angDiff(o.az, heading);
        const dAlt = o.alt - cameraAlt;
        if (Math.abs(dAz) > FOV_H / 2 || Math.abs(dAlt) > FOV_V / 2) return null;
        const x = width / 2 + (dAz / (FOV_H / 2)) * (width / 2);
        const y = height / 2 - (dAlt / (FOV_V / 2)) * (height / 2);
        const size = o.kind === "star" ? Math.max(4, 10 - o.magnitude) : 14;
        return (
          <Pressable
            key={o.id}
            testID={`sky-marker-${o.id}`}
            onPress={() => open(o)}
            style={[styles.marker, { left: x - 22, top: y - 22 }]}
            hitSlop={8}
          >
            <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: o.color }]} />
            <Text style={styles.markerLabel} numberOfLines={1}>{o.name}</Text>
          </Pressable>
        );
      })}

      {/* Header (floating glass) */}
      <View style={[styles.floatHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="cielo-back" style={styles.glassBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.compassPill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.compassText}>{compassPoint(heading)} · {heading.toFixed(0)}°  ↕ {cameraAlt.toFixed(0)}°</Text>
        </View>
      </View>

      {/* Bottom info */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.countPill}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="telescope" size={16} color={colors.brand} />
          <Text style={styles.countText}>{`${visibleCount} oggetti sopra l'orizzonte · muovi il telefono`}</Text>
        </View>
      </View>

      <ObjectSheet ref={sheetRef} object={selected} onClose={() => setSelected(null)} />
    </View>
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
  permCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.xl, gap: spacing.md },
  permTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl, textAlign: "center", marginTop: spacing.md },
  permText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999 },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  marker: { position: "absolute", alignItems: "center", width: 44 },
  dot: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  markerLabel: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 1, marginTop: 3, textShadowColor: "#000", textShadowRadius: 4 },
  floatHeader: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  glassBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compassPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  compassText: { color: "#fff", fontFamily: fonts.monoMedium, fontSize: type.sm },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingHorizontal: spacing.lg },
  countPill: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: 999, overflow: "hidden", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  countText: { color: "#fff", fontFamily: fonts.regular, fontSize: type.sm },
  listWrap: { alignSelf: "stretch", marginTop: spacing.lg },
  listTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.sm },
  listItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  listDot: { width: 12, height: 12, borderRadius: 6 },
  listName: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flex: 1 },
  listMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
});
