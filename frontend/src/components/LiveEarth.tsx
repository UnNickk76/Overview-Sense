import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Modal, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Circle, G, Text as SvgText } from "react-native-svg";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { eventsApi, LiveEarthPoint, mediaUrl } from "@/src/lib/backend";
import { CITIES } from "@/src/lib/cities";
import { GlobeBase, GlobeCtx, GlobeHandle } from "@/src/components/GlobeBase";

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Aurore: "sparkles", ISS: "earth", "Via Lattea": "planet", Pianeti: "planet",
  Luna: "moon", Sole: "sunny", Costellazioni: "star", Satelliti: "radio",
  "Campo magnetico": "magnet", Meteo: "cloud", Atmosfera: "cloud",
  "Satellite Intelligence": "globe", "Listening Layer": "musical-notes",
};

interface Props { size?: number; onInteracting?: (active: boolean) => void; variant?: "full" | "compact"; onExpand?: () => void }

/**
 * Observe → Live Earth. Uses the SHARED GlobeBase for the sphere, continents,
 * rotation, drag & zoom. Observe only layers its own content on top via
 * `overlay`: geolocated observation pulses and (when zoomed) city labels.
 */
export function LiveEarth({ size = 260, onInteracting, variant = "full", onExpand }: Props) {
  const router = useRouter();
  const compact = variant === "compact";
  const onExpandRef = useRef(onExpand);
  onExpandRef.current = onExpand;

  const [points, setPoints] = useState<LiveEarthPoint[]>([]);
  const [meta, setMeta] = useState({ recent: 0, geo: 0, hours: 24 });
  const [listOpen, setListOpen] = useState(false);
  const [listItems, setListItems] = useState<LiveEarthPoint[]>([]);

  const globe = useRef<GlobeHandle>(null);
  const dotsRef = useRef<{ pt: LiveEarthPoint; sx: number; sy: number }[]>([]);
  const mounted = useRef(true);

  // ---- live data ----
  useEffect(() => {
    mounted.current = true;
    const fetchPoints = () => {
      eventsApi.liveEarth().then((r) => {
        if (!mounted.current) return;
        setPoints(r.points);
        setMeta({ recent: r.total_recent, geo: r.total_geolocated, hours: r.window_hours });
      }).catch(() => {});
    };
    fetchPoints();
    const dataTimer = setInterval(fetchPoints, 60000);
    return () => { mounted.current = false; clearInterval(dataTimer); };
  }, []);

  const openDetail = (id: string) => {
    setListOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/observation-detail?id=${id}` as never);
  };

  const handleDoubleTap = (x: number, y: number, ctx: GlobeCtx) => {
    if (compact) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onExpandRef.current?.(); return; }
    const thr = 30 + 6 * ctx.zoom;
    const hits = dotsRef.current
      .map((d) => ({ pt: d.pt, dist: Math.hypot(d.sx - x, d.sy - y) }))
      .filter((h) => h.dist < thr)
      .sort((a, b) => a.dist - b.dist);
    if (hits.length === 0) return;
    if (hits.length === 1) { openDetail(hits[0].pt.id); return; }
    // Overlapping cluster → open a tidy list to choose from.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListItems(hits.map((h) => h.pt));
    setListOpen(true);
  };

  const resetView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    globe.current?.reset();
  };

  // ---- Observe layer drawn on top of the shared globe ----
  const overlay = (ctx: GlobeCtx) => {
    const { proj, zoom, tick } = ctx;

    const cityMarks = zoom < 2.2 ? [] : CITIES.map((c) => {
      const p = proj(c.lat, c.lon);
      if (p.z < 0.05) return null;
      return { name: c.name, sx: p.sx, sy: p.sy };
    }).filter(Boolean) as { name: string; sx: number; sy: number }[];

    const phase = (tick % 16) / 16;
    const dots = points.map((pt) => {
      const p = proj(pt.lat, pt.lon);
      if (p.z < 0) return null;
      const edge = 0.35 + 0.65 * p.z;
      const color = pt.intensity >= 50 ? colors.brand : colors.blue;
      const pulse = 0.5 + 0.5 * Math.sin(phase * 2 * Math.PI + pt.lat);
      return { pt, sx: p.sx, sy: p.sy, color, edge, pulse };
    }).filter(Boolean) as { pt: LiveEarthPoint; sx: number; sy: number; color: string; edge: number; pulse: number }[];
    dotsRef.current = dots.map((o) => ({ pt: o.pt, sx: o.sx, sy: o.sy }));

    return (
      <G>
        {cityMarks.map((c, i) => (
          <G key={`city${i}`}>
            <Circle cx={c.sx} cy={c.sy} r={1.6} fill={colors.onSurfaceSecondary} opacity={0.8} />
            <SvgText x={c.sx + 4} y={c.sy + 3} fill={colors.onSurfaceSecondary} fontSize={8} opacity={0.85}>{c.name}</SvgText>
          </G>
        ))}
        {dots.map((o) => (
          <G key={o.pt.id}>
            <Circle cx={o.sx} cy={o.sy} r={4 + 3 * o.pulse} fill={o.color} opacity={0.18 * o.edge} />
            <Circle cx={o.sx} cy={o.sy} r={2.6} fill={o.color} opacity={0.95 * o.edge} />
          </G>
        ))}
      </G>
    );
  };

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      {!compact && (
        <View style={styles.header}>
          <Text style={styles.title}>🌍 Live Earth</Text>
          <Text style={styles.subtitle}>Il pianeta osservato in tempo reale</Text>
        </View>
      )}

      <View style={[styles.stage, { width: size, height: size }]}>
        <GlobeBase
          ref={globe}
          size={size}
          onInteracting={onInteracting}
          interactive={!compact}
          maxZoom={6}
          overlay={overlay}
          onDoubleTap={handleDoubleTap}
        />
      </View>

      {!compact && (<>
      <View style={styles.legendPill}>
        <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
        <Text style={styles.legendText}>{meta.geo} osservazioni geolocalizzate</Text>
      </View>
      <View style={styles.controls}>
        <Pressable testID="earth-list" style={styles.ctrlBtn} onPress={() => { setListItems(points); setListOpen(true); }}>
          <Ionicons name="list" size={16} color={colors.onSurface} />
          <Text style={styles.ctrlText}>Lista ({points.length})</Text>
        </Pressable>
        <Pressable testID="earth-reset" style={styles.ctrlBtn} onPress={resetView}>
          <Ionicons name="contract-outline" size={16} color={colors.onSurface} />
          <Text style={styles.ctrlText}>Reset zoom</Text>
        </Pressable>
      </View>
      <Text style={styles.legendSub}>Trascina per ruotare · pizzica per zoomare · doppio tap su un&apos;Observation</Text>

      <Modal visible={listOpen} transparent animationType="slide" onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setListOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Osservazioni · {listItems.length}</Text>
          {listItems.length === 0 ? (
            <Text style={styles.legendSub}>Nessuna osservazione geolocalizzata al momento.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 430 }} contentContainerStyle={{ paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
              {listItems.map((pt) => {
                const uri = mediaUrl(pt.image_url, "thumb");
                return (
                  <Pressable key={pt.id} testID={`list-${pt.id}`} style={styles.listRow} onPress={() => openDetail(pt.id)}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.listThumb} contentFit="cover" transition={120} />
                    ) : (
                      <View style={[styles.listThumb, styles.listThumbEmpty]}>
                        <Ionicons name={ICON[pt.category] ?? "planet"} size={22} color={colors.brand} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.listCatRow}>
                        <Ionicons name={ICON[pt.category] ?? "planet"} size={13} color={colors.brand} />
                        <Text style={styles.listCat}>{pt.category}</Text>
                      </View>
                      <Text style={styles.listMeta}>{pt.nickname ?? "—"} · SV {pt.intensity}</Text>
                      <Text style={styles.listCoord}>{pt.lat.toFixed(1)}°, {pt.lon.toFixed(1)}°</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <Pressable style={styles.sheetClose} onPress={() => setListOpen(false)}>
            <Text style={styles.sheetCloseText}>Chiudi</Text>
          </Pressable>
        </View>
      </Modal>
      </>)}
      {compact && <Text style={styles.compactHint}>Doppio tap per esplorare</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  wrapCompact: { alignItems: "center", gap: 2 },
  compactHint: { color: colors.onSurfaceTertiary, fontFamily: fonts.medium, fontSize: type.sm - 2, letterSpacing: 0.5 },
  header: { alignItems: "center", gap: 2 },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  subtitle: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  stage: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  ctrlBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ctrlText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm },
  legendPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm - 1 },
  legendSub: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, textAlign: "center", paddingHorizontal: spacing.lg },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing["2xl"], borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.md },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  listThumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.tertiary },
  listThumbEmpty: { alignItems: "center", justifyContent: "center" },
  listCatRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  listCat: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  listMeta: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm },
  listCoord: { color: colors.onSurfaceTertiary, fontFamily: fonts.mono, fontSize: type.sm - 2 },
  sheetClose: { alignItems: "center", paddingVertical: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
  sheetCloseText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base },
});
