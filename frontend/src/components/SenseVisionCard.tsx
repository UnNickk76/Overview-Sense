import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { listObservations, Observation } from "@/src/lib/gallery";

export function SenseVisionCard() {
  const router = useRouter();
  const [last, setLast] = useState<Observation | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listObservations()
        .then((list) => {
          const img = list.find((o) => o.kind === "image");
          if (alive) setLast(img ?? null);
        })
        .catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  const go = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/sense-vision" as never);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {last ? (
          <Image source={{ uri: last.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.emptyBg]} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <View style={styles.badge}>
            <Ionicons name="eye" size={13} color={colors.brand} />
            <Text style={styles.badgeText}>SENSE VISION™</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.slogan}>Reality is richer than your eyes.</Text>
          <Text style={styles.sub}>
            {last ? "Il tuo ultimo Sense · tocca per crearne uno nuovo" : "Inquadra qualsiasi cosa e rivela l'invisibile"}
          </Text>
          <Pressable testID="make-a-sense-home" style={styles.btn} onPress={go}>
            <Ionicons name="sparkles" size={18} color={colors.onBrand} />
            <Text style={styles.btnText}>MAKE A SENSE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg },
  card: { height: 260, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.brand },
  emptyBg: { backgroundColor: colors.tertiary },
  content: { flex: 1, padding: spacing.lg },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  badgeText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  slogan: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.xl, lineHeight: 26 },
  sub: { color: "rgba(255,255,255,0.8)", fontFamily: fonts.regular, fontSize: type.sm, marginTop: 4, marginBottom: spacing.md },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: spacing.md, alignSelf: "flex-start", paddingHorizontal: spacing.xl },
  btnText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 1 },
});
