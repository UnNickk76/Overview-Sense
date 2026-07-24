import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { getObservation, observationCode, updateObservationConfig, Observation } from "@/src/lib/gallery";
import { socialApi } from "@/src/lib/backend";
import { publishErrorMessage } from "@/src/lib/publishError";
import { ApiError } from "@/src/lib/client";
import { senseImageBase64 } from "@/src/lib/imageUpload";
import { enqueuePublish } from "@/src/lib/pendingPublish";
import { useAuth } from "@/src/context/AuthContext";
import { BrandName } from "@/src/components/Brand";
import { pulseForNow } from "@/src/lib/pulseTasks";
import { SenseLayerBar } from "@/src/components/SenseLayerBar";
import { SenseVisualLayer } from "@/src/components/SenseCanvas";
import { SenseDetail, SenseDisplayConfig } from "@/src/components/SenseDetail";
import { DiscoveryCard, CardFormat } from "@/src/components/DiscoveryCard";
import { observationLandingUrl, observationAppUrl } from "@/src/lib/deeplink";
import { GeoPrivacyPicker } from "@/src/components/GeoPrivacyPicker";
import type { GeoPrecision } from "@/src/lib/backend";
import { assessPrivacy, recordPlace } from "@/src/lib/placeHistory";

export default function ObservationView() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [obs, setObs] = useState<Observation | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [config, setConfig] = useState<SenseDisplayConfig | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLayer, setExportLayer] = useState<SenseVisualLayer>("Originale");
  const [exportFormat, setExportFormat] = useState<CardFormat>("square");
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportQr, setExportQr] = useState(false);
  const [pubOpen, setPubOpen] = useState(false);
  const [geoPrec, setGeoPrec] = useState<GeoPrecision>("exact");
  const [geoSuggest, setGeoSuggest] = useState<GeoPrecision | null>(null);
  const [geoReason, setGeoReason] = useState<string | null>(null);
  const shotRef = useRef<ViewShot>(null);
  const cardRef = useRef<ViewShot>(null);

  useEffect(() => { if (id) getObservation(id).then(setObs); }, [id]);
  useEffect(() => {
    const lat = obs?.data?.lat, lon = obs?.data?.lon;
    if (lat != null && lon != null) {
      assessPrivacy(lat, lon).then((a) => {
        if (a.suggested) { setGeoSuggest(a.suggested); setGeoReason(a.reason); setGeoPrec(a.suggested); }
        recordPlace(lat, lon);
      }).catch(() => {});
    }
  }, [obs]);

  const persistConfig = (cfg: SenseDisplayConfig) => {
    setConfig(cfg);
    if (id) updateObservationConfig(id, { legendHidden: cfg.legendHidden, legendOn: cfg.legendOn, senseLayers: cfg.senseLayers }).catch(() => {});
  };

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("Preparazione…");
    try {
      const uri = await captureRef(shotRef, { format: "jpg", quality: 0.95 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      setStatus(null);
    } catch { setStatus("Condivisione non riuscita"); }
  };
  const saveToPhotos = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatus("Salvataggio…");
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) { setStatus("Permesso Foto negato"); return; }
    try {
      const uri = await captureRef(shotRef, { format: "jpg", quality: 0.95 });
      await MediaLibrary.saveToLibraryAsync(uri);
      setStatus("Salvato in Foto ✓");
    } catch { setStatus("Errore"); }
  };
  const exportCardShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExportStatus("Preparazione…");
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      setExportStatus(null);
    } catch { setExportStatus("Condivisione non riuscita"); }
  };
  const exportCardSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExportStatus("Salvataggio…");
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) { setExportStatus("Permesso Foto negato"); return; }
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      setExportStatus("Salvata in Foto ✓");
    } catch { setExportStatus("Errore"); }
  };

  const publish = async (asPulse: boolean) => {
    if (!obs || !obs.data) return;
    if (!user) { router.push("/login" as never); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPublishing(true);
    const src = obs.uri;
    const image_base64 = (await senseImageBase64(src)) ?? undefined;
    let pulseTask = obs.data.pulse;
    if (asPulse && !pulseTask) {
      const t = pulseForNow();
      pulseTask = { id: t.id, title: t.title, theme: t.theme, prompt: t.prompt };
    }
    const data = {
      ...obs.data,
      legendHidden: config?.legendHidden ?? obs.data.legendHidden,
      legendOn: config?.legendOn ?? obs.data.legendOn,
      senseLayers: config?.senseLayers ?? obs.data.senseLayers,
      geoPrecision: geoPrec,
    };
    const payload = {
      media_type: "image", source: "reality",
      caption: "", image_base64, data,
      is_pulse: asPulse || !!obs.data.pulse,
      pulse_task: asPulse || obs.data.pulse ? pulseTask : undefined,
    };
    if (!image_base64) {
      await enqueuePublish(payload, { imageUri: src });
      setPubOpen(false);
      setStatus("Immagine non ancora pronta — Sense messa in coda, verrà pubblicata automaticamente.");
      setPublishing(false);
      return;
    }
    try {
      const created = await socialApi.createObservation(payload);
      setPubOpen(false);
      setPublished(created.id);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 422)) {
        setStatus(publishErrorMessage(e));
        setPubOpen(false);
      } else {
        await enqueuePublish(payload, { imageUri: src });
        setStatus("Rete/server non disponibili — Sense messa in coda, verrà pubblicata appena possibile.");
        setPubOpen(false);
      }
    } finally { setPublishing(false); }
  };

  if (!obs || !obs.data) {
    return <SpaceBackground><ScreenHeader title="Observation" /><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }

  const d = obs.data;
  const dateStr = new Date(d.ts).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const qrValue = published ? observationLandingUrl(published) : observationAppUrl(obs.id);

  return (
    <SpaceBackground>
      <ScreenHeader title={observationCode(obs.seq)} subtitle={dateStr} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }} showsVerticalScrollIndicator={false} testID="observation-view">
        <SenseDetail
          uri={obs.uri}
          data={d}
          code={observationCode(obs.seq)}
          dateStr={dateStr}
          animKey={obs.id}
          qrValue={qrValue}
          canEdit
          onPersistConfig={persistConfig}
          shotRef={shotRef}
          renderActions={({ visualLayer, includeQr, setIncludeQr }) => (
            <>
              <View style={styles.qrToggleRow}>
                <View style={styles.qrToggleLeft}>
                  <Ionicons name="qr-code-outline" size={16} color={colors.onSurfaceSecondary} />
                  <Text style={styles.qrToggleText}>Includi QR code nel salvataggio</Text>
                </View>
                <Pressable testID="toggle-qr" onPress={() => { Haptics.selectionAsync(); setIncludeQr(!includeQr); }}
                  style={[styles.qrSwitch, includeQr && styles.qrSwitchOn]}>
                  <View style={[styles.qrKnob, includeQr && styles.qrKnobOn]} />
                </Pressable>
              </View>
              <View style={styles.actions}>
                <Pressable testID="share-observation" style={styles.actBtn} onPress={share}>
                  <Ionicons name="share-outline" size={18} color={colors.onSurface} />
                  <Text style={styles.actText}>Condividi</Text>
                </Pressable>
                <Pressable testID="save-observation-photo" style={styles.actBtn} onPress={saveToPhotos}>
                  <Ionicons name="download" size={18} color={colors.onSurface} />
                  <Text style={styles.actText}>Salva in Foto</Text>
                </Pressable>
              </View>
              {status ? <Text style={styles.status}>{status}</Text> : null}
              <Pressable testID="export-discovery-card" style={styles.exportBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExportLayer(visualLayer); setExportStatus(null); setExportOpen(true); }}>
                <Ionicons name="albums" size={20} color={colors.onBrand} />
                <Text style={styles.exportText}>Esporta Discovery Card</Text>
              </Pressable>
              {published ? (
                <Pressable testID="published-open-feed" style={styles.publishedBtn} onPress={() => router.push(`/observation-detail?id=${published}` as never)}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.publishedText}>Pubblicato · Apri</Text>
                </Pressable>
              ) : (
                <Pressable testID="publish-observation" style={[styles.publishBtn, publishing && { opacity: 0.6 }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(`/publish-composer?id=${obs.id}` as never); }} disabled={publishing}>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.onBrand} />
                  <Text style={styles.publishText}>Pubblica questo SenseShot</Text>
                </Pressable>
              )}
              <Text style={styles.note}>⭐ Diventerà una Verified Observation quando altri osservatori confermeranno lo stesso fenomeno.</Text>
              <Text style={styles.note}>Solo i Sense catturati con l&apos;app possono essere pubblicati. Le immagini con contenuti di nudità o sessualmente espliciti non sono ammesse e vengono bloccate automaticamente.</Text>
            </>
          )}
        />
      </ScrollView>

      {/* Discovery Card export — personal action (Gallery only) */}
      <Modal visible={exportOpen} animationType="slide" transparent onRequestClose={() => setExportOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg, paddingTop: insets.top + spacing.md }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Discovery Card</Text>
              <Pressable testID="export-close" hitSlop={12} onPress={() => setExportOpen(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <View style={styles.formatRow}>
              {(["square", "story"] as CardFormat[]).map((f) => (
                <Pressable key={f} testID={`format-${f}`} onPress={() => { Haptics.selectionAsync(); setExportFormat(f); }}
                  style={[styles.formatChip, exportFormat === f && styles.formatChipActive]}>
                  <Ionicons name={f === "square" ? "square-outline" : "phone-portrait-outline"} size={15} color={exportFormat === f ? colors.onBrand : colors.onSurface} />
                  <Text style={[styles.formatText, exportFormat === f && { color: colors.onBrand }]}>{f === "square" ? "Quadrato 1:1" : "Story 9:16"}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView contentContainerStyle={styles.previewWrap} showsVerticalScrollIndicator={false}>
              <View style={{ width: "100%", marginBottom: spacing.md }}>
                <SenseLayerBar value={exportLayer} onChange={setExportLayer} compact />
              </View>
              <ViewShot ref={cardRef}>
                <DiscoveryCard obs={obs} publishedId={published} visualLayer={exportLayer} showQr={exportQr}
                  format={exportFormat} width={exportFormat === "square" ? width - spacing.lg * 2 : (width - spacing.lg * 2) * 0.62} />
              </ViewShot>
            </ScrollView>
            <Pressable testID="toggle-qr-export" onPress={() => { Haptics.selectionAsync(); setExportQr((v) => !v); }} style={styles.qrToggleRow}>
              <View style={styles.qrToggleLeft}>
                <Ionicons name="qr-code-outline" size={16} color={colors.onSurfaceSecondary} />
                <Text style={styles.qrToggleText}>Includi QR code</Text>
              </View>
              <View style={[styles.qrSwitch, exportQr && styles.qrSwitchOn]}>
                <View style={[styles.qrKnob, exportQr && styles.qrKnobOn]} />
              </View>
            </Pressable>
            {exportStatus ? <Text style={styles.status}>{exportStatus}</Text> : null}
            <View style={styles.actions}>
              <Pressable testID="export-share" style={styles.exportBtn} onPress={exportCardShare}>
                <Ionicons name="share-outline" size={18} color={colors.onBrand} />
                <Text style={styles.exportText}>Condividi</Text>
              </Pressable>
              <Pressable testID="export-save" style={styles.actBtn} onPress={exportCardSave}>
                <Ionicons name="download" size={18} color={colors.onSurface} />
                <Text style={styles.actText}>Salva</Text>
              </Pressable>
            </View>
            {!published ? <Text style={styles.note}>Suggerimento: pubblica l&apos;Observation per far puntare il QR direttamente alla tua scoperta.</Text> : null}
          </View>
        </View>
      </Modal>

      {/* Publish choice */}
      <Modal visible={pubOpen} animationType="slide" transparent onRequestClose={() => setPubOpen(false)}>
        <Pressable style={styles.pubScrim} onPress={() => setPubOpen(false)}>
          <Pressable style={[styles.pubSheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}}>
            <View style={styles.menuHandle} />
            <Text style={styles.pubTitle}>Pubblica questo SenseShot</Text>
            {obs.data.lat != null ? (
              <ScrollView style={styles.pubGeoScroll} showsVerticalScrollIndicator={false}>
                <GeoPrivacyPicker value={geoPrec} onChange={setGeoPrec} suggested={geoSuggest} reason={geoReason} />
              </ScrollView>
            ) : null}
            <Pressable testID="publish-observe" style={styles.pubItem} onPress={() => publish(false)} disabled={publishing}>
              <View style={styles.pubIcon}><Ionicons name="globe" size={20} color={colors.blue} /></View>
              <View style={{ flex: 1 }}>
                <BrandName name="Observe" style={styles.pubItemTitle} />
                <Text style={styles.pubItemSub}>Nel feed della community.</Text>
              </View>
              {publishing ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
            </Pressable>
            <Pressable testID="publish-pulse" style={styles.pubItem} onPress={() => publish(true)} disabled={publishing}>
              <View style={styles.pubIcon}><Ionicons name="flash" size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <BrandName name="Pulse" style={styles.pubItemTitle} />
                <Text style={styles.pubItemSub}>{obs.data.pulse ? `Sfida: ${obs.data.pulse.title}` : "Come risposta alla Pulse di oggi."}</Text>
              </View>
              {publishing ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  qrToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginBottom: spacing.xs },
  qrToggleLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  qrToggleText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  qrSwitch: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.tertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 3, justifyContent: "center" },
  qrSwitchOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  qrKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.onSurfaceSecondary },
  qrKnobOn: { backgroundColor: colors.onBrand, alignSelf: "flex-end" },
  status: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base, textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing.md },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.tertiary, borderRadius: 16, paddingVertical: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
  exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 16, paddingVertical: spacing.md },
  exportText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  publishBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: 16, paddingVertical: spacing.lg },
  publishText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  publishedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: 16, paddingVertical: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.success },
  publishedText: { color: colors.success, fontFamily: fonts.medium, fontSize: type.base },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.6 },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.lg, gap: spacing.md, maxHeight: "94%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  formatRow: { flexDirection: "row", gap: spacing.sm },
  formatChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.tertiary, borderRadius: 999, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  formatChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  formatText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  previewWrap: { alignItems: "center", paddingVertical: spacing.md },
  pubScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  pubSheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pubGeoScroll: { maxHeight: 320, marginVertical: spacing.sm },
  menuHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  pubTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg, marginBottom: spacing.sm },
  pubItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pubIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.tertiary },
  pubItemTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  pubItemSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
});
