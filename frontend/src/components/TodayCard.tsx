import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useOpportunities } from "@/src/hooks/useOpportunities";

export function TodayCard() {
  const router = useRouter();
  const { all } = useOpportunities();
  const top = all.slice(0, 5);

  return (
    <Pressable
      testID="today-opportunities-card"
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/today" as never); }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.head}>
        <Text style={styles.title}>🌍 TODAY&apos;S OPPORTUNITIES</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.brand} />
      </View>
      {top.length > 0 ? (
        <>
          <Text style={styles.count}>{all.length} opportunità oggi</Text>
          <View style={styles.list}>
            {top.map((o) => (
              <View key={o.id} style={styles.item}>
                <Text style={styles.itemEmoji}>{o.emoji}</Text>
                <Text style={styles.itemText} numberOfLines={1}>{o.title}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.count}>Attiva la posizione per il tuo briefing quotidiano.</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.brand, gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.xl },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, letterSpacing: 1 },
  count: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
  list: { gap: spacing.sm, marginTop: spacing.xs },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemEmoji: { fontSize: 15 },
  itemText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, flex: 1 },
});
