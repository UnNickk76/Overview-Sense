import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { dmApi, socialApi, mediaUrl, DMMessage, FeedObservation } from "@/src/lib/backend";

type PickMode = "observation" | "compare" | "compare-add";

function fmtTime(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function CompareCol({ snap }: { snap: Record<string, unknown> }) {
  const img = mediaUrl((snap.image_url as string) || null);
  const sun = snap.sun as { alt: number } | null;
  const moon = snap.moon as { phase: string; illum: number } | null;
  return (
    <View style={styles.compCol}>
      {img ? <Image source={{ uri: img }} style={styles.compImg} contentFit="cover" /> : <View style={[styles.compImg, styles.compImgEmpty]}><Ionicons name="telescope" size={22} color={colors.onSurfaceSecondary} /></View>}
      <Text style={styles.compNick} numberOfLines={1}>@{(snap.nickname as string) || "—"}</Text>
      <Text style={styles.compData}>{fmtTime(snap.ts as number)}</Text>
      {snap.lat != null && snap.lon != null ? <Text style={styles.compData}>📍 {(snap.lat as number).toFixed(2)}, {(snap.lon as number).toFixed(2)}</Text> : null}
      {moon ? <Text style={styles.compData}>🌙 {moon.phase} · {(moon.illum * 100).toFixed(0)}%</Text> : null}
      {sun ? <Text style={styles.compData}>☀️ alt {sun.alt.toFixed(0)}°</Text> : null}
    </View>
  );
}

export default function Chat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name, avatar } = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const { user } = useAuth();
  const otherAvatar = avatar ? mediaUrl(avatar) : null;
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [picker, setPicker] = useState<PickMode | null>(null);
  const [compareMid, setCompareMid] = useState<string | null>(null);
  const [myObs, setMyObs] = useState<FeedObservation[]>([]);
  const [snapPreview, setSnapPreview] = useState<{ img: string | null; caption: string; format: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const lastId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await dmApi.messages(id);
      const newLast = r.items.length ? r.items[r.items.length - 1].id : null;
      if (newLast !== lastId.current) {
        lastId.current = newLast;
        setMessages(r.items);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
      dmApi.read(id).catch(() => {});
    } catch { /* offline */ } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    setLoading(true); load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]));

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setText("");
    try {
      const m = await dmApi.send(id, { kind: "text", text: t });
      setMessages((prev) => [...prev, m]); lastId.current = m.id;
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    } catch { setText(t); } finally { setSending(false); }
  };

  const openPicker = async (mode: PickMode, mid?: string) => {
    setSheet(false);
    setPicker(mode);
    setCompareMid(mid ?? null);
    if (user) {
      try { const r = await socialApi.userObservations(user.id); setMyObs(r.items.filter((o) => o.media_type === "image")); }
      catch { setMyObs([]); }
    }
  };

  const pickObs = async (o: FeedObservation) => {
    const subj = (o.data?.subject as string) || o.caption || "oggetto";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (picker === "compare-add" && compareMid) {
        const r = await dmApi.compareAdd(compareMid, o.id);
        setMessages((prev) => prev.map((m) => (m.id === compareMid ? { ...m, share: r.share } : m)));
      } else if (picker === "compare") {
        const m = await dmApi.send(id, { kind: "compare", text: "", share: { obs_id: o.id, subject: subj } });
        setMessages((prev) => [...prev, m]); lastId.current = m.id;
      } else {
        const m = await dmApi.send(id, { kind: "observation", text: "", share: { obs_id: o.id } });
        setMessages((prev) => [...prev, m]); lastId.current = m.id;
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    } catch { /* ignore */ } finally { setPicker(null); setCompareMid(null); }
  };

  const renderMsg = (m: DMMessage) => {
    const mine = m.sender_id === user?.id;
    const share = m.share || {};
    if (m.kind === "observation") {
      const img = mediaUrl((share.image_url as string) || null);
      return (
        <Pressable style={[styles.shareCard, mine ? styles.mineCard : styles.theirCard]} onPress={() => router.push(`/observation-detail?id=${share.obs_id}` as never)}>
          {img ? <Image source={{ uri: img }} style={styles.shareImg} contentFit="cover" /> : null}
          <View style={styles.shareMeta}>
            <Text style={styles.shareTag}>🔭 Senshot</Text>
            <Text style={styles.shareCaption} numberOfLines={2}>{(share.caption as string) || "Observation"}</Text>
          </View>
        </Pressable>
      );
    }
    if (m.kind === "snapsense") {
      const img = mediaUrl((share.image_url as string) || null);
      const expired = !!share.expired;
      const fmt = (share.format as string) || "SnapSense™";
      const cap = (share.caption as string) || "";
      return (
        <Pressable
          testID={`snap-msg-${m.id}`}
          disabled={expired}
          onPress={() => { if (!expired) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSnapPreview({ img, caption: cap, format: fmt }); } }}
          style={[styles.snapCard, mine ? styles.mineCard : styles.theirCard, expired && styles.snapExpired]}
        >
          <View style={styles.snapHead}>
            <Ionicons name="flash" size={13} color={colors.brand} />
            <Text style={styles.snapTag}>Risposta a {fmt}</Text>
          </View>
          {expired ? (
            <View style={styles.snapExpiredBox}>
              <Ionicons name="time-outline" size={20} color={colors.onSurfaceSecondary} />
              <Text style={styles.snapExpiredText}>Questo {fmt} è scaduto</Text>
            </View>
          ) : img ? (
            <Image source={{ uri: img }} style={styles.snapImg} contentFit="cover" />
          ) : (
            <View style={[styles.snapImg, styles.compImgEmpty]}>
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.onSurfaceSecondary} />
            </View>
          )}
          {cap ? <Text style={styles.snapCaption} numberOfLines={2}>“{cap}”</Text> : null}
          {m.text ? (
            <View style={[styles.snapReply, mine ? styles.mineBubble : styles.theirBubble]}>
              <Text style={[styles.bubbleText, mine && { color: colors.onBrand }]}>{m.text}</Text>
            </View>
          ) : null}
        </Pressable>
      );
    }
    if (m.kind === "compare") {
      const a = share.a as Record<string, unknown> | undefined;
      const b = share.b as Record<string, unknown> | undefined;
      const canAdd = !b && !mine;
      return (
        <View style={[styles.compareCard, mine ? styles.mineCard : styles.theirCard]}>
          <Text style={styles.compareTitle}>🌗 Senshot condiviso · {(share.subject as string) || "oggetto"}</Text>
          <View style={styles.compareRow}>
            {a ? <CompareCol snap={a} /> : null}
            {b ? <CompareCol snap={b} /> : (
              <View style={styles.compCol}>
                <View style={[styles.compImg, styles.compImgEmpty]}><Ionicons name="add" size={26} color={colors.brand} /></View>
                {canAdd ? (
                  <Pressable testID={`compare-add-${m.id}`} style={styles.compAddBtn} onPress={() => openPicker("compare-add", m.id)}>
                    <Text style={styles.compAddText}>Aggiungi il tuo</Text>
                  </Pressable>
                ) : <Text style={styles.compData}>In attesa dell&apos;altro osservatore…</Text>}
              </View>
            )}
          </View>
          <Text style={styles.compareFoot}>Stesso oggetto, due punti di vista reali.</Text>
        </View>
      );
    }
    return (
      <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble]}>
        <Text style={[styles.bubbleText, mine && { color: colors.onBrand }]}>{m.text}</Text>
      </View>
    );
  };

  return (
    <SpaceBackground>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="chat-back" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>{name || "Conversazione"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 44}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
        ) : (
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            {messages.length === 0 ? (
              <Text style={styles.hint}>Inizia la conversazione. Puoi condividere Senshot, osservazioni e confrontare lo stesso oggetto osservato.</Text>
            ) : messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <View key={m.id} style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, justifyContent: mine ? "flex-end" : "flex-start" }}>
                  {!mine ? (
                    otherAvatar ? <Image source={{ uri: otherAvatar }} style={styles.msgAvatar} contentFit="cover" />
                      : <View style={[styles.msgAvatar, styles.msgAvatarFb]}><Text style={styles.msgAvatarInit}>{(name || "?").slice(0, 1).toUpperCase()}</Text></View>
                  ) : null}
                  {renderMsg(m)}
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={[styles.composer, { paddingBottom: insets.bottom || spacing.sm }]}>
          <Pressable testID="chat-attach" style={styles.attachBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSheet(true); }}>
            <Ionicons name="add-circle" size={30} color={colors.brand} />
          </Pressable>
          <TextInput testID="chat-input" style={styles.input} value={text} onChangeText={setText}
            placeholder="Messaggio…" placeholderTextColor={colors.onSurfaceSecondary} multiline />
          <Pressable testID="chat-send" style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]} onPress={send} disabled={!text.trim()}>
            <Ionicons name="arrow-up" size={20} color={colors.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Attach sheet */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.sheetHandle} />
            <Pressable testID="share-observation" style={styles.sheetItem} onPress={() => openPicker("observation")}>
              <Ionicons name="telescope" size={20} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Condividi un Senshot</Text>
                <Text style={styles.sheetSub}>Invia una tua osservazione</Text>
              </View>
            </Pressable>
            <Pressable testID="share-compare" style={styles.sheetItem} onPress={() => openPicker("compare")}>
              <Ionicons name="git-compare" size={20} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Senshot condiviso</Text>
                <Text style={styles.sheetSub}>Confronta lo stesso oggetto: posizione, orario e dati reali</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Observation picker */}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={styles.pickerRoot}>
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing.md, paddingTop: insets.top + spacing.md }]}>
            <View style={styles.pickerHead}>
              <Text style={styles.pickerTitle}>{picker === "observation" ? "Scegli un Senshot" : "Scegli il tuo Senshot da confrontare"}</Text>
              <Pressable testID="picker-close" onPress={() => setPicker(null)}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
            </View>
            {myObs.length === 0 ? (
              <Text style={styles.hint}>Non hai ancora Senshot pubblicati con immagine.</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.pickerGrid}>
                {myObs.map((o) => (
                  <Pressable key={o.id} testID={`pick-${o.id}`} style={styles.pickItem} onPress={() => pickObs(o)}>
                    {o.image_url ? <Image source={{ uri: mediaUrl(o.image_url)! }} style={styles.pickImg} contentFit="cover" /> : <View style={[styles.pickImg, styles.compImgEmpty]} />}
                    <Text style={styles.pickCap} numberOfLines={1}>{(o.data?.subject as string) || o.caption || "Senshot"}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* SnapSense preview */}
      <Modal visible={!!snapPreview} transparent animationType="fade" onRequestClose={() => setSnapPreview(null)}>
        <Pressable style={styles.snapPrevRoot} onPress={() => setSnapPreview(null)}>
          <View style={styles.snapPrevCard}>
            {snapPreview?.img ? (
              <Image source={{ uri: snapPreview.img }} style={styles.snapPrevImg} contentFit="contain" />
            ) : (
              <View style={[styles.snapPrevImg, styles.compImgEmpty]}>
                <Ionicons name="flash" size={40} color={colors.brand} />
              </View>
            )}
            {snapPreview?.caption ? <Text style={styles.snapPrevCap}>“{snapPreview.caption}”</Text> : null}
            <Text style={styles.snapPrevHint}>{snapPreview?.format} · tocca per chiudere</Text>
          </View>
        </Pressable>
      </Modal>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerName: { flex: 1, color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", padding: spacing.lg, lineHeight: 20 },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, marginBottom: 2 },
  msgAvatarFb: { backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center" },
  msgAvatarInit: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.sm - 1 },
  mineBubble: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  shareCard: { width: 230, borderRadius: radius.md, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  mineCard: { backgroundColor: "rgba(212,175,55,0.12)" },
  theirCard: { backgroundColor: colors.surfaceSecondary },
  shareImg: { width: "100%", height: 150 },
  shareMeta: { padding: spacing.sm, gap: 2 },
  shareTag: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  shareCaption: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm },
  snapCard: { width: 240, borderRadius: radius.md, padding: spacing.sm, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  snapExpired: { borderColor: colors.border, opacity: 0.8 },
  snapHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  snapTag: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2 },
  snapImg: { width: "100%", height: 200, borderRadius: radius.sm },
  snapCaption: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, fontStyle: "italic" },
  snapReply: { alignSelf: "flex-start", borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: 2 },
  snapExpiredBox: { alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: spacing.lg },
  snapExpiredText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  snapPrevRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  snapPrevCard: { width: "100%", alignItems: "center", gap: spacing.md },
  snapPrevImg: { width: "100%", height: 460, borderRadius: radius.md },
  snapPrevCap: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, fontStyle: "italic", textAlign: "center" },
  snapPrevHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  compareCard: { width: 300, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  compareTitle: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  compareRow: { flexDirection: "row", gap: spacing.sm },
  compCol: { flex: 1, gap: 3, alignItems: "center" },
  compImg: { width: "100%", height: 110, borderRadius: radius.sm },
  compImgEmpty: { backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center" },
  compNick: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm - 1, marginTop: 2 },
  compData: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 3, textAlign: "center" },
  compAddBtn: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: 4 },
  compAddText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  compareFoot: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, fontStyle: "italic", textAlign: "center" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, maxHeight: 120, minHeight: 40, backgroundColor: colors.surfaceSecondary, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, gap: spacing.md },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  sheetItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  sheetSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  pickerRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", paddingHorizontal: spacing.lg },
  pickerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  pickerTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, flex: 1 },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.lg },
  pickItem: { width: "31.5%", gap: 4 },
  pickImg: { width: "100%", aspectRatio: 1, borderRadius: radius.sm },
  pickCap: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
});
