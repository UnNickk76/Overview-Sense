import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, Modal, ScrollView, ActivityIndicator, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { socialApi, snapSenseApi, dmApi, mediaUrl, FeedObservation } from "@/src/lib/backend";
import { BASE } from "@/src/lib/client";
import { useAuth } from "@/src/context/AuthContext";
import { pulseForNow } from "@/src/lib/pulseTasks";
import { SenseEditor } from "@/src/components/SenseEditor";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

type Connection = { id: string; nickname: string; display_name?: string; avatar?: string | null; relation: string };

// Share Hub™ — every "Share" tap opens THIS internal OverView panel first.
// Only "Share externally" opens the native OS share sheet — as a last resort.
export function ShareHub({ obs, reposted, onReposted, onClose }: {
  obs: FeedObservation;
  reposted?: boolean;
  onReposted?: (v: boolean) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [view, setView] = useState<"menu" | "dm">("menu");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rep, setRep] = useState(!!reposted);
  const [editorOpen, setEditorOpen] = useState(false);
  const [conns, setConns] = useState<Connection[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const requireAuth = () => { if (!user) { onClose(); router.push("/login" as never); return false; } return true; };

  const flash = (t: string) => { setMsg(t); setTimeout(() => { onClose(); }, 1100); };

  // 1) Pulse™ — convert this observe into a Pulse contribution.
  const asPulse = async () => {
    if (!requireAuth()) return;
    const uri = mediaUrl(obs.image_url);
    if (!uri) return;
    setBusy("pulse"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const m = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      const t = pulseForNow();
      await socialApi.createObservation({
        media_type: "image", source: "reality", caption: obs.caption || "",
        image_base64: m.base64 ?? undefined, data: obs.data, is_pulse: true,
        pulse_task: { id: t.id, title: t.title, theme: t.theme, prompt: t.prompt },
      });
      flash("Pubblicato come Pulse™ ✓");
    } catch { setMsg("Azione non riuscita"); setBusy(null); }
  };

  // 2) SenseShot™ — open the Stories editor, then publish the result as a SenseShot (24h).
  const publishSenseShot = async (editedUri: string) => {
    setEditorOpen(false);
    setBusy("senseshot");
    try {
      const m = await ImageManipulator.manipulateAsync(editedUri, [{ resize: { width: 1280 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      await snapSenseApi.create({ kind: "photo", image_base64: m.base64 ?? undefined, caption: obs.caption || undefined, source: obs.source });
      flash("Condiviso come SenseShot™ ✓");
    } catch { setMsg("Azione non riuscita"); setBusy(null); }
  };

  // 3) Repost
  const doRepost = async () => {
    if (!requireAuth()) return;
    Haptics.selectionAsync();
    const next = !rep; setRep(next); onReposted?.(next);
    try { await socialApi.repost(obs.id); } catch { /* ignore */ }
    flash(next ? "Reposted ✓" : "Repost rimosso");
  };

  // 4) Direct Message — pick OViewers/Observers and send.
  const openDM = async () => {
    if (!requireAuth()) return;
    Haptics.selectionAsync();
    setView("dm");
    if (conns === null) {
      try { setConns((await socialApi.connections()).items); } catch { setConns([]); }
    }
  };
  const toggleUser = (id: string) => {
    Haptics.selectionAsync();
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const sendDM = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      for (const uid of selected) {
        const conv = await dmApi.start(uid);
        await dmApi.send(conv.id, { kind: "observation", share: { obs_id: obs.id } });
      }
      flash(`Inviato a ${selected.size} ${selected.size === 1 ? "persona" : "persone"} ✓`);
    } catch { setMsg("Invio non riuscito"); setSending(false); }
  };

  // 5) Copy Link — copy the public Observation link to the clipboard.
  const copyLink = async () => {
    Haptics.selectionAsync();
    const url = `${BASE}/api/observations/${obs.id}`;
    try { await Clipboard.setStringAsync(url); } catch { /* ignore */ }
    flash("Link copiato ✓");
  };

  // 6) External — the ONLY action that opens the native OS share sheet.
  const shareExternal = async () => {
    setBusy("external"); Haptics.selectionAsync();
    const uri = mediaUrl(obs.image_url);
    try {
      if (uri && (await Sharing.isAvailableAsync())) {
        const target = FileSystem.cacheDirectory + `overview_${obs.id}.jpg`;
        const dl = await FileSystem.downloadAsync(uri, target);
        await Sharing.shareAsync(dl.uri, { mimeType: "image/jpeg", dialogTitle: "Share via OverView™" });
      } else {
        await Share.share({ message: `${obs.title || obs.caption || "SenseShot"} — OverView™` });
      }
    } catch { /* user cancelled */ }
    setBusy(null); onClose();
  };

  const ACTIONS: { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; onPress: () => void; active?: boolean }[] = [
    { key: "pulse", icon: "pulse", title: "Publish as Pulse™", sub: "Partecipa alla sfida osservativa del momento.", onPress: asPulse },
    { key: "senseshot", icon: "sparkles", title: "Publish as SenseShot™", sub: "Apri l'editor Stories e condividi per 24 ore.", onPress: () => { if (requireAuth()) setEditorOpen(true); } },
    { key: "repost", icon: "repeat", title: "Repost", sub: "Ripubblica mantenendo il collegamento all'originale.", onPress: doRepost, active: rep },
    { key: "dm", icon: "paper-plane", title: "Send via Direct Message", sub: "Invia ai tuoi OViewers™ / Observers.", onPress: openDM },
    { key: "copy", icon: "link", title: "Copy Link", sub: "Copia il link dell'Observation.", onPress: copyLink },
    { key: "external", icon: "share-outline", title: "Share Externally", sub: "AirDrop, WhatsApp, Telegram, Email…", onPress: shareExternal },
  ];

  const editUri = mediaUrl(obs.image_url);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      {editorOpen && editUri ? (
        <SenseEditor uri={editUri} place={null} onCancel={() => setEditorOpen(false)} onDone={publishSenseShot} />
      ) : (
        <View style={styles.root}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handle} />

            {view === "menu" ? (
              <>
                <Text style={styles.title}>Share Hub™</Text>
                <Text style={styles.sub}>Condividi dentro OverView. Il menu del dispositivo è l'ultima scelta.</Text>
                {ACTIONS.map((a) => (
                  <Pressable key={a.key} testID={`share-${a.key}`} style={styles.row} onPress={a.onPress} disabled={!!busy}>
                    <View style={[styles.iconWrap, a.active && styles.iconWrapActive]}>
                      <Ionicons name={a.icon} size={20} color={a.active ? colors.onBrand : colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{a.title}</Text>
                      <Text style={styles.rowSub}>{a.sub}</Text>
                    </View>
                    {busy === a.key ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
                  </Pressable>
                ))}
                {msg ? <Text style={styles.msg}>{msg}</Text> : null}
              </>
            ) : (
              <>
                <View style={styles.dmHead}>
                  <Pressable testID="dm-back" hitSlop={10} onPress={() => setView("menu")}><Ionicons name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
                  <Text style={styles.title}>Direct Message</Text>
                  <View style={{ width: 24 }} />
                </View>
                <Text style={styles.sub}>Seleziona una o più persone.</Text>
                {conns === null ? <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} /> : null}
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  {conns?.length === 0 ? <Text style={styles.empty}>Nessun OViewer o Observer ancora. Segui qualcuno o fatti seguire.</Text> : null}
                  {conns?.map((c) => {
                    const on = selected.has(c.id);
                    const av = mediaUrl(c.avatar);
                    return (
                      <Pressable key={c.id} testID={`dm-user-${c.id}`} style={[styles.userRow, on && styles.userRowOn]} onPress={() => toggleUser(c.id)}>
                        {av ? <Image source={{ uri: av }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFb]}><Text style={styles.avatarInit}>{(c.nickname || "?")[0].toUpperCase()}</Text></View>}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName}>@{c.nickname}</Text>
                          <Text style={styles.userRel}>{c.relation === "mutual" ? "OViewer + Observer" : c.relation === "oviewer" ? "OViewer™" : "Observer"}</Text>
                        </View>
                        <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? colors.brand : colors.onSurfaceSecondary} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Pressable testID="dm-send" style={[styles.send, (selected.size === 0 || sending) && { opacity: 0.4 }]} disabled={selected.size === 0 || sending} onPress={sendDM}>
                  {sending ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.sendTxt}>Invia{selected.size ? ` (${selected.size})` : ""}</Text>}
                </Pressable>
                {msg ? <Text style={styles.msg}>{msg}</Text> : null}
              </>
            )}
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  sub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(212,175,55,0.1)", alignItems: "center", justifyContent: "center" },
  iconWrapActive: { backgroundColor: colors.brand },
  rowTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  rowSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  msg: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, textAlign: "center", marginTop: spacing.md },
  dmHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", paddingVertical: spacing.xl, lineHeight: 21 },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, marginBottom: 4 },
  userRowOn: { backgroundColor: "rgba(212,175,55,0.08)" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceTertiary },
  avatarFb: { alignItems: "center", justifyContent: "center" },
  avatarInit: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.base },
  userName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  userRel: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2, marginTop: 1 },
  send: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", marginTop: spacing.md },
  sendTxt: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
});
