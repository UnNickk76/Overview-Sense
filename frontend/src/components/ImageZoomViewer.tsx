import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable, Modal, useWindowDimensions, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, type } from "@/src/theme";
import { CosmicImage } from "@/src/lib/backend";

function ZoomPage({ uri, width, height, onZoomChange }: { uri: string; width: number; height: number; onZoomChange: (z: boolean) => void }) {
  const scale = useSharedValue(1);
  const start = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const notify = (z: boolean) => onZoomChange(z);

  const pinch = Gesture.Pinch()
    .onStart(() => { start.value = scale.value; })
    .onUpdate((e) => { scale.value = Math.max(1, Math.min(5, start.value * e.scale)); })
    .onEnd(() => {
      if (scale.value <= 1.05) { scale.value = withTiming(1); tx.value = withTiming(0); ty.value = withTiming(0); runOnJS(notify)(false); }
      else { runOnJS(notify)(true); }
    });

  const pan = Gesture.Pan()
    .onStart(() => { startX.value = tx.value; startY.value = ty.value; })
    .onUpdate((e) => {
      if (scale.value > 1.05) { tx.value = startX.value + e.translationX; ty.value = startY.value + e.translationY; }
    });

  const dtap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    if (scale.value > 1.05) { scale.value = withTiming(1); tx.value = withTiming(0); ty.value = withTiming(0); runOnJS(notify)(false); }
    else { scale.value = withTiming(2.5); runOnJS(notify)(true); }
  });

  const composed = Gesture.Simultaneous(pinch, pan, dtap);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height, alignItems: "center", justifyContent: "center" }, style]}>
        <Image source={{ uri }} style={{ width, height }} contentFit="contain" transition={150} />
      </Animated.View>
    </GestureDetector>
  );
}

interface Props {
  images: CosmicImage[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

export function ImageZoomViewer({ images, initialIndex, visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const current = images[index];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <GestureHandlerRootView style={styles.root}>
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((img, i) => (
            <ZoomPage key={i} uri={img.image} width={width} height={height} onZoomChange={setZoomed} />
          ))}
        </ScrollView>

        <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
          <Pressable testID="zoom-close" style={styles.closeBtn} hitSlop={12} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.counter}>{index + 1} / {images.length}</Text>
        </View>

        {current ? (
          <View style={[styles.caption, { paddingBottom: insets.bottom + spacing.lg }]}>
            {current.title ? <Text style={styles.capTitle} numberOfLines={2}>{current.title}</Text> : null}
            <Text style={styles.capHint}>Pizzica per zoomare · doppio tap · scorri per la prossima</Text>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  counter: { color: "#fff", fontFamily: fonts.mono, fontSize: type.sm },
  caption: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, gap: 4 },
  capTitle: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base },
  capHint: { color: "rgba(255,255,255,0.6)", fontFamily: fonts.regular, fontSize: type.sm - 1 },
});
