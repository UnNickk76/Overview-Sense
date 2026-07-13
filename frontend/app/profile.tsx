import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { socialApi, Profile as ProfileT, FeedObservation, mediaUrl } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, logout } = useAuth();
  const targetId = id || user?.id;
  const [profile, setProfile] = useState<ProfileT | null>(null);
  const [obs, setObs] = useState<FeedObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<"archive" | "collection">("archive");
  const [collection, setCollection] = useState<FeedObservation[] | null>(null);

  const load = useCallback(async () => {
    if (!targetId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [p, o] = await Promise.all([socialApi.profile(targetId), socialApi.userObservations(targetId)]);
      setProfile(p); setObs(o.items);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [targetId]);

  useEffect(() => { load(); }, [load]);
  // Refresh when returning from the edit screen so avatar/bio/nickname update.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (tab === "collection" && collection === null && targetId) {
      socialApi.collection(targetId).then((r) => setCollection(r.items)).catch(() => setCollection([]));
    }
  }, [tab, collection, targetId]);

  const onFollow = async () => {
    if (!user) { router.push("/login" as never); return; }
    if (!profile || followBusy) return;
    setFollowBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (profile.is_following) { await socialApi.unfollow(profile.id); }
      else { await socialApi.follow(profile.id); }
      setProfile({ ...profile, is_following: !profile.is_following,
        stats: { ...profile.stats, followers: profile.stats.followers + (profile.is_following ? -1 : 1) } });
    } catch { /* ignore */ } finally { setFollowBusy(false); }
  };

  if (!targetId) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Profilo" />
        <View style={styles.center}>
          <Text style={styles.empty}>Accedi per vedere il tuo profilo e le tue Observation.</Text>
          <Pressable style={styles.primary} onPress={() => router.push("/login" as never)}>
            <Text style={styles.primaryText}>Accedi</Text>
          </Pressable>
        </View>
      </SpaceBackground>
    );
  }

  return (
    <SpaceBackground>
      <ScreenHeader title={profile?.nickname ?? "Profilo"} right={
        profile?.is_me ? (
          <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "center" }}>
            <Pressable testID="profile-about" onPress={() => router.push("/about" as never)} hitSlop={10}>
              <Ionicons name="information-circle-outline" size={22} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="profile-logout" onPress={async () => { await logout(); router.replace("/feed" as never); }} hitSlop={10}>
              <Ionicons name="log-out-outline" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
        ) : undefined
      } />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : !profile ? (
        <View style={styles.center}><Text style={styles.empty}>Profilo non trovato.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="profile-view">
          <View style={styles.headerCard}>
            {profile.avatar ? (
              <Image source={{ uri: mediaUrl(profile.avatar)! }} style={styles.avatar} contentFit="cover" transition={150} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{profile.nickname[0].toUpperCase()}</Text></View>
            )}
            <View style={styles.nickRow}>
              <Text style={styles.nick}>{profile.nickname}</Text>
              {profile.verified_badge ? (
                <View style={styles.badge}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.brand} />
                  <Text style={styles.badgeText}>{profile.verified_badge}</Text>
                </View>
              ) : null}
            </View>
            {profile.discovery_level ? (
              <View style={styles.levelWrap}>
                <View style={styles.levelBadge}>
                  <Ionicons name="planet" size={13} color={colors.brand} />
                  <Text style={styles.levelTitle}>{profile.discovery_level.title}</Text>
                  <Text style={styles.levelPoints}>{profile.discovery_level.points} pt</Text>
                </View>
                {profile.discovery_level.next_title ? (
                  <>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(profile.discovery_level.progress * 100)}%` }]} />
                    </View>
                    <Text style={styles.levelNext}>
                      Prossimo livello: {profile.discovery_level.next_title} · {profile.discovery_level.next_min} pt
                    </Text>
                  </>
                ) : (
                  <Text style={styles.levelNext}>Livello massimo raggiunto</Text>
                )}
              </View>
            ) : null}
            {profile.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}

            <View style={styles.statsRow}>
              <Stat label="Observation" value={profile.stats.observations} />
              <Stat label="Follower" value={profile.stats.followers} />
              <Stat label="Seguiti" value={profile.stats.following} />
            </View>

            {profile.is_me ? (
              <Pressable testID="profile-edit" style={styles.secondary} onPress={() => router.push("/edit-profile" as never)}>
                <Ionicons name="create-outline" size={16} color={colors.onSurface} />
                <Text style={styles.secondaryText}>Modifica profilo</Text>
              </Pressable>
            ) : (
              <Pressable testID="profile-follow" style={[styles.primary, profile.is_following && styles.following]} onPress={onFollow}>
                <Text style={[styles.primaryText, profile.is_following && { color: colors.onSurface }]}>
                  {profile.is_following ? "Segui già" : "Segui"}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.tabs}>
            <Pressable testID="tab-archive" style={[styles.tab, tab === "archive" && styles.tabActive]} onPress={() => setTab("archive")}>
              <Text style={[styles.tabText, tab === "archive" && styles.tabTextActive]}>Archivio</Text>
            </Pressable>
            <Pressable testID="tab-collection" style={[styles.tab, tab === "collection" && styles.tabActive]} onPress={() => setTab("collection")}>
              <Text style={[styles.tabText, tab === "collection" && styles.tabTextActive]}>My Collection</Text>
            </Pressable>
          </View>
          {(() => {
            const list = tab === "archive" ? obs : (collection ?? []);
            if (list.length === 0) {
              return <Text style={styles.empty}>{tab === "archive" ? "Nessuna Observation pubblicata." : "Nessuna Observation salvata."}</Text>;
            }
            return (
              <View style={styles.grid}>
                {list.map((o) => (
                  <Pressable key={o.id} style={styles.gridItem} onPress={() => router.push(`/observation-detail?id=${o.id}` as never)}>
                    {o.image_url ? (
                      <Image source={{ uri: mediaUrl(o.image_url)! }} style={styles.gridImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.gridImg, styles.gridPlaceholder]}>
                        <Ionicons name={o.media_type === "audio" ? "musical-notes" : "image"} size={24} color={colors.onSurfaceSecondary} />
                      </View>
                    )}
                    <View style={styles.gridSv}><Text style={styles.gridSvText}>{o.scientific_value}</Text></View>
                  </Pressable>
                ))}
              </View>
            );
          })()}
        </ScrollView>
      )}
    </SpaceBackground>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center" },
  headerCard: { alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brand },
  avatarText: { color: colors.brand, fontFamily: fonts.bold, fontSize: type["2xl"] },
  nickRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  nick: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  badgeText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2, letterSpacing: 0.3 },
  levelWrap: { width: "100%", alignItems: "center", gap: spacing.sm },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  levelTitle: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  levelPoints: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  progressTrack: { width: "72%", height: 4, borderRadius: 2, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: colors.brand },
  levelNext: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  bio: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 20 },
  bioInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, minHeight: 70, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, textAlignVertical: "top" },
  statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.sm },
  stat: { alignItems: "center" },
  statValue: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  statLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  primary: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: "center", minWidth: 140 },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  following: { backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  secondary: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  secondaryText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  tabs: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.tertiary },
  tabText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.base },
  tabTextActive: { color: colors.onSurface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridItem: { width: "31.8%", aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.tertiary },
  gridImg: { width: "100%", height: "100%" },
  gridPlaceholder: { alignItems: "center", justifyContent: "center" },
  gridSv: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  gridSvText: { color: colors.brand, fontFamily: fonts.monoMedium, fontSize: type.sm - 3 },
});
