import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, AudioPlayer } from "expo-audio";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, spacing, type } from "@/src/theme";
import { listObservations, removeObservation, observationCode, Observation } from "@/src/lib/gallery";

export default function Observations() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [items, setItems] = useState<Observation[]>([]);
  const player = useRef<AudioPlayer | null>(null);

  const load = useCallback(() => { listObservations().then(setItems); }, []);
  useFocusEffect(useCallback(() => { load(); return () => { player.current?.release(); player.current = null; }; }, [load]));

  const playAudio = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.current?.release();
    player.current = createAudioPlayer({ uri });
    player.current.play();
  };

  const del = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await removeObservation(id);
    load();
  };

  const cell = (width - spacing.lg * 2 - spacing.md) / 2;
  const images = items.filter((i) => i.kind === "image");
  const audios = items.filter((i) => i.kind === "audio");

  return (
    <SpaceBackground>
      <ScreenHeader title="Le mie osservazioni" subtitle={`${items.length} salvate`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="observations-screen">
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={44} color={colors.brand} />
            <Text style={styles.emptyTitle}>Nessuna osservazione</Text>
            <Text style={styles.emptyText}>Cattura una scena dal modulo Cielo o registra il paesaggio sonoro dal Listening Layer per salvarle qui.</Text>
          </View>
        ) : null}

        {images.length > 0 ? (
          <>
            <Text style={styles.section}>Immagini</Text>
            <View style={styles.grid}>
              {images.map((o) => (
                <Pressable key={o.id} testID={`obs-${o.id}`} style={[styles.imgCard, { width: cell }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/observation?id=${o.id}` as never); }}>
                  <Image source={{ uri: o.uri }} style={{ width: cell, height: cell }} contentFit="cover" />
                  <View style={styles.imgFooter}>
                    <Text style={styles.imgLabel} numberOfLines={1}>{observationCode(o.seq)}</Text>
                    <Pressable testID={`delete-${o.id}`} onPress={() => del(o.id)} hitSlop={8}>
                      <Ionicons name="trash" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {audios.length > 0 ? (
          <>
            <Text style={styles.section}>Registrazioni sonore</Text>
            {audios.map((o) => (
              <View key={o.id} style={styles.audioRow} testID={`obs-${o.id}`}>
                <Pressable testID={`play-${o.id}`} style={styles.playBtn} onPress={() => playAudio(o.uri)}>
                  <Ionicons name="play" size={18} color={colors.onBrand} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.audioLabel}>{o.label}</Text>
                  <Text style={styles.audioDate}>{new Date(o.ts).toLocaleString()}</Text>
                </View>
                <Pressable testID={`delete-${o.id}`} onPress={() => del(o.id)} hitSlop={8}>
                  <Ionicons name="trash" size={18} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", paddingTop: spacing["3xl"], gap: spacing.md },
  emptyTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21, paddingHorizontal: spacing.lg },
  section: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  imgCard: { borderRadius: 14, overflow: "hidden", backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  imgFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.sm, gap: spacing.sm },
  imgLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 2, flex: 1 },
  audioRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.tertiary, borderRadius: 14, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  audioLabel: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  audioDate: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2 },
});
