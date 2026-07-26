import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { eventsApi, VerifiedEvent, mediaUrl } from "@/src/lib/backend";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Aurore: "sparkles", ISS: "earth", "Via Lattea": "planet", Pianeti: "planet",
  Luna: "moon", Sole: "sunny", Costellazioni: "star", Satelliti: "radio",
  "Campo magnetico": "magnet", Meteo: "cloud", Atmosfera: "cloud",
  "Satellite Intelligence": "globe", "Listening Layer": "musical-notes",
};

function timeRange(a: string, b: string): string {
  try {
    const f = new Date(a), l = new Date(b);
    const fmt = (d: Date) => `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    return a === b ? fmt(f) : `${fmt(f)}–${fmt(l)}`;
  } catch { return ""; }
}

export function VerifiedEvents() {
  const router = useRouter();
  const [events, setEvents] = useState<VerifiedEvent[]>([]);

  useEffect(() => {
    eventsApi.verified().then((r) => setEvents(r.events)).catch(() => {});
  }, []);

  if (events.length === 0) return null;

  const open = (e: VerifiedEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (e.obs_ids[0]) router.push(`/observation-detail?id=${e.obs_ids[0]}` as never);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark" size={16} color={colors.blue} />
        <Text style={styles.title}>Eventi verificati dalla community</Text>
      </View>
      <Text style={styles.hint}>Più osservatori, lo stesso fenomeno reale.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {events.map((e) => {
          const thumb = e.samples[0] ? mediaUrl(e.samples[0], "thumb") : null;
          return (
            <Pressable key={e.id} testID={`verified-${e.id}`} onPress={() => open(e)} style={styles.card}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" transition={150} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name={ICON[e.category] ?? "planet"} size={30} color={colors.brand} />
                </View>
              )}
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={12} color={colors.blue} />
                <Text style={styles.badgeText}>Verificato</Text>
              </View>
              <View style={styles.info}>
                <View style={styles.catRow}>
                  <Ionicons name={ICON[e.category] ?? "planet"} size={13} color={colors.brand} />
                  <Text style={styles.cat}>{e.category}</Text>
                </View>
                <Text style={styles.meta}>{e.observers} osservatori · {e.observations} obs</Text>
                <Text style={styles.metaSub}>{timeRange(e.first_at, e.last_at)} · SV {e.avg_scientific_value}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, paddingBottom: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, paddingHorizontal: spacing.lg },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: { width: 150, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.blue },
  thumb: { width: "100%", height: 96, backgroundColor: colors.tertiary },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm - 3 },
  info: { padding: spacing.sm, gap: 2 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cat: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  meta: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  metaSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
});
