import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { colors, fonts, spacing, type } from "@/src/theme";
import { FeedObservation, InteractionType, socialApi } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";

const DEFS: { type: InteractionType; icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { type: "observed", icon: "checkmark-circle", label: "Observed", color: colors.blue },
  { type: "discovery", icon: "star", label: "Discovery", color: colors.brand },
  { type: "learned", icon: "bulb", label: "Learned", color: "#32D74B" },
];

export function InteractionBar({ obs }: { obs: FeedObservation }) {
  const { user } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState({
    observed: obs.observed, discovery: obs.discovery, learned: obs.learned,
  });
  const [mine, setMine] = useState<Set<string>>(new Set(obs.my_interactions));
  const [busy, setBusy] = useState<string | null>(null);

  const press = async (t: InteractionType) => {
    if (!user) { router.push("/login" as never); return; }
    if (busy) return;
    setBusy(t);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await socialApi.interact(obs.id, t);
      setCounts((c) => ({ ...c, [t]: res.count }));
      setMine((m) => {
        const n = new Set(m);
        if (res.active) n.add(t); else n.delete(t);
        return n;
      });
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <View style={styles.row}>
      <View style={styles.views}>
        <Ionicons name="eye-outline" size={16} color={colors.onSurfaceSecondary} />
        <Text style={styles.viewsText}>{obs.views}</Text>
      </View>
      {DEFS.map((d) => {
        const active = mine.has(d.type);
        return (
          <Pressable key={d.type} testID={`interact-${d.type}-${obs.id}`} onPress={() => press(d.type)}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}>
            <Ionicons name={active ? d.icon : (`${d.icon}-outline` as keyof typeof Ionicons.glyphMap)}
              size={18} color={active ? d.color : colors.onSurfaceSecondary} />
            <Text style={[styles.count, active && { color: d.color }]}>{counts[d.type]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.lg, flexWrap: "wrap" },
  views: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewsText: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
  btn: { flexDirection: "row", alignItems: "center", gap: 5 },
  count: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
});
