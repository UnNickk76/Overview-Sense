import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { ApiError } from "@/src/lib/client";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) { setError("Inserisci email e password."); return; }
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await login(email.trim(), password);
      if (router.canGoBack()) router.back(); else router.replace("/feed" as never);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Accesso non riuscito.");
    } finally { setBusy(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Accedi" />
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.betaBanner}>
          <Text style={styles.betaTag}>BETA</Text>
          <Text style={styles.betaText}>Versione beta · app in fase di sviluppo. Funzioni e dati possono cambiare.</Text>
        </View>

        <Text style={styles.lead}>Bentornato esploratore. Accedi per pubblicare le tue Observation e seguire la community.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput testID="login-email" style={styles.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" placeholder="tu@esempio.com"
            placeholderTextColor={colors.onSurfaceSecondary} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput testID="login-password" style={styles.input} value={password} onChangeText={setPassword}
            secureTextEntry placeholder="••••••••" placeholderTextColor={colors.onSurfaceSecondary} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable testID="login-submit" style={[styles.primary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>Accedi</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace("/register" as never)} style={styles.link}>
          <Text style={styles.linkText}>Non hai un account? <Text style={{ color: colors.brand }}>Registrati</Text></Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  betaBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  betaTag: { color: colors.onBrand, backgroundColor: colors.brand, fontFamily: fonts.bold, fontSize: type.sm - 2, letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  betaText: { flex: 1, color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 16 },
  field: { gap: spacing.sm },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  error: { color: colors.error, fontFamily: fonts.medium, fontSize: type.base },
  primary: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center" },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  link: { alignItems: "center", paddingVertical: spacing.sm },
  linkText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
});
