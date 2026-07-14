import React, { useEffect, useRef, useState } from "react";
import {
  Modal, StyleSheet, Text, View, Pressable, TextInput, ScrollView,
  ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

  useEffect(() => {
    if (visible && input) {
      setTitle(input.title ?? input.layerName ?? "Observation");
      setDesc(input.description ?? "");
      setStatus(null);
      setPublishedId(null);
    }
  }, [visible, input]);

  if (!input) return null;

  const tags = autoHashtags(input);
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
        data: { ...(input.data ?? {}), hashtags: tags, layer: input.layerName, dataSource: input.source, snapshot: true } as never,
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
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus("SnapSense pubblicato · visibile 24h ✓");
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
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handleRow}>
            <Text style={styles.heading}>Snapshot OverView</Text>
            <Pressable testID="snapstudio-close" onPress={onClose} hitSlop={10}>
              <Ionicons name="close-circle" size={26} color={colors.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
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
              <View style={styles.frame} pointerEvents="none" />
            </View>

            {/* Editable fields */}
            <TextInput testID="snapstudio-title" style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Titolo" placeholderTextColor={colors.onSurfaceSecondary} maxLength={90} />
            <TextInput testID="snapstudio-desc" style={[styles.input, styles.inputMulti]} value={desc} onChangeText={setDesc}
              placeholder="Descrizione (facoltativa)" placeholderTextColor={colors.onSurfaceSecondary} multiline maxLength={500} />

            <View style={styles.tagRow}>
              {tags.map((t) => <Text key={t} style={styles.tagChip}>#{t}</Text>)}
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
      </View>
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
});
