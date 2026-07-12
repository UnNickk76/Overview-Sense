import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, spacing, type } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { streamChat } from "@/src/lib/aiStream";

interface Msg { role: "user" | "assistant"; text: string }

const SUGGESTIONS = [
  "Che cos'è un neutrino?",
  "Perché la luce del Sole impiega 8 minuti?",
  "Cosa sono le aurore?",
  "Quanto è distante Sirio?",
];

export default function Assistant() {
  const insets = useSafeAreaInsets();
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    (async () => {
      let sid: string = (await storage.getItem<string>("assistant_session", "")) ?? "";
      if (!sid) { sid = `sess_${Date.now()}_${Math.floor(Math.random() * 1e6)}`; await storage.setItem("assistant_session", sid); }
      setSessionId(sid);
    })();
  }, []);

  const send = (text: string) => {
    if (!text.trim() || streaming || !sessionId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setStreaming(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    abortRef.current = streamChat(
      sessionId, text, null,
      (delta) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", text: copy[copy.length - 1].text + delta };
          return copy;
        });
        scrollRef.current?.scrollToEnd({ animated: false });
      },
      () => setStreaming(false),
      () => {
        setMessages((m) => {
          const copy = [...m];
          if (!copy[copy.length - 1].text) copy[copy.length - 1] = { role: "assistant", text: "Assistente non disponibile in questo momento." };
          return copy;
        });
        setStreaming(false);
      },
    );
  };

  useEffect(() => () => { abortRef.current?.(); }, []);

  return (
    <SpaceBackground>
      <ScreenHeader title="Assistente" subtitle="Chiedi cosa stai osservando" />
      <KeyboardAvoidingView behavior="translate-with-padding" keyboardVerticalOffset={insets.top + 8} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="sparkles" size={36} color={colors.brand} />
              <Text style={styles.emptyTitle}>Il tuo interprete del cosmo</Text>
              <Text style={styles.emptyText}>
                Chiedi qualsiasi cosa su ciò che vedi: stelle, pianeti, campi, luce e tempo. Rispondo solo con scienza reale — mai invenzioni.
              </Text>
              <View style={styles.chips}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} testID={`suggestion-${s.slice(0, 8)}`} style={styles.chip} onPress={() => send(s)}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]} testID={`message-${m.role}-${i}`}>
                {m.role === "assistant" && !m.text && streaming ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <Text style={[styles.bubbleText, m.role === "user" && { color: colors.onBrand }]}>{m.text}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            placeholder="Chiedi all'universo…"
            placeholderTextColor={colors.onSurfaceSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={() => send(input)}
          />
          <Pressable testID="send-button" style={[styles.sendBtn, (!input.trim() || streaming) && styles.sendDisabled]} onPress={() => send(input)} disabled={!input.trim() || streaming}>
            <Ionicons name="arrow-up" size={22} color={colors.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 22, paddingHorizontal: spacing.md },
  chips: { gap: spacing.sm, marginTop: spacing.lg, alignSelf: "stretch" },
  chip: { backgroundColor: colors.tertiary, borderRadius: 14, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base },
  bubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.brand },
  aiBubble: { alignSelf: "flex-start", backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bubbleText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: "rgba(5,6,10,0.9)" },
  input: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.lg, maxHeight: 120, backgroundColor: colors.tertiary, borderRadius: 20, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.4 },
});
