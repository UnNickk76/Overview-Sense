import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, Switch, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { communityApi, PrivacySettings, PresenceLevel, IdentityPref } from "@/src/lib/community";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

const LEVELS: { key: PresenceLevel; title: string; desc: string }[] = [
  { key: 1, title: "Livello 1 · Invisibile", desc: "Nessun Presence Match™. Le persone possono fotografarmi, ma non comparirò mai come utente OverView™." },
  { key: 2, title: "Livello 2 · Richiesta", desc: "Consento la richiesta di menzione. Se rifiuto, la foto resta normale ma senza alcuna identificazione." },
  { key: 3, title: "Livello 3 · Richiesta + filtro", desc: "Come il Livello 2, ma se rifiuto OverView™ rende il mio volto non riconoscibile, in modo naturale." },
  { key: 4, title: "Livello 4 · Automatico", desc: "Accetto automaticamente la menzione con l'identità che ho scelto." },
];

const IDENTITY: { key: IdentityPref; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "name", label: "Nome e Cognome", icon: "person" },
  { key: "nickname", label: "Nickname", icon: "at" },
  { key: "none", label: "Nessuna identificazione", icon: "eye-off" },
];

export default function PrivacyConsent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [s, setS] = useState<PrivacySettings>({ presence_level: 1, face_scanned: false, identity_pref: "nickname" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { communityApi.getPrivacy().then(setS).catch(() => {}); }, []);

  const patch = async (payload: Partial<PrivacySettings>) => {
    Haptics.selectionAsync();
    setS((cur) => ({ ...cur, ...payload }));
    setSaving(true);
    try { const r = await communityApi.updatePrivacy(payload); setS(r); } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Privacy & Consensi™" subtitle="La tua identità, il tuo controllo"
        right={saving ? <ActivityIndicator size="small" color={colors.brand} /> : undefined} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
          <Text style={styles.heroText}>OverView™ osserva il mondo, non identifica le persone. L&apos;unico volto riconoscibile automaticamente è il tuo, solo se lo attivi. Chiunque altro viene identificato solo se entrambe le parti sono d&apos;accordo.</Text>
        </View>

        {/* Owner face scan */}
        <View style={styles.card}>
          <View style={styles.rowHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Riconoscimento del proprietario</Text>
              <Text style={styles.cardSub}>Scan volontario del tuo volto: Sense Vision™ riconosce solo te, l&apos;intestatario dell&apos;account.</Text>
            </View>
            <Switch testID="face-scan" value={s.face_scanned} onValueChange={(v) => patch({ face_scanned: v })}
              trackColor={{ true: colors.brand, false: colors.border }} thumbColor="#fff" />
          </View>
          <Text style={styles.note}>ℹ️ Lo scan del volto avviene sul dispositivo e sarà disponibile su build nativa. Solo dati matematici, nessuna foto del volto viene memorizzata.</Text>
        </View>

        {/* Identity preference */}
        <View>
          <Text style={styles.sectionTitle}>QUANDO COMPARE IL MIO VOLTO, MOSTRA</Text>
          <View style={styles.chips}>
            {IDENTITY.map((i) => {
              const on = s.identity_pref === i.key;
              return (
                <Pressable key={i.key} testID={`identity-${i.key}`} style={[styles.chip, on && styles.chipOn]} onPress={() => patch({ identity_pref: i.key })}>
                  <Ionicons name={i.icon} size={14} color={on ? colors.brand : colors.onSurfaceSecondary} />
                  <Text style={[styles.chipText, on && { color: colors.onSurface }]}>{i.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Presence Match levels */}
        <View>
          <Text style={styles.sectionTitle}>PRESENCE MATCH™ · LIVELLO PRIVACY</Text>
          <Text style={styles.catHint}>Decide come OverView™ si comporta quando un altro utente vorrebbe menzionarti. Modificabile in qualsiasi momento.</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {LEVELS.map((l) => {
              const on = s.presence_level === l.key;
              return (
                <Pressable key={l.key} testID={`level-${l.key}`} style={[styles.level, on && styles.levelOn]} onPress={() => patch({ presence_level: l.key })}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.levelTitle, on && { color: colors.brand }]}>{l.title}</Text>
                    <Text style={styles.levelDesc}>{l.desc}</Text>
                  </View>
                  <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.brand : colors.onSurfaceSecondary} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable testID="open-match-history" style={styles.historyBtn} onPress={() => router.push("/match-history" as never)}>
          <Ionicons name="time-outline" size={18} color={colors.brand} />
          <Text style={styles.historyText}>Apri Match History™</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} style={{ marginLeft: "auto" }} />
        </Pressable>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heroText: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 20 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  rowHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  cardSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2, lineHeight: 16 },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, lineHeight: 15, fontStyle: "italic" },
  sectionTitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1 },
  catHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 4, lineHeight: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { borderColor: colors.brand },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  level: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  levelOn: { borderColor: colors.brand },
  levelTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  levelDesc: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2, lineHeight: 16 },
  historyBtn: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  historyText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
});
