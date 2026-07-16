import React, { useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

// #3 Fase A — creative text editor (Stories-like). Add/drag/scale/rotate text with
// multiple fonts & colors, plus quick time/date/location chips. Everything happens
// BEFORE publishing; the composited image is captured and used as the SenseShot.

export interface TextOverlay { id: string; text: string; color: string; font: string; init: { x: number; y: number } }
export interface StickerOverlay { id: string; emoji: string; init: { x: number; y: number } }

const FONTS = [fonts.bold, fonts.regular, fonts.mono, fonts.semibold];
const FONT_LABELS = ["Bold", "Regular", "Mono", "Medium"];
const PALETTE = ["#FFFFFF", "#000000", "#D4AF37", "#FF453A", "#0A84FF", "#30D158", "#FF9F0A", "#BF5AF2"];
const EMOJIS = ["✨", "🌙", "🪐", "☀️", "⭐", "🌈", "🛰", "🌌", "🔭", "🌸", "🐦", "🌊", "🌋", "🏔", "❤️", "🔥", "👁", "🧭", "📍", "🌡", "🧲", "🎵"];

function DraggableText({ item, selected, onSelect, onEdit }: {
  item: TextOverlay; selected: boolean; onSelect: () => void; onEdit: () => void;
}) {
  const tx = useSharedValue(item.init.x);
  const ty = useSharedValue(item.init.y);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const rot = useSharedValue(0);
  const savedRot = useSharedValue(0);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => { ox.value = tx.value; oy.value = ty.value; })
    .onUpdate((e) => { tx.value = ox.value + e.translationX; ty.value = oy.value + e.translationY; });
  const pinch = Gesture.Pinch()
    .onBegin(() => { savedScale.value = scale.value; })
    .onUpdate((e) => { scale.value = Math.max(0.4, Math.min(5, savedScale.value * e.scale)); });
  const rotate = Gesture.Rotation()
    .onBegin(() => { savedRot.value = rot.value; })
    .onUpdate((e) => { rot.value = savedRot.value + e.rotation; });
  const tap = Gesture.Tap().onEnd(() => onSelect());
  const dtap = Gesture.Tap().numberOfTaps(2).onEnd(() => onEdit());
  const g = Gesture.Simultaneous(pan, pinch, rotate, Gesture.Exclusive(dtap, tap));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }, { rotateZ: `${rot.value}rad` }],
  }));

  return (
    <GestureDetector gesture={g}>
      <Animated.View style={[styles.textWrap, style, selected && styles.textWrapSel]}>
        <Text style={[styles.overlayText, { color: item.color, fontFamily: item.font }]}>{item.text || " "}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

function DraggableSticker({ item, selected, onSelect }: {
  item: StickerOverlay; selected: boolean; onSelect: () => void;
}) {
  const tx = useSharedValue(item.init.x);
  const ty = useSharedValue(item.init.y);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const rot = useSharedValue(0);
  const savedRot = useSharedValue(0);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => { ox.value = tx.value; oy.value = ty.value; })
    .onUpdate((e) => { tx.value = ox.value + e.translationX; ty.value = oy.value + e.translationY; });
  const pinch = Gesture.Pinch()
    .onBegin(() => { savedScale.value = scale.value; })
    .onUpdate((e) => { scale.value = Math.max(0.4, Math.min(6, savedScale.value * e.scale)); });
  const rotate = Gesture.Rotation()
    .onBegin(() => { savedRot.value = rot.value; })
    .onUpdate((e) => { rot.value = savedRot.value + e.rotation; });
  const tap = Gesture.Tap().onEnd(() => onSelect());
  const g = Gesture.Simultaneous(pan, pinch, rotate, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }, { rotateZ: `${rot.value}rad` }],
  }));

  return (
    <GestureDetector gesture={g}>
      <Animated.View style={[styles.stickerWrap, style, selected && styles.textWrapSel]}>
        <Text style={styles.stickerText}>{item.emoji}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

export function SenseEditor({ uri, place, onCancel, onDone }: {
  uri: string; place?: string | null; onCancel: () => void; onDone: (newUri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const shotRef = useRef<View>(null);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [stickers, setStickers] = useState<StickerOverlay[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [color, setColor] = useState("#FFFFFF");
  const [fontIdx, setFontIdx] = useState(0);
  const [editing, setEditing] = useState<TextOverlay | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [emojiTray, setEmojiTray] = useState(false);
  const [paths, setPaths] = useState<{ d: string; color: string; width: number }[]>([]);
  const [curD, setCurD] = useState("");
  const cur = useRef("");

  const H = width * 1.25;

  const startAdd = (preset?: string) => {
    Haptics.selectionAsync();
    const t: TextOverlay = { id: `${Date.now()}`, text: preset || "", color, font: FONTS[fontIdx], init: { x: 0, y: 0 } };
    if (preset) { setOverlays((o) => [...o, t]); setSelId(t.id); }
    else { setEditing(t); setDraft(""); }
  };

  const commitEdit = () => {
    if (!editing) return;
    const text = draft.trim();
    if (text) {
      setOverlays((o) => o.some((x) => x.id === editing.id)
        ? o.map((x) => (x.id === editing.id ? { ...x, text } : x))
        : [...o, { ...editing, text, color, font: FONTS[fontIdx] }]);
      setSelId(editing.id);
    }
    setEditing(null); setDraft("");
  };

  const applyColor = (c: string) => { setColor(c); if (selId) setOverlays((o) => o.map((x) => (x.id === selId ? { ...x, color: c } : x))); };
  const cycleFont = () => { const n = (fontIdx + 1) % FONTS.length; setFontIdx(n); if (selId) setOverlays((o) => o.map((x) => (x.id === selId ? { ...x, font: FONTS[n] } : x))); };
  const delSel = () => { if (selId) { setOverlays((o) => o.filter((x) => x.id !== selId)); setStickers((s) => s.filter((x) => x.id !== selId)); setSelId(null); } };

  const addSticker = (emoji: string) => {
    Haptics.selectionAsync();
    const s: StickerOverlay = { id: `s${Date.now()}`, emoji, init: { x: 0, y: 0 } };
    setStickers((arr) => [...arr, s]);
    setSelId(s.id);
    setEmojiTray(false);
  };

  const drawPan = Gesture.Pan().runOnJS(true)
    .onBegin((e) => { cur.current = `M ${e.x.toFixed(1)} ${e.y.toFixed(1)}`; setCurD(cur.current); })
    .onUpdate((e) => { cur.current += ` L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`; setCurD(cur.current); })
    .onEnd(() => { if (cur.current.includes("L")) setPaths((p) => [...p, { d: cur.current, color, width: 5 }]); cur.current = ""; setCurD(""); });
  const undoDraw = () => setPaths((p) => p.slice(0, -1));

  const now = new Date();
  const chips: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: "time", label: "Ora", value: now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) },
    { icon: "calendar", label: "Data", value: now.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) },
    ...(place ? [{ icon: "location" as const, label: "Luogo", value: place }] : []),
  ];

  const finish = async () => {
    setSaving(true);
    setSelId(null);
    try {
      // small delay so the selection border is cleared before capture
      await new Promise((r) => setTimeout(r, 60));
      const out = await captureRef(shotRef, { format: "jpg", quality: 0.95 });
      onDone(out);
    } catch { onCancel(); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      {/* Canvas */}
      <Pressable style={[styles.canvasWrap, { marginTop: insets.top + 44 }]} onPress={() => setSelId(null)}>
        <View ref={shotRef} collapsable={false} style={[styles.canvas, { width, height: H }]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {paths.map((p, i) => <Path key={i} d={p.d} stroke={p.color} strokeWidth={p.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            {curD ? <Path d={curD} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
          </Svg>
          {overlays.map((o) => (
            <DraggableText key={o.id} item={o} selected={selId === o.id}
              onSelect={() => setSelId(o.id)} onEdit={() => { setEditing(o); setDraft(o.text); }} />
          ))}
          {stickers.map((s) => (
            <DraggableSticker key={s.id} item={s} selected={selId === s.id} onSelect={() => setSelId(s.id)} />
          ))}
          {drawMode ? (
            <GestureDetector gesture={drawPan}>
              <Animated.View style={StyleSheet.absoluteFill} />
            </GestureDetector>
          ) : null}
        </View>
      </Pressable>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 4 }]}>
        <Pressable testID="editor-cancel" hitSlop={10} onPress={onCancel}><Ionicons name="close" size={26} color="#fff" /></Pressable>
        <View style={styles.topActions}>
          {drawMode && paths.length > 0 ? <Pressable testID="editor-undo" hitSlop={10} onPress={undoDraw}><Ionicons name="arrow-undo" size={22} color="#fff" /></Pressable> : null}
          {selId ? <Pressable testID="editor-delete" hitSlop={10} onPress={delSel}><Ionicons name="trash" size={22} color="#fff" /></Pressable> : null}
          <Pressable testID="editor-draw" hitSlop={10} onPress={() => { setDrawMode((v) => !v); setSelId(null); setEmojiTray(false); }}>
            <Ionicons name="brush" size={22} color={drawMode ? colors.brand : "#fff"} />
          </Pressable>
          <Pressable testID="editor-emoji" hitSlop={10} onPress={() => { setEmojiTray((v) => !v); setDrawMode(false); }}>
            <Ionicons name="happy" size={22} color={emojiTray ? colors.brand : "#fff"} />
          </Pressable>
          <Pressable testID="editor-font" style={styles.fontBtn} onPress={cycleFont}><Text style={[styles.fontBtnText, { fontFamily: FONTS[fontIdx] }]}>{FONT_LABELS[fontIdx]}</Text></Pressable>
        </View>
        <Pressable testID="editor-done" style={styles.doneBtn} onPress={finish} disabled={saving}>
          <Text style={styles.doneText}>{saving ? "…" : "Fatto"}</Text>
        </Pressable>
      </View>

      {/* Quick chips */}
      <View style={[styles.chipsRow, { bottom: insets.bottom + 132 }]}>
        {chips.map((c) => (
          <Pressable key={c.label} testID={`editor-chip-${c.label}`} style={styles.chip} onPress={() => startAdd(c.value)}>
            <Ionicons name={c.icon} size={13} color="#fff" />
            <Text style={styles.chipText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Palette + add */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.palette}>
          {PALETTE.map((c) => (
            <Pressable key={c} testID={`editor-color-${c}`} onPress={() => applyColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />
          ))}
        </ScrollView>
        <Pressable testID="editor-add-text" style={styles.addText} onPress={() => startAdd()}>
          <Ionicons name="text" size={18} color={colors.onBrand} />
          <Text style={styles.addTextLabel}>Aggiungi testo</Text>
        </Pressable>
      </View>

      {/* Emoji tray */}
      {emojiTray ? (
        <View style={[styles.emojiTray, { bottom: insets.bottom + 132 }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.emojiGrid}>
            {EMOJIS.map((e) => (
              <Pressable key={e} testID={`editor-emoji-${e}`} style={styles.emojiCell} onPress={() => addSticker(e)}>
                <Text style={styles.emojiCellText}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Text input overlay */}
      {editing ? (
        <View style={styles.editScrim}>
          <TextInput testID="editor-input" style={[styles.editInput, { color, fontFamily: FONTS[fontIdx] }]}
            value={draft} onChangeText={setDraft} placeholder="Scrivi qualcosa…" placeholderTextColor="rgba(255,255,255,0.5)"
            autoFocus multiline onSubmitEditing={commitEdit} />
          <Pressable testID="editor-input-done" style={styles.editDone} onPress={commitEdit}><Text style={styles.doneText}>OK</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  canvasWrap: { alignItems: "center" },
  canvas: { overflow: "hidden", backgroundColor: "#111" },
  textWrap: { position: "absolute", alignSelf: "center", top: "44%", padding: 6 },
  textWrapSel: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderStyle: "dashed", borderRadius: 6 },
  stickerWrap: { position: "absolute", alignSelf: "center", top: "42%", padding: 4 },
  stickerText: { fontSize: 64 },
  emojiTray: { position: "absolute", left: spacing.lg, right: spacing.lg, maxHeight: 220, backgroundColor: "rgba(20,20,22,0.94)", borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.15)" },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  emojiCell: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  emojiCellText: { fontSize: 30 },
  overlayText: { fontSize: 30, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 6, textAlign: "center" },
  topBar: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  fontBtn: { backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.3)" },
  fontBtnText: { color: "#fff", fontSize: type.sm },
  doneBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 7 },
  doneText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm },
  chipsRow: { position: "absolute", left: spacing.lg, flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.25)" },
  chipText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 1 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  palette: { gap: spacing.sm, alignItems: "center" },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },
  swatchOn: { borderColor: colors.brand, transform: [{ scale: 1.15 }] },
  addText: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 12 },
  addTextLabel: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
  editScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  editInput: { minWidth: "70%", maxWidth: "90%", fontSize: 28, textAlign: "center" },
  editDone: { position: "absolute", top: 60, right: spacing.lg, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 8 },
});
