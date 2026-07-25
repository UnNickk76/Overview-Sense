import React, { useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, FlatList, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { FeedObservation, mediaUrl } from "@/src/lib/backend";
import type { ObsData } from "@/src/lib/gallery";
import { buildOverlay } from "@/src/lib/senseFrame";
import { FOV_H } from "@/src/lib/project";
import { SenseSkyOverlay } from "@/src/components/SenseSkyOverlay";
import { SenseGeoOverlay } from "@/src/components/SenseGeoOverlay";
import { SenseCanvas, layerToVisual } from "@/src/components/SenseCanvas";
import { InteractionBar } from "@/src/components/InteractionBar";
import { orderedDataLayers } from "@/src/lib/senseLayers";

// Quick, Explore-style viewer: first tap opens the photo (with the owner's
// initial Overlay/Names/Sense-Layer config), swipe between results, key social
// actions. "Apri scheda completa" (or double-tap) opens the full Observe card.
export function SenseQuickView({ items, index, onClose, onOpenFull }: {
  items: FeedObservation[];
  index: number;
  onClose: () => void;
  onOpenFull: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [cur, setCur] = useState(index);
  const listRef = useRef<FlatList<FeedObservation>>(null);

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(it) => it.id}
        onMomentumScrollEnd={(e) => setCur(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <Page obs={item} width={width} height={height} onOpenFull={() => onOpenFull(item.id)} />
        )}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Text style={styles.topAuthor} numberOfLines={1}>{items[cur]?.nickname}</Text>
        <Pressable testID="quickview-close" hitSlop={12} onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function Page({ obs, width, height, onOpenFull }: { obs: FeedObservation; width: number; height: number; onOpenFull: () => void }) {
  const insets = useSafeAreaInsets();
  const [showOverlay, setShowOverlay] = useState(true);
  const lastTap = useRef(0);
  const d = (obs.data ?? {}) as ObsData;
  const uri = mediaUrl(obs.image_url) || "";
  const camAz = d.cameraAz ?? 0;
  const camAlt = d.cameraAlt ?? 0;
  const zoom = d.zoom ?? 1;
  const legendOn = d.legendOn !== false;
  const hidden = new Set(d.legendHidden ?? []);
  const active = new Set(d.senseLayers ?? []);
  const overlay = React.useMemo(
    () => buildOverlay(d, camAz, camAlt, width, height, FOV_H / Math.max(1, zoom)),
    [d, camAz, camAlt, width, height, zoom],
  );
  const dataLayers = orderedDataLayers(d).filter((l) => active.has(l.key));

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 260) { Haptics.selectionAsync(); onOpenFull(); return; }
    lastTap.current = now;
    setShowOverlay((v) => !v);
  };

  return (
    <Pressable style={{ width, height, backgroundColor: "#000" }} onPress={onTap}>
      <SenseCanvas uri={uri} width={width} height={height} layer={layerToVisual(d.senseLayer)} />
      {showOverlay ? (
        <>
          {overlay ? <SenseSkyOverlay data={overlay} w={width} h={height} legendOn={legendOn} hiddenObj={hidden} /> : null}
          {d.places?.length ? <SenseGeoOverlay places={d.places} camAz={camAz} camAlt={camAlt} w={width} h={height} fovH={FOV_H / Math.max(1, zoom)} legendOn={legendOn} hiddenObj={hidden} /> : null}
          {dataLayers.length ? (
            <View style={[styles.pills, { top: insets.top + 60 }]} pointerEvents="none">
              {dataLayers.map((l) => (
                <View key={l.key} style={styles.pill}>
                  <Text style={styles.pillEmoji}>{l.emoji}</Text>
                  <Text style={styles.pillText}>{l.current}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {obs.title ? <Text style={styles.title} numberOfLines={2}>{obs.title}</Text> : null}
        <View style={styles.barWrap}><InteractionBar obs={obs} /></View>
        <Pressable testID="quickview-open-full" style={styles.fullBtn} onPress={onOpenFull}>
          <Ionicons name="expand" size={17} color={colors.onBrand} />
          <Text style={styles.fullText}>Apri scheda completa</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", zIndex: 100 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  topAuthor: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base, flex: 1 },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pills: { position: "absolute", left: spacing.lg, gap: 6, maxWidth: "72%" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(10,12,16,0.5)", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, borderLeftWidth: 2, borderLeftColor: colors.brand },
  pillEmoji: { fontSize: 12 },
  pillText: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm - 1 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing["2xl"], gap: spacing.md },
  title: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.lg },
  barWrap: { alignSelf: "flex-start" },
  fullBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 14, paddingVertical: spacing.md },
  fullText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
});
