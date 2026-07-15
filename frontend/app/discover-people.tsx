import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Share, Modal, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { communityApi, DiscoverPerson } from "@/src/lib/community";
import { socialApi, mediaUrl } from "@/src/lib/backend";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

export default function DiscoverPeople() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [people, setPeople] = useState<DiscoverPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [invite, setInvite] = useState<{ url: string; message: string; nickname: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, inv] = await Promise.all([communityApi.discover(30), communityApi.invite()]);
      setPeople(d.items);
      setInvite(inv);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onFollow = async (p: DiscoverPerson) => {
    Haptics.selectionAsync();
    setFollowing((f) => ({ ...f, [p.id]: true }));
    try { await socialApi.follow(p.id); } catch { setFollowing((f) => ({ ...f, [p.id]: false })); }
  };

  const shareInvite = async () => {
    if (!invite) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await Share.share({ message: invite.message }); } catch { /* ignore */ }
  };
  const copyLink = async () => {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.url);
    setCopied(true);
    Haptics.selectionAsync();
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Discover People™" subtitle="Fai crescere la tua rete"
        right={
          <Pressable testID="open-invite" onPress={() => setInviteOpen(true)} hitSlop={10}>
            <Ionicons name="person-add-outline" size={22} color={colors.brand} />
          </Pressable>
        } />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brand} />}>
          <Pressable style={styles.inviteBanner} onPress={() => setInviteOpen(true)}>
            <View style={styles.inviteIcon}><Ionicons name="gift" size={20} color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteTitle}>Invita amici</Text>
              <Text style={styles.inviteSub}>Link, QR o condividi con qualsiasi app.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
          </Pressable>

          <Text style={styles.sectionTitle}>PERSONE CHE POTRESTI CONOSCERE</Text>
          {people.length === 0 ? (
            <Text style={styles.empty}>Continua a osservare e completare Pulse™: qui appariranno persone con i tuoi stessi interessi e luoghi.</Text>
          ) : people.map((p) => (
            <View key={p.id} style={styles.card}>
              <Pressable style={styles.cardMain} onPress={() => router.push(`/profile?id=${p.id}` as never)}>
                {mediaUrl(p.avatar) ? (
                  <Image source={{ uri: mediaUrl(p.avatar)! }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarLetter}>{(p.nickname || "?")[0].toUpperCase()}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{p.display_name || p.nickname}</Text>
                  <Text style={styles.handle} numberOfLines={1}>@{p.nickname}</Text>
                  <View style={styles.reasonRow}>
                    <Ionicons name="sparkles-outline" size={11} color={colors.brand} />
                    <Text style={styles.reason} numberOfLines={1}>{p.reason}</Text>
                  </View>
                </View>
              </Pressable>
              <Pressable testID={`follow-${p.id}`} style={[styles.followBtn, following[p.id] && styles.followingBtn]}
                onPress={() => onFollow(p)} disabled={following[p.id]}>
                <Text style={[styles.followText, following[p.id] && { color: colors.onSurface }]}>
                  {following[p.id] ? "Segui già" : "Segui"}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Invita amici su OverView™</Text>
            <Text style={styles.sheetSub}>Condividi il tuo link personale.</Text>
            <View style={styles.qrWrap}>
              {invite ? <QRCode value={invite.url} size={168} color="#0A0A0A" backgroundColor="#FFFFFF" /> : null}
            </View>
            <Text style={styles.linkText} numberOfLines={1}>{invite?.url}</Text>
            <View style={styles.inviteActions}>
              <Pressable testID="invite-copy" style={styles.inviteAction} onPress={copyLink}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={colors.brand} />
                <Text style={styles.inviteActionText}>{copied ? "Copiato" : "Copia link"}</Text>
              </Pressable>
              <Pressable testID="invite-share" style={[styles.inviteAction, styles.inviteActionPrimary]} onPress={shareInvite}>
                <Ionicons name="share-social" size={18} color={colors.onBrand} />
                <Text style={[styles.inviteActionText, { color: colors.onBrand }]}>Condividi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  inviteBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(212,175,55,0.10)", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  inviteIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(212,175,55,0.15)", alignItems: "center", justifyContent: "center" },
  inviteTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  inviteSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  sectionTitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1, marginTop: spacing.sm },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardMain: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceTertiary },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: colors.brand, fontFamily: fonts.bold, fontSize: type.lg },
  name: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  handle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },  reason: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 2, flex: 1 },
  followBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  followingBtn: { backgroundColor: colors.surfaceTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  followText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing["2xl"], alignItems: "center", gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  sheetSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  qrWrap: { backgroundColor: "#fff", padding: spacing.md, borderRadius: radius.md, marginVertical: spacing.md },
  linkText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  inviteActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, width: "100%" },
  inviteAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inviteActionPrimary: { backgroundColor: colors.brand, borderColor: colors.brand },
  inviteActionText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
});
