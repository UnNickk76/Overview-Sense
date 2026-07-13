import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import ViewShot, { captureRef } from "react-native-view-shot";
import Animated, { FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SenseMark } from "@/src/components/SenseMark";
import { ImageZoomViewer } from "@/src/components/ImageZoomViewer";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import {
  getObject, formatDistanceKm, lightTravelTime, travelTime, TRAVEL_SPEEDS,
  nasaQueryFor, compareWithEarth,
} from "@/src/lib/cosmos";
import { socialApi, CosmicImage } from "@/src/lib/backend";
import { useAuth } from "@/src/context/AuthContext";

export default function CosmicObjectScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const obj = id ? getObject(id) : undefined;
  const [speedIdx, setSpeedIdx] = useState(5);
  const [images, setImages] = useState<CosmicImage[]>([]);
  const [imgLoading, setImgLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [desc, setDesc] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const snapRef = useRef<ViewShot>(null);

  useEffect(() => {
    if (!obj) return;
    let alive = true;
    setImgLoading(true);
    socialApi.cosmosImages(nasaQueryFor(obj), 12)
      .then((r) => {
        if (!alive) return;
        let imgs = r.images ?? [];
        if (!imgs.length && obj.imageUrl) imgs = [{ thumb: obj.imageUrl, image: obj.imageUrl, title: obj.name, description: obj.description }];
        setImages(imgs);
      })
      .catch(() => { if (obj.imageUrl) setImages([{ thumb: obj.imageUrl, image: obj.imageUrl, title: obj.name, description: obj.description }]); })
      .finally(() => { if (alive) setImgLoading(false); });
    return () => { alive = false; };
  }, [obj]);

  if (!obj) {
    return <SpaceBackground><ScreenHeader title="Oggetto" /><View style={styles.center}><Text style={styles.muted}>Oggetto non trovato.</Text></View></SpaceBackground>;
  }

  const speed = TRAVEL_SPEEDS[speedIdx];
  const nf = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 2 });
  const hero = images[0]?.image ?? obj.imageUrl ?? null;
  const comparisons = compareWithEarth(obj);
  const distStr = obj.distanceLabel ?? formatDistanceKm(obj.distanceKm);

  const openViewer = (i: number) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setViewerIndex(i); setViewerOpen(true); };

  const snapshot = async (mode: "share" | "save") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("Preparazione…");
    try {
      const uri = await captureRef(snapRef, { format: "png", quality: 1 });
      if (mode === "share") {
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        setStatus(null);
      } else {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (!perm.granted) { setStatus("Permesso Foto negato"); return; }
        await MediaLibrary.saveToLibraryAsync(uri);
        setStatus("Salvato in Foto ✓");
      }
    } catch { setStatus("Operazione non riuscita"); }
  };

  const publish = async () => {
    if (!user) { router.push("/login" as never); return; }
    if (!hero) return;
    setPublishing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const path = FileSystem.cacheDirectory + `cosmos_${Date.now()}.jpg`;
      const dl = await FileSystem.downloadAsync(hero, path);
      const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
      const created = await socialApi.createObservation({
        media_type: "image", source: "cosmos",
        caption: desc.trim() || obj.name,
        image_base64: b64,
        data: { cosmicId: obj.id, name: obj.name, type: obj.type, distance: distStr, source_image: hero } as never,
      });
      setPublished(created.id);
    } catch { setStatus("Pubblicazione non riuscita"); } finally { setPublishing(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title={obj.name} subtitle={obj.type} />
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="cosmic-object">

        {/* Hero (snapshot-composed) */}
        <ViewShot ref={snapRef} style={styles.snapCard}>
          {hero ? (
            <Pressable onPress={() => openViewer(0)}>
              <Image source={{ uri: hero }} style={styles.image} contentFit="cover" transition={250} />
            </Pressable>
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              {imgLoading ? <ActivityIndicator color={colors.brand} /> : <Text style={{ fontSize: 60 }}>{obj.emoji}</Text>}
            </View>
          )}
          <View style={styles.snapWm}>
            <SenseMark size={16} />
            <Text style={styles.snapWmText}>Overview · {obj.name} · {distStr}</Text>
          </View>
        </ViewShot>

        {/* Gallery strip */}
        {imgLoading ? (
          <Text style={styles.loadingHint}>Carico immagini reali NASA…</Text>
        ) : images.length > 1 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.sectionLabel}>GALLERIA REALE · {images.length} immagini</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {images.map((img, i) => (
                <Pressable key={i} testID={`gallery-thumb-${i}`} onPress={() => openViewer(i)}>
                  <Image source={{ uri: img.thumb }} style={styles.thumb} contentFit="cover" transition={150} />
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.note}>Tocca un&apos;immagine per aprirla a schermo intero · pizzica per zoomare. Fonte: NASA (pubblico dominio).</Text>
          </View>
        ) : null}

        <Text style={styles.desc}>{obj.description}</Text>

        <View style={styles.dataCard}>
          <Row label="Distanza dalla Terra" value={distStr} />
          {obj.distanceKm > 0 ? <Row label="Tempo-luce (età della luce)" value={lightTravelTime(obj.distanceKm)} /> : null}
          {obj.diameterKm ? <Row label="Diametro" value={`${nf(obj.diameterKm)} km`} /> : null}
          {obj.massKg ? <Row label="Massa" value={`${obj.massKg.toExponential(2)} kg`} /> : null}
          {obj.gravityMs2 ? <Row label="Gravità" value={`${nf(obj.gravityMs2)} m/s²`} /> : null}
          {obj.tempK ? <Row label="Temperatura" value={`${nf(obj.tempK - 273.15)} °C`} /> : null}
          {obj.orbitalPeriod ? <Row label="Periodo orbitale" value={obj.orbitalPeriod} /> : null}
        </View>

        {/* Comparison with Earth */}
        {comparisons.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONFRONTO CON LA TERRA 🌍</Text>
            {comparisons.map((c, i) => (
              <View key={i} style={styles.cmpRow}>
                <Text style={styles.cmpLabel}>{c.label}</Text>
                <Text style={styles.cmpValue}>{c.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Travel Here */}
        {obj.distanceKm > 0 ? (
          <View style={styles.travelCard}>
            <View style={styles.travelHead}>
              <Ionicons name="rocket" size={16} color={colors.brand} />
              <Text style={styles.travelTitle}>TRAVEL HERE</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {TRAVEL_SPEEDS.map((s, i) => (
                <Pressable key={s.key} onPress={() => { Haptics.selectionAsync(); setSpeedIdx(i); }}
                  style={[styles.speedChip, i === speedIdx && styles.speedActive]}>
                  <Text style={[styles.speedText, i === speedIdx && { color: colors.onBrand }]}>{s.emoji} {s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Animated.Text key={speedIdx} entering={FadeIn.duration(300)} style={styles.travelResult}>
              {travelTime(obj.distanceKm, speed.kmh)}
            </Animated.Text>
            <Text style={styles.travelSub}>di viaggio {speed.label.toLowerCase()} per raggiungere {obj.name}.</Text>
          </View>
        ) : null}

        {obj.facts.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CURIOSITÀ</Text>
            {obj.facts.map((f, i) => (
              <View key={i} style={styles.factRow}><View style={styles.dot} /><Text style={styles.fact}>{f}</Text></View>
            ))}
          </View>
        ) : null}

        {/* Snapshot + share */}
        <View style={styles.actions}>
          <Pressable testID="cosmic-snapshot-share" style={styles.actBtn} onPress={() => snapshot("share")} disabled={!hero}>
            <Ionicons name="camera" size={18} color={colors.onSurface} />
            <Text style={styles.actText}>Snapshot</Text>
          </Pressable>
          <Pressable testID="cosmic-snapshot-save" style={styles.actBtn} onPress={() => snapshot("save")} disabled={!hero}>
            <Ionicons name="download" size={18} color={colors.onSurface} />
            <Text style={styles.actText}>Salva</Text>
          </Pressable>
        </View>

        {/* Add description + publish */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AGGIUNGI UNA DESCRIZIONE</Text>
          <TextInput
            testID="cosmic-desc"
            style={styles.descInput}
            value={desc}
            onChangeText={setDesc}
            placeholder="Racconta cosa hai scoperto, una teoria, una curiosità…"
            placeholderTextColor={colors.onSurfaceSecondary}
            multiline
          />
          {published ? (
            <Pressable testID="cosmic-published" style={styles.publishedBtn} onPress={() => router.push(`/observation-detail?id=${published}` as never)}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.publishedText}>Pubblicato · Apri</Text>
            </Pressable>
          ) : (
            <Pressable testID="cosmic-publish" style={[styles.primary, publishing && { opacity: 0.6 }]} onPress={publish} disabled={publishing}>
              {publishing ? <ActivityIndicator color={colors.onBrand} /> : (
                <><Ionicons name="cloud-upload-outline" size={18} color={colors.onBrand} /><Text style={styles.primaryText}>Pubblica come Observation</Text></>
              )}
            </Pressable>
          )}
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Text style={styles.note}>Immagini e dati da fonti pubbliche (NASA e cataloghi astronomici standard). Overview li unisce in un&apos;esperienza — senza inventare nulla.</Text>
      </KeyboardAwareScrollView>

      {images.length ? (
        <ImageZoomViewer images={images} initialIndex={viewerIndex} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
      ) : null}
    </SpaceBackground>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  snapCard: { borderRadius: radius.lg, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 16 / 10, backgroundColor: colors.tertiary },
  placeholder: { alignItems: "center", justifyContent: "center", borderRadius: radius.lg },
  snapWm: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: "rgba(0,0,0,0.5)" },
  snapWmText: { color: "#fff", fontFamily: fonts.medium, fontSize: type.sm - 1 },
  loadingHint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  sectionLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 1.2 },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.tertiary },
  desc: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.lg, lineHeight: 24 },
  dataCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  rowValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flexShrink: 1, textAlign: "right" },
  cmpRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cmpLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  cmpValue: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  travelCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  travelHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  travelTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  speedChip: { backgroundColor: colors.tertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  speedActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  speedText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  travelResult: { color: colors.brand, fontFamily: fonts.bold, fontSize: type["2xl"] },
  travelSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  section: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.sm },
  sectionTitle: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 1, letterSpacing: 1.5 },
  factRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brand, marginTop: 7 },
  fact: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 21, flex: 1 },
  actions: { flexDirection: "row", gap: spacing.md },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  descInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, minHeight: 72, textAlignVertical: "top", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.md },
  primaryText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  publishedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.success },
  publishedText: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base },
  status: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base, textAlign: "center" },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.6 },
});
