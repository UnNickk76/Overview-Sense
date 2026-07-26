import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { SenseCanvas, layerToVisual } from "@/src/components/SenseCanvas";
import { GeoPrivacyPicker } from "@/src/components/GeoPrivacyPicker";
import { MusicPicker } from "@/src/components/MusicPicker";
import { getObservation, observationCode, Observation } from "@/src/lib/gallery";
import { socialApi } from "@/src/lib/backend";
import type { GeoPrecision } from "@/src/lib/backend";
import { publishErrorMessage } from "@/src/lib/publishError";
import { ApiError } from "@/src/lib/client";
import { loadSenseImage } from "@/src/lib/imageUpload";
import { enqueuePublish } from "@/src/lib/pendingPublish";
import { useAuth } from "@/src/context/AuthContext";
import { assessPrivacy, recordPlace } from "@/src/lib/placeHistory";
import { communityApi, DiscoverPerson } from "@/src/lib/community";
import { MusicRef } from "@/src/lib/music";
import { VoiceRecorder, VoiceRef } from "@/src/components/Voice";
import { SenseEditor } from "@/src/components/SenseEditor";
import { pulseForNow } from "@/src/lib/pulseTasks";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

export default function PublishComposer() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [obs, setObs] = useState<Observation | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [music, setMusic] = useState<MusicRef | null>(null);
  const [voice, setVoice] = useState<VoiceRef | null>(null);
  const [editedUri, setEditedUri] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [place, setPlace] = useState<string | null>(null);
  const [geoPrec, setGeoPrec] = useState<GeoPrecision>("exact");
  const [geoSuggest, setGeoSuggest] = useState<GeoPrecision | null>(null);
  const [geoReason, setGeoReason] = useState<string | null>(null);
  const [people, setPeople] = useState<DiscoverPerson[]>([]);
  const [tagged, setTagged] = useState<{ id: string; nickname: string }[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [asPulse, setAsPulse] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubState, setPubState] = useState<"idle" | "uploading" | "error" | "queued">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (id) getObservation(id).then(setObs); }, [id]);

  useEffect(() => {
    const lat = obs?.data?.lat, lon = obs?.data?.lon;
    if (lat == null || lon == null) return;
    assessPrivacy(lat, lon).then((a) => {
      if (a.suggested) { setGeoSuggest(a.suggested); setGeoReason(a.reason); setGeoPrec(a.suggested); }
      recordPlace(lat, lon);
    }).catch(() => {});
    Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
      .then((r) => { const p = r[0]; if (p) setPlace([p.city || p.subregion, p.region, p.country].filter(Boolean).join(", ")); })
      .catch(() => {});
    if (obs?.data?.pulse) setAsPulse(true);
  }, [obs]);

  const openPeople = useCallback(async () => {
    setPeopleOpen(true);
    if (people.length === 0) { try { setPeople((await communityApi.discover(30)).items); } catch { /* offline */ } }
  }, [people.length]);

  const toggleTag = (p: DiscoverPerson) => {
    Haptics.selectionAsync();
    setTagged((prev) => prev.some((t) => t.id === p.id)
      ? prev.filter((t) => t.id !== p.id)
      : [...prev, { id: p.id, nickname: p.nickname }]);
  };

  const parseTags = () => {
    const inline = (desc.match(/#[\p{L}0-9_]+/gu) || []).map((h) => h.slice(1));
    const manual = tagsText.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean);
    return Array.from(new Set([...inline, ...manual]));
  };

  const publish = async () => {
    if (!obs || !obs.data || !user) { if (!user) router.push("/login" as never); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPublishing(true); setErr(null); setPubState("uploading");

    // 1) Read the image that is ALREADY in the Gallery. A displayable Sense is
    // readable — if it isn't, we surface the concrete reason (no silent queue).
    const src = editedUri || obs.uri;
    const loaded = await loadSenseImage(src);
    if ("error" in loaded) {
      setErr(`Impossibile leggere l'immagine dalla Galleria.\nDettaglio tecnico: ${loaded.error}`);
      setPubState("error"); setPublishing(false);
      return;
    }

    let pulseTask = obs.data.pulse;
    if (asPulse && !pulseTask) {
      const t = pulseForNow();
      pulseTask = { id: t.id, title: t.title, theme: t.theme, prompt: t.prompt };
    }
    const data = { ...obs.data, geoPrecision: geoPrec, senseCode: observationCode(obs.seq, user.author_code) };
    const payload = {
      media_type: "image", source: "reality",
      title: title.trim() || undefined,
      description: desc.trim(),
      hashtags: parseTags(),
      music: music ? { ...music } : undefined,
      tagged_users: tagged,
      voice: voice ? { media_id: voice.media_id, duration: voice.duration } : undefined,
      image_base64: loaded.base64,
      data,
      is_pulse: asPulse || !!obs.data.pulse,
      pulse_task: asPulse || obs.data.pulse ? pulseTask : undefined,
    };

    // 2) Publish immediately. Success is defined as the record existing on Observe.
    try {
      const created = await socialApi.createObservation(payload);
      setPubState("idle"); setPublishing(false);
      router.replace(`/observation-detail?id=${created.id}` as never);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 422)) {
        // Bad data / moderation → explicit reason, user can fix & retry.
        setErr(publishErrorMessage(e)); setPubState("error"); setPublishing(false);
        return;
      }
      // Genuine network/server outage → save to queue AND show a real, actionable
      // state (retryable), never a silent promise.
      await enqueuePublish(payload, { imageUri: src });
      setErr("Rete o server non disponibili adesso. La Sense è al sicuro in coda — premi «Riprova» per pubblicare ora.");
      setPubState("queued"); setPublishing(false);
    }
  };

  if (!obs) {
    return <SpaceBackground><View style={styles.center}><ActivityIndicator color={colors.brand} /></View></SpaceBackground>;
  }

  const previewW = width - spacing.lg * 2;

  return (
    <SpaceBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <Pressable testID="composer-back" hitSlop={10} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.hTitle}>Nuovo SenseShot</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120, gap: spacing.lg }}>
          {/* Photo */}
          <View style={[styles.preview, { width: previewW, height: previewW * 1.1 }]}>
            {editedUri ? (
              <Image source={{ uri: editedUri }} style={{ width: previewW, height: previewW * 1.1 }} contentFit="cover" />
            ) : (
              <SenseCanvas uri={obs.uri} width={previewW} height={previewW * 1.1} layer={layerToVisual(obs.data?.senseLayer)} />
            )}
            <Pressable testID="composer-edit" style={styles.editBtn} onPress={() => setEditorOpen(true)}>
              <Ionicons name="brush" size={15} color="#fff" />
              <Text style={styles.editBtnText}>{editedUri ? "Modifica creatività" : "Aggiungi testo"}</Text>
            </Pressable>
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Titolo <Text style={styles.opt}>facoltativo</Text></Text>
            <TextInput testID="composer-title" style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Dai un titolo alla tua osservazione" placeholderTextColor={colors.onSurfaceSecondary} maxLength={120} />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Descrizione</Text>
            <TextInput testID="composer-desc" style={[styles.input, styles.multiline]} value={desc} onChangeText={setDesc}
              placeholder="Racconta cosa hai osservato…  usa #hashtag" placeholderTextColor={colors.onSurfaceSecondary}
              multiline maxLength={500} />
            <TextInput testID="composer-tags" style={styles.input} value={tagsText} onChangeText={setTagsText}
              placeholder="Scrivi le parole: diventano hashtag automaticamente" placeholderTextColor={colors.onSurfaceSecondary} autoCapitalize="none" />
            {parseTags().length > 0 ? (
              <View style={styles.tagPreview}>
                {parseTags().map((t) => (
                  <View key={t} style={styles.hashChip}><Text style={styles.hashChipText}>#{t}</Text></View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Music */}
          <View style={styles.field}>
            <Text style={styles.label}>🎵 Musica</Text>
            {music ? (
              <View style={styles.musicCard}>
                {music.cover_url ? <Image source={{ uri: music.cover_url }} style={styles.musicCover} contentFit="cover" /> : <View style={[styles.musicCover, styles.coverEmpty]}><Ionicons name="musical-notes" size={18} color={colors.brand} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.musicTitle} numberOfLines={1}>{music.title}</Text>
                  <Text style={styles.musicArtist} numberOfLines={1}>{music.artist} · {music.duration}s da {Math.floor(music.start)}s</Text>
                </View>
                <Pressable testID="music-change" hitSlop={8} onPress={() => setMusicOpen(true)}><Ionicons name="swap-horizontal" size={20} color={colors.brand} /></Pressable>
                <Pressable testID="music-remove" hitSlop={8} onPress={() => { Haptics.selectionAsync(); setMusic(null); }}><Ionicons name="close-circle" size={20} color={colors.onSurfaceSecondary} /></Pressable>
              </View>
            ) : (
              <Pressable testID="music-add" style={styles.addBtn} onPress={() => setMusicOpen(true)}>
                <Ionicons name="musical-notes" size={18} color={colors.brand} />
                <Text style={styles.addText}>Aggiungi musica</Text>
              </Pressable>
            )}
          </View>

          {/* Voice message */}
          <View style={styles.field}>
            <Text style={styles.label}>🎙 Messaggio vocale <Text style={styles.opt}>facoltativo</Text></Text>
            <Text style={styles.place}>Racconta a voce cosa hai osservato — chi guarda ascolterà la tua spiegazione.</Text>
            <VoiceRecorder value={voice} onChange={setVoice} />
          </View>

          {/* Location */}
          <View style={styles.field}>
            <Text style={styles.label}>📍 Posizione</Text>
            {obs.data?.lat != null ? (
              <>
                <Text style={styles.place}>{place || "Posizione acquisita al momento dello scatto"}</Text>
                <GeoPrivacyPicker value={geoPrec} onChange={setGeoPrec} suggested={geoSuggest} reason={geoReason} />
              </>
            ) : <Text style={styles.place}>Nessuna posizione registrata per questo scatto.</Text>}
          </View>

          {/* Tag people */}
          <View style={styles.field}>
            <Text style={styles.label}>🏷 Tag persone</Text>
            {tagged.length > 0 ? (
              <View style={styles.tagWrap}>
                {tagged.map((t) => (
                  <Pressable key={t.id} style={styles.tagChip} onPress={() => setTagged((p) => p.filter((x) => x.id !== t.id))}>
                    <Text style={styles.tagChipText}>@{t.nickname}</Text>
                    <Ionicons name="close" size={13} color={colors.onBrand} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable testID="tag-add" style={styles.addBtn} onPress={openPeople}>
              <Ionicons name="person-add" size={18} color={colors.brand} />
              <Text style={styles.addText}>{tagged.length ? "Modifica persone" : "Tagga persone"}</Text>
            </Pressable>
          </View>

          {/* Pulse toggle */}
          <Pressable testID="composer-pulse" style={styles.pulseRow} onPress={() => { Haptics.selectionAsync(); setAsPulse((v) => !v); }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>🔥 Condividi anche come Pulse</Text>
              <Text style={styles.place}>Partecipa alla sfida osservativa del momento.</Text>
            </View>
            <View style={[styles.switch, asPulse && styles.switchOn]}><View style={[styles.knob, asPulse && styles.knobOn]} /></View>
          </Pressable>

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
              <Text style={styles.err}>{err}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Publish */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {pubState === "uploading" ? (
            <Text style={styles.pubStatus}>Pubblicazione in corso…</Text>
          ) : null}
          <Pressable testID="composer-publish" style={[styles.publish, publishing && { opacity: 0.6 }]} disabled={publishing} onPress={publish}>
            {publishing ? <ActivityIndicator color={colors.onBrand} /> : <>
              <Ionicons name={pubState === "error" || pubState === "queued" ? "refresh" : "planet"} size={18} color={colors.onBrand} />
              <Text style={styles.publishText}>{pubState === "error" || pubState === "queued" ? "Riprova a pubblicare" : "Pubblica SenseShot"}</Text>
            </>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onSelect={setMusic} />

      {editorOpen ? (
        <SenseEditor uri={editedUri || obs.uri} place={place}
          onCancel={() => setEditorOpen(false)}
          onDone={(u) => { setEditedUri(u); setEditorOpen(false); }} />
      ) : null}

      {/* People picker */}
      {peopleOpen ? (
        <View style={styles.peopleSheet}>
          <View style={[styles.peopleInner, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.peopleHead}>
              <Text style={styles.hTitle}>Tagga persone</Text>
              <Pressable testID="people-done" hitSlop={10} onPress={() => setPeopleOpen(false)}><Text style={styles.done}>Fatto</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 6 }}>
              {people.length === 0 ? <Text style={styles.place}>Nessuna persona suggerita al momento.</Text> : null}
              {people.map((p) => {
                const on = tagged.some((t) => t.id === p.id);
                return (
                  <Pressable key={p.id} testID={`person-${p.id}`} style={[styles.person, on && styles.personOn]} onPress={() => toggleTag(p)}>
                    {p.avatar ? <Image source={{ uri: p.avatar }} style={styles.pAvatar} /> : <View style={[styles.pAvatar, styles.coverEmpty]}><Ionicons name="person" size={16} color={colors.brand} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>@{p.nickname}</Text>
                      <Text style={styles.musicArtist} numberOfLines={1}>{p.reason}</Text>
                    </View>
                    <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? colors.brand : colors.onSurfaceSecondary} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  hTitle: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.lg },
  preview: { borderRadius: radius.lg, overflow: "hidden", alignSelf: "center", backgroundColor: colors.surfaceSecondary },
  editBtn: { position: "absolute", bottom: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.6)" },
  editBtnText: { color: "#fff", fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  field: { gap: spacing.sm },
  label: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  opt: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  addText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  musicCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  musicCover: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surfaceTertiary },
  coverEmpty: { alignItems: "center", justifyContent: "center" },
  musicTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  musicArtist: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  place: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  tagChipText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  pulseRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  switch: { width: 46, height: 28, borderRadius: 999, backgroundColor: colors.surfaceTertiary, padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: colors.brand },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
  err: { color: "#FF6B6B", fontFamily: fonts.medium, fontSize: type.sm, flex: 1, lineHeight: 18 },
  tagPreview: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  hashChip: { backgroundColor: "rgba(212,175,55,0.12)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  hashChipText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  errBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(255,107,107,0.10)", borderRadius: radius.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,107,107,0.5)" },
  pubStatus: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, textAlign: "center", marginBottom: spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: "rgba(6,8,12,0.85)", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  publish: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: 15 },
  publishText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base, letterSpacing: 0.4 },
  peopleSheet: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  peopleInner: { maxHeight: "72%", backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  peopleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  done: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  personOn: { borderColor: colors.brand },
  pAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary },
  itemTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
});
