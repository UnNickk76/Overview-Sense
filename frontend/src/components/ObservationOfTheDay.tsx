import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { socialApi, FeedObservation, mediaUrl } from "@/src/lib/backend";

export function ObservationOfTheDay() {
  const router = useRouter();
  const [obs, setObs] = useState<FeedObservation | null>(null);

  useEffect(() => {
    let alive = true;
    socialApi
      .observationOfTheDay()
      .then((r) => { if (alive) setObs(r.observation); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!obs) return null;
  const uri = mediaUrl(obs.image_url, "feed");

  return (
    <Pressable
      testID="observation-of-the-day"
      style={styles.wrap}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/observation-detail?id=${obs.id}` as never);
      }}
    >
      <View style={styles.header}>
        <Ionicons name="star" size={13} color={colors.brand} />
        <Text style={styles.overline}>OSSERVAZIONE DEL GIORNO</Text>
      </View>
      <View style={styles.card}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name={obs.media_type === "audio" ? "musical-notes" : "image"} size={36} color={colors.onSurfaceSecondary} />
          </View>
        )}
        <View style={styles.overlay}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreBadge}>
              <Ionicons name="sparkles" size={12} color={colors.onBrand} />
              <Text style={styles.scoreText}>{obs.overall_score}</Text>
            </View>
            {obs.confirmed ? (
              <View style={styles.confirmedBadge}>
                <Ionicons name="checkmark-circle" size={13} color={colors.blue} />
                <Text style={styles.confirmedText}>Confermata</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.nick}>@{obs.nickname}</Text>
          {obs.caption ? (
            <Text style={styles.caption} numberOfLines={2}>{obs.caption}</Text>
          ) : (
            <Text style={styles.caption} numberOfLines={1}>{obs.category}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  overline: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm - 1, letterSpacing: 1.5 },
  card: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.brand },
  image: { width: "100%", aspectRatio: 16 / 10, backgroundColor: colors.tertiary },
  placeholder: { alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md, gap: 4, backgroundColor: "rgba(0,0,0,0.55)" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  scoreText: { color: colors.onBrand, fontFamily: fonts.monoMedium, fontSize: type.sm },
  confirmedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  confirmedText: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm - 2 },
  nick: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  caption: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 17 },
});
