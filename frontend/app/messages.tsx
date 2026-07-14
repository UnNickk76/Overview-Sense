import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { BottomNav } from "@/src/components/BottomNav";
import { colors, fonts, spacing, type } from "@/src/theme";

export default function Messages() {
  return (
    <SpaceBackground>
      <ScreenHeader title="Messaggi" subtitle="Direct Message" />
      <View style={styles.center}>
        <Ionicons name="chatbubble-ellipses-outline" size={56} color={colors.brand} />
        <Text style={styles.title}>Presto disponibile</Text>
        <Text style={styles.text}>
          I messaggi diretti tra esploratori arriveranno in un prossimo aggiornamento: potrai condividere Senshot,
          punti di vista e viaggi con altri osservatori.
        </Text>
      </View>
      <BottomNav active="dm" />
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: 90 },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl, marginTop: spacing.sm },
  text: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 22 },
});
