import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { feedbackApi, FeedbackType, FeedbackItem } from "@/src/lib/backend";

const TYPES: { key: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "suggestion", label: "Suggerimento", icon: "bulb" },
  { key: "feature", label: "Nuova funzione", icon: "sparkles" },
  { key: "bug", label: "Bug", icon: "bug" },
  { key: "general", label: "Generale", icon: "chatbox-ellipses" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "In attesa", in_progress: "In lavorazione", resolved: "Risolto", dismissed: "Chiuso",
};

export default function Feedback() {
  const router = useRouter();
  const { user } = useAuth();
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<FeedbackItem[]>([]);

  const loadMine = useCallback(() => {
    if (!user) return;
    feedbackApi.mine().then((r) => setMine(r.items)).catch(() => {});
  }, [user]);

  useFocusEffect(useCallback(() => { loadMine(); }, [loadMine]));

  const submit = async () => {
    if (text.trim().length < 3 || sending) return;
    setSending(true); setMsg(null);
    try {
      await feedbackApi.create(type, text.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setText(""); setMsg("Grazie! Il tuo messaggio è stato inviato al team OverView.");
      loadMine();
    } catch { setMsg("Invio non riuscito. Riprova."); } finally { setSending(false); }
  };

  if (!user) {
    return (
      <SpaceBackground>
        <ScreenHeader title="Feedback" />
        <View style={styles.center}>
          <Ionicons name="chatbox-ellipses-outline" size={54} color={colors.onSurfaceSecondary} />
          <Text style={styles.emptyTitle}>Accedi per inviare feedback</Text>
          <Pressable testID="feedback-login" style={styles.cta} onPress={() => router.push("/login" as never)}>
            <Text style={styles.ctaText}>Accedi</Text>
          </Pressable>
        </View>
      </SpaceBackground>
    );
  }

  return (
    <SpaceBackground>
      <ScreenHeader title="Feedback" subtitle="Aiutaci a migliorare OverView" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Tipo di messaggio</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => {
              const on = type === t.key;
              return (
                <Pressable key={t.key} testID={`fb-type-${t.key}`} style={[styles.typeChip, on && styles.typeChipOn]} onPress={() => { Haptics.selectionAsync(); setType(t.key); }}>
                  <Ionicons name={t.icon} size={15} color={on ? colors.onBrand : colors.brand} />
                  <Text style={[styles.typeText, on && { color: colors.onBrand }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View>
            <Text style={styles.label}>Il tuo messaggio</Text>
            <TextInput testID="fb-text" style={styles.textArea} value={text} onChangeText={setText} multiline
              placeholder="Descrivi il tuo suggerimento, la funzione desiderata o il problema riscontrato…"
              placeholderTextColor={colors.onSurfaceSecondary} maxLength={2000} />
          </View>

          {msg ? <Text style={[styles.msg, msg.startsWith("Grazie") && styles.okMsg]}>{msg}</Text> : null}
          <Pressable testID="fb-submit" style={[styles.primary, (sending || text.trim().length < 3) && { opacity: 0.5 }]} onPress={submit} disabled={sending || text.trim().length < 3}>
            {sending ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>Invia feedback</Text>}
          </Pressable>

          {mine.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Text style={styles.label}>I tuoi invii</Text>
              {mine.map((f) => (
                <View key={f.id} style={styles.mineItem}>
                  <View style={styles.mineHead}>
                    <Text style={styles.mineType}>{TYPES.find((t) => t.key === f.type)?.label ?? f.type}</Text>
                    <View style={[styles.statusPill, f.status === "resolved" && styles.statusOk]}>
                      <Text style={[styles.statusText, f.status === "resolved" && { color: colors.onBrand }]}>{STATUS_LABEL[f.status] ?? f.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.mineText} numberOfLines={3}>{f.text}</Text>
                  {f.creator_note ? <Text style={styles.creatorNote}>↳ Risposta: {f.creator_note}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, marginBottom: spacing.sm },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  typeChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  textArea: { minHeight: 120, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, textAlignVertical: "top", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  msg: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center" },
  okMsg: { color: colors.brand },
  primary: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center" },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  mineItem: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  mineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mineType: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  statusPill: { backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusOk: { backgroundColor: colors.brand },
  statusText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 2 },
  mineText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 19 },
  creatorNote: { color: colors.blue, fontFamily: fonts.regular, fontSize: type.sm - 1, fontStyle: "italic" },
});
