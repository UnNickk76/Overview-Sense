import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, Modal, TextInput,
  ActivityIndicator, useWindowDimensions, PanResponder,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { snapSenseApi, pulseApi, SnapGroup, FeedObservation, mediaUrl } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TEXT_BGS = ["#0d2947", "#3a1d5c", "#5c1d2e", "#1d5c3a", "#5c4a1d", "#1d3a5c"];

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}g`;
}

function Ring({ group, isOwn, onPress }: { group: SnapGroup; isOwn: boolean; onPress: () => void }) {
  const avatar = mediaUrl(group.avatar_url);
  const unseen = group.has_unseen !== false;
  return (
    <Pressable testID={`snap-ring-${group.user_id}`} style={styles.ringItem} onPress={onPress}>
      <View style={[styles.ring, !unseen && styles.ringSeen]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" transition={120} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarInitial}>{(group.nickname || "?").charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <Text style={styles.ringName} numberOfLines={1}>{isOwn ? "Tu" : group.nickname}</Text>
    </Pressable>
  );
}

function PulseRing({ obs, glow, onPress }: { obs: FeedObservation; glow: ReturnType<typeof useAnimatedStyle>; onPress: () => void }) {
  const img = mediaUrl(obs.image_url);
  return (
    <Pressable testID={`pulse-ring-${obs.id}`} style={styles.ringItem} onPress={onPress}>
      <View style={styles.ringPulseWrap}>
        <Animated.View style={[styles.ringPulseGlow, glow]} pointerEvents="none" />
        <View style={styles.ringPulse}>
          {img ? <Image source={{ uri: img }} style={styles.avatar} contentFit="cover" transition={120} />
            : <View style={[styles.avatar, styles.avatarEmpty]}><Ionicons name="flash" size={22} color={colors.brand} /></View>}
        </View>
        <View style={styles.pulseFlash}><Ionicons name="flash" size={10} color={colors.onBrand} /></View>
      </View>
      <Text style={styles.ringName} numberOfLines={1}>{obs.nickname}</Text>
    </Pressable>
  );
}

export function SnapSenseBar() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [groups, setGroups] = useState<SnapGroup[]>([]);
  const [pulses, setPulses] = useState<FeedObservation[]>([]);
  const [viewer, setViewer] = useState<{ g: number; i: number } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [text, setText] = useState("");
  const [bg, setBg] = useState(TEXT_BGS[0]);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [paused, setPaused] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const pressAt = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shared "pulse" glow for every Pulse ring (gold, subtly alive).
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.5, transform: [{ scale: 1 + glow.value * 0.06 }] }));

  const load = useCallback(() => {
    snapSenseApi.list().then((r) => setGroups(r.groups)).catch(() => {});
    pulseApi.feed().then((r) => setPulses(r.items.slice(0, 12))).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const ownGroup = user ? groups.find((g) => g.user_id === user.id) : undefined;

  // ---- Viewer auto-advance ----
  const advance = useCallback(() => {
    setViewer((v) => {
      if (!v) return v;
      const g = groups[v.g];
      if (!g) return null;
      if (v.i + 1 < g.items.length) return { g: v.g, i: v.i + 1 };
      if (v.g + 1 < groups.length) return { g: v.g + 1, i: 0 };
      return null;
    });
  }, [groups]);

  useEffect(() => {
    if (!viewer) { if (tick.current) clearInterval(tick.current); return; }
    const g = groups[viewer.g];
    const item = g?.items[viewer.i];
    if (!item) return;
    // mark seen (best-effort)
    if (user && g.user_id !== user.id) { snapSenseApi.seen(item.id).catch(() => {}); }
    setProg(0);
    const duration = item.media_type === "image" ? 10000 : 7000;
    const step = 50;
    if (tick.current) clearInterval(tick.current);
    tick.current = setInterval(() => {
      setProg((p) => {
        if (paused) return p;
        const np = p + step / duration;
        if (np >= 1) { advance(); return 0; }
        return np;
      });
    }, step);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [viewer, advance, paused, groups, user]);

  const prev = () => setViewer((v) => {
    if (!v) return v;
    if (v.i > 0) return { g: v.g, i: v.i - 1 };
    if (v.g > 0) { const pg = groups[v.g - 1]; return { g: v.g - 1, i: Math.max(0, pg.items.length - 1) }; }
    return v;
  });

  const openGroup = (idx: number) => {
    Haptics.selectionAsync();
    const g = groups[idx];
    const firstUnseen = g ? g.items.findIndex((it) => !it.seen) : -1;
    setViewer({ g: idx, i: firstUnseen >= 0 ? firstUnseen : 0 });
  };

  // Swipe: down → close, horizontal → prev/next user.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dy) > 16 || Math.abs(gs.dx) > 24,
    onPanResponderGrant: () => setPaused(true),
    onPanResponderRelease: (_e, gs) => {
      setPaused(false);
      if (gs.dy > 90 && Math.abs(gs.dy) > Math.abs(gs.dx)) { setViewer(null); return; }
      if (gs.dx < -70) { setViewer((v) => (v && v.g + 1 < groups.length ? { g: v.g + 1, i: 0 } : null)); }
      else if (gs.dx > 70) { setViewer((v) => (v && v.g > 0 ? { g: v.g - 1, i: 0 } : v)); }
    },
  })).current;

  // ---- Create ----
  const pickImage = async (fromCamera: boolean) => {
    if (!user) { setCreateOpen(false); router.push("/login" as never); return; }
    const cur = fromCamera ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
    let ok = cur.granted;
    if (!ok && cur.canAskAgain) {
      const req = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      ok = req.granted;
    }
    if (!ok) return;
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setBusy(true);
    try {
      const manip = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 1080 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (manip.base64) {
        await snapSenseApi.create({ kind: "photo", image_base64: manip.base64 });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCreateOpen(false); load();
      }
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const publishText = async () => {
    if (!user) { setCreateOpen(false); router.push("/login" as never); return; }
    if (!text.trim()) return;
    setBusy(true);
    try {
      await snapSenseApi.create({ kind: "text", caption: text.trim(), bg_color: bg });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setText(""); setCreateOpen(false); load();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const deleteCurrent = async () => {
    if (!viewer) return;
    const item = groups[viewer.g]?.items[viewer.i];
    if (!item) return;
    try { await snapSenseApi.remove(item.id); } catch { /* ignore */ }
    setViewer(null); load();
  };

  const curItem = viewer ? groups[viewer.g]?.items[viewer.i] : null;
  const curGroup = viewer ? groups[viewer.g] : null;

  // Interleave user SnapSenses with published Pulses — one natural flow.
  const orderedGroups = ownGroup
    ? [ownGroup, ...groups.filter((g) => g.user_id !== user?.id)]
    : groups.filter((g) => g.user_id !== user?.id);
  const sequence: Array<{ type: "snap"; group: SnapGroup } | { type: "pulse"; obs: FeedObservation }> = [];
  const maxLen = Math.max(orderedGroups.length, pulses.length);
  for (let i = 0; i < maxLen; i++) {
    if (orderedGroups[i]) sequence.push({ type: "snap", group: orderedGroups[i] });
    if (pulses[i]) sequence.push({ type: "pulse", obs: pulses[i] });
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {/* Create ring */}
        <Pressable testID="snap-create" style={styles.ringItem} onPress={() => (user ? setCreateOpen(true) : router.push("/login" as never))}>
          <View style={[styles.ring, styles.ringCreate]}>
            <Ionicons name="add" size={26} color={colors.brand} />
          </View>
          <Text style={styles.ringName} numberOfLines={1}>SnapSense</Text>
        </Pressable>

        {/* OverView Pulse of the day — always first, gold + alive */}
        <Pressable testID="pulse-overview-ring" style={styles.ringItem}
          onPress={() => { Haptics.selectionAsync(); router.push("/challenges" as never); }}>
          <View style={styles.ringPulseWrap}>
            <Animated.View style={[styles.ringPulseGlow, glowStyle]} pointerEvents="none" />
            <View style={[styles.ringPulse, styles.ringPulseHome]}>
              <Ionicons name="flash" size={26} color={colors.brand} />
            </View>
          </View>
          <Text style={[styles.ringName, { color: colors.brand }]} numberOfLines={1}>Pulse</Text>
        </Pressable>

        {sequence.map((s) =>
          s.type === "snap"
            ? <Ring key={`s-${s.group.user_id}`} group={s.group} isOwn={s.group.user_id === user?.id} onPress={() => openGroup(groups.indexOf(s.group))} />
            : <PulseRing key={`p-${s.obs.id}`} obs={s.obs} glow={glowStyle}
                onPress={() => { Haptics.selectionAsync(); router.push(`/pulse-view?id=${s.obs.id}` as never); }} />
        )}
      </ScrollView>

      {/* ---- Viewer ---- */}
      <Modal visible={!!viewer} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer} {...pan.panHandlers}>
          {curGroup && curItem ? (
            <>
              {/* Progress bars */}
              <View style={[styles.progressRow, { top: 46 }]}>
                {curGroup.items.map((_, k) => (
                  <View key={k} style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: k < viewer!.i ? "100%" : k === viewer!.i ? `${Math.min(100, prog * 100)}%` : "0%" }]} />
                  </View>
                ))}
              </View>
              {/* Header */}
              <View style={[styles.vHeader, { top: 58 }]}>
                {mediaUrl(curGroup.avatar_url) ? (
                  <Image source={{ uri: mediaUrl(curGroup.avatar_url)! }} style={styles.vAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.vAvatar, styles.avatarEmpty]}><Text style={styles.avatarInitial}>{(curGroup.nickname || "?").charAt(0).toUpperCase()}</Text></View>
                )}
                <Text style={styles.vName}>{curGroup.nickname}</Text>
                <View style={[styles.kindBadge, curItem.kind === "pulse" && styles.kindBadgePulse]}>
                  <Ionicons name={curItem.kind === "pulse" ? "pulse" : "sparkles"} size={10} color={curItem.kind === "pulse" ? colors.onBrand : "#fff"} />
                  <Text style={[styles.kindBadgeTxt, curItem.kind === "pulse" && { color: colors.onBrand }]}>{curItem.kind === "pulse" ? "Pulse™" : "SnapSense™"}</Text>
                </View>
                <Text style={styles.vTime}>{timeAgo(curItem.created_at)}</Text>
                <View style={{ flex: 1 }} />
                {curGroup.user_id === user?.id ? (
                  <Pressable testID="snap-delete" hitSlop={8} onPress={deleteCurrent} style={{ marginRight: spacing.md }}>
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                  </Pressable>
                ) : null}
                <Pressable testID="snap-viewer-close" hitSlop={8} onPress={() => setViewer(null)}>
                  <Ionicons name="close" size={26} color="#fff" />
                </Pressable>
              </View>

              {/* Content */}
              {curItem.media_type === "image" && curItem.image_url ? (
                <Image source={{ uri: mediaUrl(curItem.image_url)! }} style={styles.vImage} contentFit="contain" transition={150} />
              ) : (
                <View style={[styles.vText, { backgroundColor: curItem.bg_color || TEXT_BGS[0] }]}>
                  <Text style={styles.vTextContent}>{curItem.caption}</Text>
                </View>
              )}
              {curItem.media_type === "image" && curItem.caption ? (
                <View style={styles.vCaptionWrap}><Text style={styles.vCaption}>{curItem.caption}</Text></View>
              ) : null}

              {/* Tap zones — short tap navigates, hold pauses */}
              <Pressable style={[styles.tapZone, { left: 0, width: width * 0.32 }]}
                onPressIn={() => { pressAt.current = Date.now(); setPaused(true); }}
                onPressOut={() => { setPaused(false); if (Date.now() - pressAt.current < 260) prev(); }} />
              <Pressable style={[styles.tapZone, { right: 0, width: width * 0.68 }]}
                onPressIn={() => { pressAt.current = Date.now(); setPaused(true); }}
                onPressOut={() => { setPaused(false); if (Date.now() - pressAt.current < 260) advance(); }} />

              {/* Overlay controls — minimal, transparent */}
              <View style={[styles.controls, { bottom: insets.bottom + 14 }]}>
                <View style={styles.replyField} pointerEvents="none">
                  <Text style={styles.replyPlaceholder}>Invia un messaggio…</Text>
                </View>
                <Pressable testID="snap-react" style={styles.ctrlBtn} onPress={() => { Haptics.selectionAsync(); }}>
                  <Ionicons name="heart-outline" size={24} color="#fff" />
                </Pressable>
                <Pressable testID="snap-audio" style={styles.ctrlBtn} onPress={() => { Haptics.selectionAsync(); setAudioOn((v) => !v); }}>
                  <Ionicons name={audioOn ? "volume-high" : "volume-mute"} size={22} color="#fff" />
                </Pressable>
                <Pressable testID="snap-menu" style={styles.ctrlBtn} onPress={() => { Haptics.selectionAsync(); }}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </Modal>

      {/* ---- Create sheet ---- */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreateOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Nuovo SnapSense™</Text>
          <Text style={styles.sheetSub}>Un&apos;osservazione temporanea, visibile 24 ore.</Text>

          <View style={styles.optRow}>
            <Pressable testID="snap-camera" style={styles.opt} onPress={() => pickImage(true)} disabled={busy}>
              <Ionicons name="camera" size={22} color={colors.brand} /><Text style={styles.optText}>Fotocamera</Text>
            </Pressable>
            <Pressable testID="snap-gallery" style={styles.opt} onPress={() => pickImage(false)} disabled={busy}>
              <Ionicons name="images" size={22} color={colors.brand} /><Text style={styles.optText}>Galleria</Text>
            </Pressable>
            <Pressable testID="snap-sensevision" style={styles.opt} onPress={() => { setCreateOpen(false); router.push("/sense-vision" as never); }}>
              <Ionicons name="sparkles" size={22} color={colors.brand} /><Text style={styles.optText}>Sense Vision</Text>
            </Pressable>
          </View>

          <Text style={styles.orText}>oppure scrivi</Text>
          <TextInput testID="snap-text" style={styles.textInput} value={text} onChangeText={setText}
            placeholder="Cosa stai osservando ora?" placeholderTextColor={colors.onSurfaceSecondary} multiline maxLength={280} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
            {TEXT_BGS.map((c) => (
              <Pressable key={c} onPress={() => setBg(c)} style={[styles.swatch, { backgroundColor: c }, bg === c && styles.swatchActive]} />
            ))}
          </ScrollView>
          <Pressable testID="snap-publish-text" style={[styles.publish, (busy || !text.trim()) && { opacity: 0.6 }]} onPress={publishText} disabled={busy || !text.trim()}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.publishText}>Pubblica SnapSense</Text>}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const AV = 58;
const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.sm },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md, alignItems: "flex-start" },
  ringItem: { alignItems: "center", width: 68, gap: 4 },
  ring: { width: AV + 6, height: AV + 6, borderRadius: (AV + 6) / 2, borderWidth: 2, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
  ringCreate: { borderStyle: "dashed", borderColor: colors.brand, backgroundColor: colors.tertiary },
  ringPulseWrap: { width: AV + 10, height: AV + 10, alignItems: "center", justifyContent: "center" },
  ringPulseGlow: { position: "absolute", width: AV + 12, height: AV + 12, borderRadius: (AV + 12) / 2, backgroundColor: "rgba(212,175,55,0.28)" },
  ringPulse: { width: AV + 6, height: AV + 6, borderRadius: (AV + 6) / 2, borderWidth: 2.5, borderColor: colors.brand, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  ringPulseHome: { backgroundColor: "rgba(212,175,55,0.10)" },
  pulseFlash: { position: "absolute", right: 2, bottom: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.surface },
  avatar: { width: AV, height: AV, borderRadius: AV / 2, backgroundColor: colors.tertiary },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  avatarInitial: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.xl },
  ringName: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2, maxWidth: 66, textAlign: "center" },
  // Viewer
  viewer: { flex: 1, backgroundColor: "#000" },
  progressRow: { position: "absolute", left: spacing.md, right: spacing.md, flexDirection: "row", gap: 4, zIndex: 3 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  progressFill: { height: 3, backgroundColor: "#fff" },
  ringSeen: { opacity: 0.5 },
  kindBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  kindBadgePulse: { backgroundColor: colors.brand },
  kindBadgeTxt: { color: "#fff", fontFamily: fonts.bold, fontSize: 9 },
  controls: { position: "absolute", left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  replyField: { flex: 1, height: 44, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.4)", justifyContent: "center", paddingHorizontal: spacing.md, backgroundColor: "rgba(0,0,0,0.25)" },
  replyPlaceholder: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.regular, fontSize: type.base },
  ctrlBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  vHeader: { position: "absolute", left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, zIndex: 3 },
  vAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tertiary },
  vName: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.base },
  vTime: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.regular, fontSize: type.sm },
  vImage: { ...StyleSheet.absoluteFillObject },
  vText: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: spacing["2xl"] },
  vTextContent: { color: "#fff", fontFamily: fonts.semibold, fontSize: type["2xl"], textAlign: "center", lineHeight: 34 },
  vCaptionWrap: { position: "absolute", bottom: 60, left: spacing.lg, right: spacing.lg },
  vCaption: { color: "#fff", fontFamily: fonts.medium, fontSize: type.base, textAlign: "center", textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 6 },
  tapZone: { position: "absolute", top: 100, bottom: 0 },
  // Create sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing["2xl"], borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  sheetSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginBottom: spacing.sm },
  optRow: { flexDirection: "row", gap: spacing.sm },
  opt: { flex: 1, alignItems: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  optText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  orText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", marginTop: spacing.sm },
  textInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, minHeight: 60, textAlignVertical: "top", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: colors.brand },
  publish: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: "center", marginTop: spacing.sm },
  publishText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
});
