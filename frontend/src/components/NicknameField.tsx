import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authApi } from "@/src/lib/backend";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const NICK_RE = /^[a-zA-Z0-9_.]+$/;
type State = "idle" | "checking" | "ok" | "taken" | "invalid";

// Nickname input with real-time (debounced) availability check. Case-insensitive
// on the server. Reports validity via onStatus and offers alternatives when taken.
export function NicknameField({ value, onChange, currentNickname, onStatus, testID }: {
  value: string;
  onChange: (v: string) => void;
  currentNickname?: string;
  onStatus?: (ok: boolean) => void;
  testID?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const seq = useRef(0);
  const report = useRef(onStatus);
  report.current = onStatus;

  useEffect(() => {
    const nick = value.trim();
    report.current?.(false);
    setSuggestions([]);
    if (currentNickname && nick.toLowerCase() === currentNickname.toLowerCase()) {
      setState("ok"); report.current?.(true); return;
    }
    if (nick.length === 0) { setState("idle"); return; }
    if (nick.length < 3 || nick.length > 24) { setState("invalid"); return; }
    if (!NICK_RE.test(nick)) { setState("invalid"); return; }
    setState("checking");
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await authApi.nicknameAvailable(nick);
        if (id !== seq.current) return;
        if (r.available) { setState("ok"); report.current?.(true); }
        else {
          setState("taken");
          setSuggestions([`${nick}1`, `${nick}_`, `${nick}${Math.floor(Math.random() * 90 + 10)}`]);
        }
      } catch { if (id === seq.current) setState("idle"); }
    }, 350);
    return () => clearTimeout(t);
  }, [value, currentNickname]);

  const border = state === "ok" ? colors.success : state === "taken" || state === "invalid" ? colors.error : colors.border;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.inputRow, { borderColor: border }]}>
        <TextInput testID={testID} style={styles.input} value={value} onChangeText={onChange}
          autoCapitalize="none" autoCorrect={false} placeholder="es. stargazer"
          placeholderTextColor={colors.onSurfaceSecondary} maxLength={24} />
        {state === "checking" ? <ActivityIndicator size="small" color={colors.brand} />
          : state === "ok" ? <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          : state === "taken" || state === "invalid" ? <Ionicons name="close-circle" size={20} color={colors.error} />
          : null}
      </View>
      {state === "ok" ? <Text style={[styles.status, { color: colors.success }]}>Nickname disponibile</Text> : null}
      {state === "invalid" ? <Text style={[styles.status, { color: colors.error }]}>3-24 caratteri: lettere, numeri, . e _</Text> : null}
      {state === "taken" ? (
        <View style={{ gap: 6 }}>
          <Text style={[styles.status, { color: colors.error }]}>Nickname già utilizzato</Text>
          <View style={styles.sugRow}>
            {suggestions.map((s) => (
              <Pressable key={s} testID={`nick-sug-${s}`} style={styles.sug} onPress={() => onChange(s)}>
                <Text style={styles.sugText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, padding: 0 },
  status: { fontFamily: fonts.medium, fontSize: type.sm },
  sugRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sug: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  sugText: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm },
});
