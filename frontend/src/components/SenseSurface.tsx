import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, Modal, Text, StatusBar } from "react-native";
import { Image } from "expo-image";
import Animated, {
  FadeIn, FadeOut, ZoomIn, useSharedValue, useAnimatedStyle, withTiming, runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { SenseMark } from "@/src/components/SenseMark";
import { fonts } from "@/src/theme";

// SenseSurface — the UNIVERSAL Sense interaction standard for Overview Sense Universe.
// Double tap  → Pure Sense™  : the photo, full screen, no UI/data.
// Single tap  → Reality Sense™: show/hide every real data layer, fluid transition.
// In Pure Sense™, an optional vertical swipe browses the whole gallery immersively.
interface Props {
  width: number;
  height: number;
  fullscreenUri: string;          // clean photo shown in Pure Sense™
  photo: React.ReactNode;         // base photo node (always visible)
  overlay?: React.ReactNode;      // data layers / watermark (visible only in Reality Sense™)
  layersVisible: boolean;         // controlled by parent
  onToggleLayers: () => void;
  radius?: number;
  disabled?: boolean;             // opt out of gestures
  gallery?: string[];             // immersive vertical-swipe gallery (fullscreen URIs)
  initialIndex?: number;          // index of this Sense inside gallery
}

function BrandFlash({ label }: { label: string }) {
  return (
    <Animated.View entering={ZoomIn.duration(240)} exiting={FadeOut.duration(260)} style={styles.flashWrap} pointerEvents="none">
      <View style={styles.flashPill}>
        <SenseMark size={22} />
        <Text style={styles.flashText}>{label}</Text>
      </View>
    </Animated.View>
  );
}

export function SenseSurface({
  width, height, fullscreenUri, photo, overlay, layersVisible, onToggleLayers,
  radius = 18, disabled, gallery, initialIndex = 0,
}: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [fsIndex, setFsIndex] = useState(initialIndex);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ty = useSharedValue(0);

  const galleryList = gallery && gallery.length > 1 ? gallery : null;

  const showFlash = useCallback((label: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(label);
    flashTimer.current = setTimeout(() => setFlash(null), 650);
  }, []);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const handleSingle = useCallback(() => {
    Haptics.selectionAsync();
    if (!layersVisible) showFlash("Reality Sense™");
    onToggleLayers();
  }, [layersVisible, onToggleLayers, showFlash]);

  const handleOpenFull = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFsIndex(initialIndex);
    ty.value = 0;
    setFullscreen(true);
    showFlash("Pure Sense™");
  }, [showFlash, initialIndex, ty]);

  const handleCloseFull = useCallback(() => {
    Haptics.selectionAsync();
    setFullscreen(false);
  }, []);

  const handleSwipeEnd = useCallback((dy: number) => {
    setFsIndex((i) => {
      const last = (galleryList?.length ?? 1) - 1;
      if (dy < -70 && i < last) { Haptics.selectionAsync(); return i + 1; }
      if (dy > 70 && i > 0) { Haptics.selectionAsync(); return i - 1; }
      return i;
    });
    ty.value = withTiming(0, { duration: 180 });
  }, [galleryList, ty]);

  // RNGH v2 gesture callbacks run on the JS thread by default → call handlers directly.
  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(260).onEnd(handleOpenFull);
  const singleTap = Gesture.Tap().numberOfTaps(1).maxDuration(260).onEnd(handleSingle);
  const composed = Gesture.Exclusive(doubleTap, singleTap);

  const fsClose = Gesture.Tap().numberOfTaps(2).onEnd(handleCloseFull);
  const fsPan = Gesture.Pan()
    .activeOffsetY([-16, 16])
    .onUpdate((e) => { "worklet"; ty.value = e.translationY; })
    .onEnd((e) => { "worklet"; runOnJS(handleSwipeEnd)(e.translationY); });
  const fsGesture = galleryList ? Gesture.Exclusive(fsClose, fsPan) : fsClose;

  const fsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: 1 - Math.min(Math.abs(ty.value) / 700, 0.45),
  }));

  const fsUri = galleryList ? gallery![fsIndex] : fullscreenUri;

  const surface = (
    <View style={{ width, height, borderRadius: radius, overflow: "hidden" }}>
      {photo}
      {layersVisible && overlay ? (
        <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(280)} exiting={FadeOut.duration(200)} pointerEvents="box-none">
          {overlay}
        </Animated.View>
      ) : null}
      {flash ? <BrandFlash label={flash} /> : null}
    </View>
  );

  return (
    <>
      {disabled ? surface : <GestureDetector gesture={composed}>{surface}</GestureDetector>}

      <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={handleCloseFull} statusBarTranslucent>
        <GestureDetector gesture={fsGesture}>
          <View style={styles.fsRoot}>
            <StatusBar hidden />
            <Animated.View style={[StyleSheet.absoluteFill, fsAnimStyle]}>
              <Image source={{ uri: fsUri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={200} />
            </Animated.View>
            {flash ? <BrandFlash label={flash} /> : null}
            {galleryList ? (
              <View style={styles.counter} pointerEvents="none">
                <Text style={styles.counterText}>{fsIndex + 1} / {galleryList.length}</Text>
              </View>
            ) : null}
            <View style={styles.fsHint} pointerEvents="none">
              <Text style={styles.fsHintText}>{galleryList ? "Scorri ↕ per navigare · doppio tap per tornare" : "Doppio tap per tornare"}</Text>
            </View>
          </View>
        </GestureDetector>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flashWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  flashPill: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(10,10,10,0.72)", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.6)" },
  flashText: { color: "#fff", fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0.4 },
  fsRoot: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  counter: { position: "absolute", top: 52, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  counterText: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.5 },
  fsHint: { position: "absolute", bottom: 44, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  fsHintText: { color: "rgba(255,255,255,0.6)", fontFamily: fonts.regular, fontSize: 12 },
});
