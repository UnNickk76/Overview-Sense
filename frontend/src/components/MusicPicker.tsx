import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { musicApi, MusicTrack, MusicRef, MUSIC_MOODS, MUSIC_GENRES } from "@/src/lib/music";

interface Props { visible: boolean; onClose: () => void; onSelect: (ref: MusicRef) => void }

const CLIP_OPTIONS = [10, 15, 30];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function MusicPicker({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [items, setItems] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<MusicTrack | null>(null);
  const [start, setStart] = useState(0);
  const [clip, setClip] = useState(15);
  const [playing, setPlaying] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const stopT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPreview = useCallback(() => {
    if (stopT.current) { clearTimeout(stopT.current); stopT.current = null; }
    try { player.current?.pause(); } catch { /* ignore */ }
    setPlaying(false);
  }, []);

  const teardown = useCallback(() => {
    stopPreview();
    try { player.current?.remove(); } catch { /* ignore */ }
    player.current = null;
  }, [stopPreview]);

  useEffect(() => () => teardown(), [teardown]);
  useEffect(() => { if (!visible) teardown(); }, [visible, teardown]);

  const doSearch = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await musicApi.search({ q, genre, mood, limit: 30 });
      setItems(r.items);
      if (r.error || r.items.length === 0) setErr(r.error ? "Catalogo momentaneamente non disponibile." : "Nessun brano trovato.");
    } catch { setErr("Ricerca non riuscita. Riprova."); setItems([]); }
    finally { setLoading(false); }
  }, [q, genre, mood]);

  // Popular tracks on open.
  useEffect(() => { if (visible && items.length === 0) doSearch(); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (t: MusicTrack) => {
    Haptics.selectionAsync();
    stopPreview();
    setSel(t); setStart(0);
    setClip(Math.min(15, t.duration || 15));
  };

  const preview = async () => {
    if (!sel?.audio_url) return;
    if (playing) { stopPreview(); return; }
    try {
      teardown();
      const p = createAudioPlayer({ uri: sel.audio_url });
      player.current = p;
      p.seekTo(start);
      p.play();
      setPlaying(true);
      stopT.current = setTimeout(() => stopPreview(), clip * 1000);
    } catch { setErr("Anteprima non disponibile."); }
  };

  const confirm = () => {
    if (!sel) return;
    stopPreview();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect({
      provider: sel.provider, provider_track_id: sel.provider_track_id,
      title: sel.title, artist: sel.artist, cover_url: sel.cover_url,
      audio_url: sel.audio_url, license_url: sel.license_url,
      start, duration: clip,
    });
    onClose();
  };

  const maxStart = Math.max(0, (sel?.duration || 0) - clip);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Aggiungi musica</Text>
          <Pressable testID="music-close" hitSlop={10} onPress={() => { stopPreview(); onClose(); }}>
            <Ionicons name="close" size={26} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.onSurfaceSecondary} />
          <TextInput testID="music-search" style={styles.searchInput} placeholder="Titolo, artista, parola chiave…"
            placeholderTextColor={colors.onSurfaceSecondary} value={q} onChangeText={setQ}
            returnKeyType="search" onSubmitEditing={doSearch} />
          {q ? <Pressable hitSlop={8} onPress={() => setQ("")}><Ionicons name="close-circle" size={18} color={colors.onSurfaceSecondary} /></Pressable> : null}
        </View>

        <View style={{ maxHeight: 76 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {MUSIC_GENRES.map((g) => (
              <Pressable key={g} onPress={() => { setGenre(genre === g ? "" : g); }} style={[styles.chip, genre === g && styles.chipOn]}>
                <Text style={[styles.chipText, genre === g && { color: colors.onBrand }]}>{g}</Text>
              </Pressable>
            ))}
            {MUSIC_MOODS.map((m) => (
              <Pressable key={m} onPress={() => { setMood(mood === m ? "" : m); }} style={[styles.chip, mood === m && styles.chipOnBlue]}>
                <Text style={[styles.chipText, mood === m && { color: "#fff" }]}>{m}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <Pressable testID="music-do-search" style={styles.searchBtn} onPress={doSearch}>
          <Text style={styles.searchBtnText}>Cerca</Text>
        </Pressable>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: sel ? 220 : insets.bottom + 20, gap: 6 }}>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            {items.map((t) => {
              const on = sel?.id === t.id;
              return (
                <Pressable key={t.id} testID={`music-item-${t.provider_track_id}`} style={[styles.item, on && styles.itemOn]} onPress={() => pick(t)}>
                  {t.cover_url ? <Image source={{ uri: t.cover_url }} style={styles.cover} contentFit="cover" /> : <View style={[styles.cover, styles.coverEmpty]}><Ionicons name="musical-notes" size={18} color={colors.brand} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.itemArtist} numberOfLines={1}>{t.artist} · {fmt(t.duration)}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {sel ? (
          <View style={[styles.trim, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.trimHead}>
              <Text style={styles.trimTitle} numberOfLines={1}>{sel.title} — {sel.artist}</Text>
              <Pressable testID="music-preview" style={styles.playBtn} onPress={preview}>
                <Ionicons name={playing ? "pause" : "play"} size={18} color={colors.onBrand} />
                <Text style={styles.playText}>{playing ? "Stop" : "Anteprima"}</Text>
              </Pressable>
            </View>
            <Text style={styles.trimLabel}>Inizio: {fmt(start)}  ·  Durata: {clip}s</Text>
            {/* Start scrubber (tap segments) */}
            <View style={styles.scrub}>
              {Array.from({ length: 20 }).map((_, i) => {
                const pos = maxStart * (i / 19);
                const active = Math.abs(pos - start) <= maxStart / 38;
                return <Pressable key={i} style={styles.scrubCell} onPress={() => { Haptics.selectionAsync(); setStart(Math.round(pos)); stopPreview(); }}>
                  <View style={[styles.scrubBar, active && styles.scrubBarOn]} />
                </Pressable>;
              })}
            </View>
            <View style={styles.clipRow}>
              {CLIP_OPTIONS.filter((c) => c <= (sel.duration || 999)).map((c) => (
                <Pressable key={c} onPress={() => { setClip(c); setStart((s) => Math.min(s, Math.max(0, (sel.duration || 0) - c))); stopPreview(); }}
                  style={[styles.clipBtn, clip === c && styles.clipOn]}>
                  <Text style={[styles.clipText, clip === c && { color: colors.onBrand }]}>{c}s</Text>
                </Pressable>
              ))}
              <Pressable testID="music-confirm" style={styles.confirm} onPress={confirm}>
                <Ionicons name="checkmark" size={18} color={colors.onBrand} />
                <Text style={styles.confirmText}>Usa questo brano</Text>
              </Pressable>
            </View>
            <Text style={styles.license}>Musica Creative Commons via Jamendo · l&apos;attribuzione viene mostrata nel SenseShot.</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  title: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.base },
  chips: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { backgroundColor: colors.surfaceSecondary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipOnBlue: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  searchBtn: { alignSelf: "flex-start", backgroundColor: colors.surfaceTertiary, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 8, marginBottom: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  searchBtnText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm },
  center: { paddingVertical: spacing["2xl"], alignItems: "center" },
  err: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, textAlign: "center", paddingVertical: spacing.md },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  itemOn: { borderColor: colors.brand },
  cover: { width: 46, height: 46, borderRadius: 8, backgroundColor: colors.surfaceTertiary },
  coverEmpty: { alignItems: "center", justifyContent: "center" },
  itemTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  itemArtist: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 1 },
  trim: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  trimHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  trimTitle: { flex: 1, color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7 },
  playText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  trimLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm - 1 },
  scrub: { flexDirection: "row", alignItems: "center", height: 34, gap: 2 },
  scrubCell: { flex: 1, alignItems: "center", justifyContent: "center", height: 34 },
  scrubBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" },
  scrubBarOn: { height: 30, backgroundColor: colors.brand },
  clipRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  clipBtn: { backgroundColor: colors.surfaceTertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  clipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  clipText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm - 1 },
  confirm: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 10 },
  confirmText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.sm },
  license: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 3, lineHeight: 14 },
});
