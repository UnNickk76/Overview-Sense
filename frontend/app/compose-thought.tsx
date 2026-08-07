import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { socialApi } from "@/src/lib/backend";
import { publishErrorMessage } from "@/src/lib/publishError";

const MAX = 3000;

export default function ComposeThought() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const suspended = !!user?.suspension;
  const trimmed = text.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= MAX && !busy && !suspended;

  const publish = async () => {
    if (!canPost) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await socialApi.createObservation({
        media_type: "text", kind: "thought", caption: trimmed,
        source: "reality", data: {},
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/feed" as never);
    } catch (e) {
      Alert.alert("Pubblicazione non riuscita", publishErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <SpaceBackground>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="thought-close" hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Nuovo Pensiero</Text>
        <Pressable testID="thought-publish" onPress={publish} disabled={!canPost} style={[styles.pubBtn, !canPost && styles.pubBtnOff]}>
          {busy ? <ActivityIndicator color={colors.onBrand} size="small" /> : <Text style={[styles.pubText, !canPost && styles.pubTextOff]}>Pubblica</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 40}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>Anche il pensiero è una realtà invisibile. Condividi una riflessione breve — non un articolo.</Text>
          <TextInput
            testID="thought-input"
            style={styles.input}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX))}
            placeholder="Cosa stai pensando?"
            placeholderTextColor={colors.onSurfaceSecondary}
            multiline
            autoFocus
            textAlignVertical="top"
            scrollEnabled
          />
          <View style={styles.footRow}>
            <Text style={[styles.count, trimmed.length > MAX && { color: colors.error }]}>{trimmed.length}/{MAX}</Text>
          </View>
          {suspended ? (
            <View style={styles.suspNote}>
              <Ionicons name="pause-circle" size={16} color={colors.error} />
              <Text style={styles.suspText}>Account in sola lettura: non puoi pubblicare al momento.</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base + 1 },
  pubBtn: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minWidth: 84, alignItems: "center" },
  pubBtnOff: { backgroundColor: colors.tertiary },
  pubText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm },
  pubTextOff: { color: colors.onSurfaceSecondary },
  body: { padding: spacing.lg, gap: spacing.md },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  input: { minHeight: 220, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 26 },
  footRow: { flexDirection: "row", justifyContent: "flex-end" },
  count: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
  suspNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,69,58,0.1)", borderRadius: radius.md, padding: spacing.md },
  suspText: { color: colors.error, fontFamily: fonts.regular, fontSize: type.sm, flex: 1 },
});
