import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable, ActivityIndicator, TextStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, type } from "@/src/theme";
import { useLang } from "@/src/context/LangContext";
import { translateApi } from "@/src/lib/backend";

/**
 * Shows the ORIGINAL text always, plus a "Traduci" action that appends the
 * translation into the user's language underneath. The original is never
 * replaced — language is a richness, not a barrier. Used across Observe,
 * comments, Ecoes and DMs.
 */
export function TranslatableText({
  text,
  textStyle,
  linkStyle,
  numberOfLines,
}: {
  text?: string | null;
  textStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { lang, t } = useLang();
  const [loading, setLoading] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [sameLang, setSameLang] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const body = (text || "").trim();
  if (!body) return null;

  const run = async () => {
    if (loading) return;
    if (translation) { setTranslation(null); return; } // toggle hide
    setLoading(true);
    try {
      const r = await translateApi.translate(body, lang);
      if (r.source_lang === r.target || r.translation.trim() === body) {
        setSameLang(true);
      } else {
        setTranslation(r.translation);
      }
    } catch { /* fail soft */ } finally { setLoading(false); }
  };

  const clamp = numberOfLines && !expanded ? numberOfLines : undefined;

  return (
    <View>
      <Text style={textStyle} numberOfLines={clamp} onPress={numberOfLines ? () => setExpanded((e) => !e) : undefined}>
        {body}
      </Text>
      <Pressable onPress={run} hitSlop={8} style={styles.row} testID="translate-btn">
        {loading ? <ActivityIndicator size="small" color={colors.blue} /> : (
          <Ionicons name={translation ? "chevron-up" : "language"} size={13} color={colors.blue} />
        )}
        <Text style={[styles.link, linkStyle]}>
          {sameLang ? (lang === "it" ? "Già nella tua lingua" : "Already in your language")
            : translation ? (lang === "it" ? "Nascondi traduzione" : "Hide translation")
            : t("translate")}
        </Text>
      </Pressable>
      {translation ? (
        <View style={styles.translated}>
          <View style={styles.tagRow}>
            <Ionicons name="sparkles" size={11} color={colors.onSurfaceSecondary} />
            <Text style={styles.tag}>{lang === "it" ? "Traduzione" : "Translation"}</Text>
          </View>
          <Text style={textStyle}>{translation}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-start" },
  link: { color: colors.blue, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  translated: { marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: colors.border },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  tag: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 3, textTransform: "uppercase", letterSpacing: 0.4 },
});
