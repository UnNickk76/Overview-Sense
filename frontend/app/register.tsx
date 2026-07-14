import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { ApiError } from "@/src/lib/client";

export default function Register() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!email.trim() || !nickname.trim() || !password) { setError("Compila tutti i campi."); return; }
    if (nickname.trim().length < 3) { setError("Il nickname deve avere almeno 3 caratteri."); return; }
    if (password.length < 6) { setError("La password deve avere almeno 6 caratteri."); return; }
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await register(email.trim(), nickname.trim(), password);
      if (router.canGoBack()) router.back(); else router.replace("/feed" as never);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Registrazione non riuscita.");
    } finally { setBusy(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Crea account" />
      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>Diventa un esploratore di OverView. Il tuo nickname è pubblico e univoco.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Nickname</Text>
          <TextInput testID="register-nickname" style={styles.input} value={nickname} onChangeText={setNickname}
            autoCapitalize="none" placeholder="es. stargazer" placeholderTextColor={colors.onSurfaceSecondary} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput testID="register-email" style={styles.input} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" placeholder="tu@esempio.com"
            placeholderTextColor={colors.onSurfaceSecondary} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput testID="register-password" style={styles.input} value={password} onChangeText={setPassword}
            secureTextEntry placeholder="almeno 6 caratteri" placeholderTextColor={colors.onSurfaceSecondary} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable testID="register-submit" style={[styles.primary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.primaryText}>Registrati</Text>}
        </Pressable>

        <Pressable onPress={() => router.replace("/login" as never)} style={styles.link}>
          <Text style={styles.linkText}>Hai già un account? <Text style={{ color: colors.brand }}>Accedi</Text></Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  field: { gap: spacing.sm },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  error: { color: colors.error, fontFamily: fonts.medium, fontSize: type.base },
  primary: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: "center" },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  link: { alignItems: "center", paddingVertical: spacing.sm },
  linkText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
});
