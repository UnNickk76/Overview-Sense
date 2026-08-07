import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { FeedObservation, mediaUrl } from "@/src/lib/backend";
import { InteractionBar } from "./InteractionBar";
import { ActionBar } from "./ActionBar";
import { TranslatableText } from "./TranslatableText";

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}g`;
}

export function ObservationCard({ obs }: { obs: FeedObservation }) {
  const router = useRouter();
  const uri = mediaUrl(obs.image_url, "feed");
  const isThought = obs.kind === "thought" || (obs.media_type === "text" && !obs.image_url);
  const openDetail = () => router.push(`${obs.is_pulse ? "/pulse-view" : "/observation-detail"}?id=${obs.id}` as never);
  return (
    <View style={styles.card}>
      {obs.reposted_by ? (
        <View style={styles.repostBanner}>
          <Ionicons name="repeat" size={13} color={colors.onSurfaceSecondary} />
          <Text style={styles.repostText}>{obs.reposted_by} ha ripubblicato</Text>
        </View>
      ) : null}
      <Pressable style={styles.head} onPress={() => router.push(`/profile?id=${obs.user_id}` as never)}>
        {mediaUrl(obs.avatar) ? (
          <Image source={{ uri: mediaUrl(obs.avatar)! }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatar}><Text style={styles.avatarText}>{(obs.nickname || "?")[0].toUpperCase()}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.nick}>{obs.nickname}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{obs.category} · {timeAgo(obs.created_at)}</Text>
            {obs.confirmed ? (
              <View style={styles.confirmed}>
                <Ionicons name="checkmark-circle" size={11} color={colors.blue} />
                <Text style={styles.confirmedText}>Confermata</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.sv}>
          <Ionicons name="sparkles" size={12} color={colors.brand} />
          <Text style={styles.svText}>{obs.overall_score}</Text>
        </View>
      </Pressable>

      {isThought ? (
        <Pressable testID={`obs-open-${obs.id}`} onPress={openDetail} style={styles.thoughtBody}>
          <View style={styles.thoughtTag}>
            <Ionicons name="create-outline" size={12} color={colors.blue} />
            <Text style={styles.thoughtTagText}>Pensiero</Text>
          </View>
          <TranslatableText text={obs.caption} textStyle={styles.thoughtText} numberOfLines={10} />
        </Pressable>
      ) : (
        <Pressable testID={`obs-open-${obs.id}`} onPress={openDetail}>
          {uri ? (
            <Image source={{ uri }} style={styles.image} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.image, styles.audioPlaceholder]}>
              <Ionicons name={obs.media_type === "audio" ? "musical-notes" : "image"} size={40} color={colors.onSurfaceSecondary} />
            </View>
          )}
          {obs.is_pulse ? (
            <View style={styles.pulseBadge}>
              <Ionicons name="flash" size={12} color={colors.onBrand} />
              <Text style={styles.pulseBadgeText}>
                {obs.pulse_task?.id?.startsWith("g_") ? "GLOBAL PULSE" : "PULSE"}
              </Text>
            </View>
          ) : null}
        </Pressable>
      )}

      <View style={styles.body}>
        {!isThought && obs.caption ? <TranslatableText text={obs.caption} textStyle={styles.caption} numberOfLines={2} /> : null}
        <InteractionBar obs={obs} />
        <ActionBar obs={obs} onComment={() => router.push(`/observation-detail?id=${obs.id}` as never)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  repostBanner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  repostText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  avatarText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  nick: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  meta: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2, marginTop: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 1 },
  confirmed: { flexDirection: "row", alignItems: "center", gap: 3 },
  confirmedText: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm - 3 },
  sv: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  svText: { color: colors.brand, fontFamily: fonts.monoMedium, fontSize: type.sm - 1 },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.tertiary },
  pulseBadge: { position: "absolute", top: spacing.sm, left: spacing.sm, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  pulseBadgeText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm - 3, letterSpacing: 0.6 },
  audioPlaceholder: { alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.md, gap: spacing.md },
  caption: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  thoughtBody: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: spacing.sm },
  thoughtTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(88,166,255,0.12)", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  thoughtTagText: { color: colors.blue, fontFamily: fonts.semibold, fontSize: type.sm - 3, letterSpacing: 0.4, textTransform: "uppercase" },
  thoughtText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 25 },
  commentsLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentsText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
});
