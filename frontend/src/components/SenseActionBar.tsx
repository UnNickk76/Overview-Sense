import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

// The UNIVERSAL Overview action language, shown on every object / phenomenon / place.
// "Cambia ciò che possiamo vedere, non ciò che possiamo fare."
//  🔭 LOOK UP  — observe it for real, from here, now (camera + real sky/sensors).
//  🌌 GO INSIDE — enter an immersive exploration of the subject.
//  🎬 Guided Journey — a narrated tour.
//  📸 Senshot   — capture your point of view and publish it.
interface Props {
  onLookUp?: () => void;
  onGoInside?: () => void;
  onGuidedJourney?: () => void;
  onSenshot?: () => void;
  lookUpLabel?: string;
  goInsideLabel?: string;
  note?: string;
}

export function SenseActionBar({
  onLookUp, onGoInside, onGuidedJourney, onSenshot,
  lookUpLabel = "LOOK UP", goInsideLabel = "GO INSIDE", note,
}: Props) {
  const tap = (fn?: () => void) => () => { if (!fn) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); fn(); };
  const hasSecondary = onGuidedJourney || onSenshot;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Ionicons name="planet" size={14} color={colors.brand} />
        <Text style={styles.head}>VIVI QUESTA REALTÀ</Text>
      </View>

      <View style={styles.mainRow}>
        {onLookUp ? (
          <Pressable testID="action-look-up" style={[styles.big, styles.bigGhost]} onPress={tap(onLookUp)}>
            <Ionicons name="telescope-outline" size={20} color={colors.onSurface} />
            <Text style={styles.bigGhostText}>{lookUpLabel}</Text>
            <Text style={styles.bigSub}>Osserva da qui, ora</Text>
          </Pressable>
        ) : null}
        {onGoInside ? (
          <Pressable testID="action-go-inside" style={[styles.big, styles.bigPrimary]} onPress={tap(onGoInside)}>
            <Ionicons name="rocket-outline" size={20} color={colors.onBrand} />
            <Text style={styles.bigPrimaryText}>{goInsideLabel}</Text>
            <Text style={[styles.bigSub, { color: colors.onBrand, opacity: 0.85 }]}>Entra ed esplora</Text>
          </Pressable>
        ) : null}
      </View>

      {hasSecondary ? (
        <View style={styles.chipRow}>
          {onGuidedJourney ? (
            <Pressable testID="action-guided-journey" style={styles.chip} onPress={tap(onGuidedJourney)}>
              <Ionicons name="film-outline" size={15} color={colors.brand} />
              <Text style={styles.chipText}>Guided Journey</Text>
            </Pressable>
          ) : null}
          {onSenshot ? (
            <Pressable testID="action-senshot" style={styles.chip} onPress={tap(onSenshot)}>
              <Ionicons name="camera-outline" size={15} color={colors.brand} />
              <Text style={styles.chipText}>Senshot</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.note}>{note ?? "I dati spiegano · la fotocamera osserva · l'esplorazione fa vivere · il Senshot conserva e condivide."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand, gap: spacing.md },
  headRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  head: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  mainRow: { flexDirection: "row", gap: spacing.md },
  big: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: radius.md, paddingVertical: spacing.lg, minHeight: 92 },
  bigGhost: { backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  bigPrimary: { backgroundColor: colors.brand },
  bigGhostText: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 1, marginTop: 2 },
  bigPrimaryText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 1, marginTop: 2 },
  bigSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, lineHeight: 16, opacity: 0.7 },
});
