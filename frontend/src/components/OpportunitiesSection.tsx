import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useOpportunities } from "@/src/hooks/useOpportunities";
import { LayerKey } from "@/src/lib/opportunities";
import { OpportunityCard } from "./OpportunityCard";

// Per-Layer "OPPORTUNITIES" section — drop into any layer screen.
export function OpportunitiesSection({ layer, max = 3 }: { layer: LayerKey; max?: number }) {
  const { opportunities } = useOpportunities(layer);
  const list = opportunities.slice(0, max);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="flash" size={15} color={colors.brand} />
        <Text style={styles.title}>OPPORTUNITIES</Text>
      </View>
      {list.length === 0 ? (
        <Text style={styles.empty}>Nessuna opportunità particolare in questo momento per questo layer. Continua a esplorare.</Text>
      ) : (
        <View style={{ gap: spacing.md }}>
          {list.map((o) => <OpportunityCard key={o.id} opp={o} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginBottom: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm, letterSpacing: 1.5 },
  empty: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20, opacity: 0.7 },
});
