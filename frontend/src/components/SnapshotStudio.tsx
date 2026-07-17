import React, { useEffect, useRef, useState } from "react";
import {
  Modal, StyleSheet, Text, View, Pressable, TextInput, ScrollView,
  ActivityIndicator, useWindowDimensions, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import { Canvas, Path as SkiaPath, Skia } from "@shopify/react-native-skia";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { SenseMark } from "@/src/components/SenseMark";
import { SenseMatchBar } from "@/src/components/SenseMatchBar";
import { matchTrack } from "@/src/lib/senseMatch";
import { socialApi, snapSenseApi } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

// A shared "Snapshot OverView" engine: turns any captured screen/image into a
// clean, branded, shareable Observation — with title, description, real data
// lines, source and auto hashtags. Reused across every Layer.
export interface SnapshotDataLine { icon?: string; label: string }

export interface SnapshotInput {
  uri: string;                       // captured image (file uri or data url)
  base64?: string;                   // optional raw base64 (publish fallback)
  title?: string;
  description?: string;
  source?: string;                   // e.g. "NASA GIBS · True Color"
  layerName?: string;                // e.g. "Temperatura"
  hashtags?: string[];               // extra tags (without '#')
  dataLines?: SnapshotDataLine[];    // real values to overlay
  socialSource?: string;             // createObservation.source (default "reality")
  data?: Record<string, unknown>;    // extra structured payload
  snapKind?: string;                 // SnapSense kind (universe/satellite/sense/...)
}

interface Props {
  visible: boolean;
  input: SnapshotInput | null;
  onClose: () => void;
  onPublished?: (id: string) => void;
}

function autoHashtags(input: SnapshotInput): string[] {
  const base = ["OverView", "TheInvisibleSense"];
  if (input.layerName) base.push(input.layerName.replace(/[^\p{L}\p{N}]/gu, ""));
  const extra = (input.hashtags || []).map((h) => h.replace(/^#/, ""));
  return Array.from(new Set([...base, ...extra])).filter(Boolean).slice(0, 6);
}

const IS_NATIVE = Platform.OS !== "web";
const PEN_COLORS = ["#FFD60A", "#FFFFFF", "#FF453A", "#5AB0FF", "#39FF88"];
interface Stroke { d: string; color: string; width: number }

export function SnapshotStudio({ visible, input, onClose, onPublished }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const cardRef = useRef<View>(null);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  // Skia annotation / drawing (native only)
  const [drawMode, setDrawMode] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState("");
  const currentD = useRef("");
  const [senseTrack, setSenseTrack] = useState<string | undefined>(undefined);
  const [snapVisibility, setSnapVisibility] = useState<"public" | "followers" | "private">("public");

  useEffect(() => {
    if (visible && input) {
      setTitle(input.title ?? input.layerName ?? "Observation");
      setDesc(input.description ?? "");
      setStatus(null);
      setPublishedId(null);
      setDrawMode(false);
      setStrokes([]);
      setCurrent("");
      currentD.current = "";
      setSenseTrack(undefined);
    }
  }, [visible, input]);

  const drawGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => { currentD.current = `M ${e.x.toFixed(1)} ${e.y.toFixed(1)}`; setCurrent(currentD.current); })
    .onUpdate((e) => { currentD.current += ` L ${e.x.toFixed(1)} ${e.y.toFixed(1)}`; setCurrent(currentD.current); })
    .onEnd(() => {
      const d = currentD.current;
      if (d.includes("L")) setStrokes((s) => [...s, { d, color: penColor, width: 4 }]);
      currentD.current = ""; setCurrent("");
    });

  if (!input) return null;

  const tags = autoHashtags(input);
  const senseHint = [input.layerName, input.snapKind, (input.data as Record<string, unknown> | undefined)?.from].filter(Boolean).join(" ");
  const cardW = Math.min(width - spacing.lg * 2, 520);
  const cardH = Math.round(cardW * 0.75);
  const dateStr = new Date().toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Flatten the branded card into a PNG base64 (falls back to raw capture).
  const composite = async (): Promise<{ base64: string; uri: string } | null> => {
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 0.95, result: "tmpfile" });
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return { base64, uri };
    } catch {
      if (input.base64) {
        const uri = `${FileSystem.cacheDirectory}snap_${Date.now()}.png`;
        try { await FileSystem.writeAsStringAsync(uri, input.base64, { encoding: FileSystem.EncodingType.Base64 }); } catch { /* ignore */ }
        return { base64: input.base64, uri };
      }
      return null;
    }
  };

  const publish = async () => {
    if (!user) { onClose(); router.push("/login" as never); return; }
    if (busy) return;
    setBusy(true); setStatus(null);
    try {
      const out = await composite();
      if (!out) { setStatus("Impossibile generare lo snapshot"); return; }
      const caption = [title.trim(), desc.trim()].filter(Boolean).join("\n") || (input.layerName ?? "Observation");
      const created = await socialApi.createObservation({
        media_type: "image",
        source: input.socialSource ?? "reality",
        caption,
        image_base64: out.base64,
        data: { ...(input.data ?? {}), hashtags: tags, layer: input.layerName, dataSource: input.source, snapshot: true, senseTrack: senseTrack ?? matchTrack(senseHint).id } as never,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPublishedId(created.id);
      setStatus("Pubblicato ✓");
      onPublished?.(created.id);
    } catch {
      setStatus("Pubblicazione non riuscita");
    } finally { setBusy(false); }
  };

  const publishSnapSense = async () => {
    if (!user) { onClose(); router.push("/login" as never); return; }
    if (busy) return;
    setBusy(true); setStatus(null);
    try {
      const out = await composite();
      if (!out) { setStatus("Impossibile generare lo snapshot"); return; }
      const caption = [title.trim(), desc.trim()].filter(Boolean).join(" · ") || (input.layerName ?? "");
      await snapSenseApi.create({
        kind: input.snapKind ?? "sense",
        image_base64: out.base64,
        caption,
        source: input.socialSource,
        visibility: snapVisibility,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const visLabel = snapVisibility === "public" ? "pubblico" : snapVisibility === "followers" ? "solo follower" : "solo tu";
      setStatus(`SnapSense pubblicato · visibile 24h · ${visLabel} ✓`);
    } catch {
      setStatus("SnapSense non riuscito");
    } finally { setBusy(false); }
  };

  const saveOrShare = async () => {
    setBusy(true);
    try {
      const out = await composite();
      if (!out) { setStatus("Impossibile generare lo snapshot"); return; }
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.granted) { await MediaLibrary.saveToLibraryAsync(out.uri); setStatus("Salvato in Foto ✓"); }
      else if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(out.uri); }
      else { setStatus("Salvataggio non disponibile"); }
    } catch { setStatus("Salvataggio non riuscito"); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.backdrop}>
        <View style={[styles.sheet, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handleRow}>
            <Text style={styles.heading}>Snapshot OverView</Text>
            <Pressable testID="snapstudio-close" onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={26} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={!drawMode} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            {/* The branded, capturable card */}
            <View ref={cardRef} collapsable={false} style={[styles.card, { width: cardW, height: cardH, alignSelf: "center" }]}>
              <Image source={{ uri: input.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
              <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.92)"]} locations={[0, 0.3, 0.6, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.cardTop}>
                <SenseMark size={26} />
                <View>
                  <Text style={styles.wordmark}>OverView</Text>
                  <Text style={styles.tag}>THE INVISIBLE SENSE</Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                {input.layerName ? <Text style={styles.layerLabel}>{input.layerName.toUpperCase()}</Text> : null}
                <Text style={styles.cardTitle} numberOfLines={2}>{title || "Observation"}</Text>
                {(input.dataLines ?? []).slice(0, 4).map((l, i) => (
                  <Text key={i} style={styles.cardData}>{l.icon ? `${l.icon}  ` : ""}{l.label}</Text>
                ))}
                <Text style={styles.cardMeta}>{dateStr}{input.source ? ` · ${input.source}` : ""}</Text>
              </View>
              {/* Skia annotation layer (drawings are captured into the final image) */}
              {IS_NATIVE ? (
                <View style={StyleSheet.absoluteFill} pointerEvents={drawMode ? "auto" : "none"}>
                  <GestureDetector gesture={drawGesture}>
                    <Canvas style={StyleSheet.absoluteFill}>
                      {strokes.map((s, i) => {
                        const p = Skia.Path.MakeFromSVGString(s.d);
                        return p ? <SkiaPath key={i} path={p} color={s.color} style="stroke" strokeWidth={s.width} strokeCap="round" strokeJoin="round" /> : null;
                      })}
                      {current ? (() => {
                        const p = Skia.Path.MakeFromSVGString(current);
                        return p ? <SkiaPath path={p} color={penColor} style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round" /> : null;
                      })() : null}
                    </Canvas>
                  </GestureDetector>
                </View>
              ) : null}
              <View style={styles.frame} pointerEvents="none" />
            </View>

            {/* Annotation toolbar */}
            {IS_NATIVE ? (
              <View style={styles.drawBar}>
                <Pressable testID="snapstudio-draw-toggle" style={[styles.drawToggle, drawMode && styles.drawToggleOn]} onPress={() => { Haptics.selectionAsync(); setDrawMode((m) => !m); }}>
                  <Ionicons name="brush" size={15} color={drawMode ? colors.onBrand : colors.onSurface} />
                  <Text style={[styles.drawToggleText, drawMode && { color: colors.onBrand }]}>{drawMode ? "Disegno ON" : "Disegna"}</Text>
                </Pressable>
                {drawMode ? (
                  <>
                    {PEN_COLORS.map((c) => (
                      <Pressable key={c} testID={`snapstudio-pen-${c}`} onPress={() => { Haptics.selectionAsync(); setPenColor(c); }}
                        style={[styles.swatch, { backgroundColor: c }, penColor === c && styles.swatchOn]} />
                    ))}
                    <Pressable testID="snapstudio-undo" style={styles.drawIcon} onPress={() => setStrokes((s) => s.slice(0, -1))}>
                      <Ionicons name="arrow-undo" size={16} color={colors.onSurface} />
                    </Pressable>
                    <Pressable testID="snapstudio-clear" style={styles.drawIcon} onPress={() => { setStrokes([]); setCurrent(""); }}>
                      <Ionicons name="trash-outline" size={16} color={colors.onSurface} />
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.drawHint}>Evidenzia e annota il tuo Senshot</Text>
                )}
              </View>
            ) : null}

            {/* Editable fields */}
            <TextInput testID="snapstudio-title" style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Titolo" placeholderTextColor={colors.onSurfaceSecondary} maxLength={90} />
            <TextInput testID="snapstudio-desc" style={[styles.input, styles.inputMulti]} value={desc} onChangeText={setDesc}
              placeholder="Descrizione (facoltativa)" placeholderTextColor={colors.onSurfaceSecondary} multiline maxLength={500} />

            <View style={styles.tagRow}>
              {tags.map((t) => <Text key={t} style={styles.tagChip}>#{t}</Text>)}
            </View>

            {/* Sense Match™ — pick a royalty-free / CC0 soundtrack for this Senshot */}
            <SenseMatchBar hint={senseHint} trackId={senseTrack} onPick={setSenseTrack} />

            {/* SnapSense privacy — who can see the 24h ephemeral SnapSense */}
            <View style={styles.privRow}>
              <Text style={styles.privLabel}>Privacy SnapSense</Text>
              <View style={styles.privSeg}>
                {([
                  { k: "public", icon: "earth", label: "Tutti" },
                  { k: "followers", icon: "people", label: "Follower" },
                  { k: "private", icon: "lock-closed", label: "Solo tu" },
                ] as const).map((o) => {
                  const on = snapVisibility === o.k;
                  return (
                    <Pressable key={o.k} testID={`snap-vis-${o.k}`} style={[styles.privOpt, on && styles.privOptOn]}
                      onPress={() => { Haptics.selectionAsync(); setSnapVisibility(o.k); }}>
                      <Ionicons name={o.icon} size={13} color={on ? colors.onBrand : colors.onSurfaceSecondary} />
                      <Text style={[styles.privOptText, on && { color: colors.onBrand }]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {status ? <Text style={[styles.status, status.includes("✓") && { color: colors.brand }]}>{status}</Text> : null}
          </ScrollView>

          {/* Actions */}
          {publishedId ? (
            <Pressable testID="snapstudio-open" style={styles.primary} onPress={() => { onClose(); router.push(`/observation-detail?id=${publishedId}` as never); }}>
              <Ionicons name="sparkles" size={16} color={colors.onBrand} />
              <Text style={styles.primaryText}>Apri nell&apos;OverView Sense Universe</Text>
            </Pressable>
          ) : (
            <Pressable testID="snapstudio-publish" style={[styles.primary, busy && { opacity: 0.7 }]} onPress={publish} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.onBrand} /> : (
                <><Ionicons name="cloud-upload-outline" size={16} color={colors.onBrand} /><Text style={styles.primaryText}>Pubblica come Observation</Text></>
              )}
            </Pressable>
          )}
          <View style={styles.actionRow}>
            <Pressable testID="snapstudio-snapsense" style={[styles.ghost, styles.ghostFlex]} onPress={publishSnapSense} disabled={busy}>
              <Ionicons name="flash-outline" size={16} color={colors.onSurface} />
              <Text style={styles.ghostText}>SnapSense 24h</Text>
            </Pressable>
            <Pressable testID="snapstudio-save" style={[styles.ghost, styles.ghostFlex]} onPress={saveOrShare} disabled={busy}>
              <Ionicons name="download-outline" size={16} color={colors.onSurface} />
              <Text style={styles.ghostText}>Salva / Condividi</Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, maxHeight: "94%", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  handleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  heading: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  card: { backgroundColor: "#0A0A0A", overflow: "hidden", borderRadius: 18 },
  cardTop: { position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  wordmark: { color: "#fff", fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 1 },
  tag: { color: colors.brand, fontFamily: fonts.regular, fontSize: 8, letterSpacing: 2.5, marginTop: 1 },
  cardBottom: { position: "absolute", left: 14, right: 14, bottom: 14, gap: 3 },
  layerLabel: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.5, marginBottom: 2 },
  cardTitle: { color: "#fff", fontFamily: fonts.semibold, fontSize: 18 },
  cardData: { color: "#F2F2F2", fontFamily: fonts.medium, fontSize: 12 },
  cardMeta: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.regular, fontSize: 10, marginTop: 5 },
  frame: { ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.5)" },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inputMulti: { minHeight: 64, textAlignVertical: "top" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tagChip: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, overflow: "hidden" },
  status: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, textAlign: "center" },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13 },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  ghost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginTop: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  ghostFlex: { flex: 1 },
  ghostText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  drawBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  drawToggle: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  drawToggleOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  drawToggleText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  swatchOn: { borderColor: "#fff" },
  drawIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  drawHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, flex: 1 },
  privRow: { gap: 6 },
  privLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  privSeg: { flexDirection: "row", gap: spacing.sm },
  privOpt: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  privOptOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  privOptText: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm - 2 },
});
