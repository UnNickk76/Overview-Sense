import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { collectionsApi, mediaUrl, SenseCollection, FeedObservation } from "@/src/lib/backend";

const VIS_LABEL: Record<string, string> = { private: "Privata", friends: "Amici", public: "Pubblica", collaborative: "Collaborativa" };

export default function CollectionDetail() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [coll, setColl] = useState<SenseCollection | null>(null);
  const [items, setItems] = useState<FeedObservation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    collectionsApi.detail(String(id))
      .then((r) => { setColl(r.collection); setItems(r.items); })
      .catch(() => { setColl(null); })
      .finally(() => setLoading(false));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeItem = (obsId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Rimuovi dal collezione", "Rimuovere questo Senshot dalla collezione?", [
      { text: "Annulla", style: "cancel" },
      { text: "Rimuovi", style: "destructive", onPress: async () => { await collectionsApi.removeItem(String(id), obsId); load(); } },
    ]);
  };

  const deleteCollection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Elimina collezione", "Questa azione non può essere annullata. I Senshot NON verranno eliminati.", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => { await collectionsApi.remove(String(id)); router.back(); } },
    ]);
  };

  const cell = (width - spacing.lg * 2 - spacing.md) / 2;

  return (
    <SpaceBackground>
      <ScreenHeader
        title={coll?.title || "Collezione"}
        subtitle={coll ? `${coll.count} Senshot · ${VIS_LABEL[coll.visibility]}${coll.dynamic ? " · Auto" : ""}` : "The Sense Collection™"}
        right={coll?.is_owner ? (
          <Pressable testID="delete-collection" hitSlop={8} onPress={deleteCollection}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
        ) : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.md }} showsVerticalScrollIndicator={false} testID="collection-detail">
        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["3xl"] }} /> : null}

        {coll?.description ? <Text style={styles.desc}>{coll.description}</Text> : null}
        {coll?.dynamic ? (
          <View style={styles.dynBanner}>
            <Ionicons name="flash" size={15} color={colors.brand} />
            <Text style={styles.dynTxt}>Collezione dinamica — si aggiorna da sola con i tuoi Senshot di «{coll.auto_rule?.value}».</Text>
          </View>
        ) : null}

        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={40} color={colors.brand} />
            <Text style={styles.emptyText}>{coll?.dynamic ? "Nessun Senshot corrisponde ancora a questa categoria." : "Collezione vuota. Aggiungi Senshot dal loro dettaglio."}</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {items.map((o) => {
            const img = mediaUrl(o.image_url);
            return (
              <Pressable key={o.id} testID={`item-${o.id}`} style={[styles.card, { width: cell }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/observation-detail?id=${o.id}` as never); }}>
                <View style={[styles.thumb, { height: cell }]}>
                  {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> :
                    <Ionicons name="planet" size={30} color={colors.onSurfaceSecondary} />}
                  <View style={styles.svBadge}><Ionicons name="sparkles" size={10} color={colors.brand} /><Text style={styles.svTxt}>{o.scientific_value}</Text></View>
                  {coll?.is_owner && !coll.dynamic ? (
                    <Pressable testID={`remove-${o.id}`} style={styles.rm} hitSlop={6} onPress={() => removeItem(o.id)}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{o.title || o.caption || o.category}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  desc: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21 },
  dynBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "rgba(212,175,55,0.08)", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  dynTxt: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: spacing["2xl"], gap: spacing.md },
  emptyText: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21, paddingHorizontal: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { gap: 5 },
  thumb: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.tertiary, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  svBadge: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  svTxt: { color: colors.brand, fontFamily: fonts.mono, fontSize: 10 },
  rm: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, padding: 4 },
  cardTitle: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
});
