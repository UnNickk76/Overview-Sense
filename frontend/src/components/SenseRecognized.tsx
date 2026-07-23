import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable, Modal, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { ObsData } from "@/src/lib/gallery";
import { frameObjects, directionPhrase, statusPhrase, arrowRotation, FramedObject } from "@/src/lib/skyFraming";
import { FOV_H } from "@/src/lib/project";
import { celestialThumb } from "@/src/lib/liveThumbs";
import { colors, fonts, radius, spacing, type } from "@/src/theme";

interface Props {
  dd?: ObsData;
  camAz: number;
  camAlt: number;
  cardW: number;
  cardH: number;
  zoom?: number;
  hiddenObj: Set<string>;
  canEdit?: boolean;
  legendOn?: boolean;
  overlayOn?: boolean;
  saving?: boolean;
  onToggleObj?: (name: string) => void;
  onToggleNames?: () => void;
  onToggleOverlay?: () => void;
}

const kindIcon = (k: FramedObject["kind"]): keyof typeof Ionicons.glyphMap =>
  k === "Satellite" ? "hardware-chip" : k === "Luna" ? "moon" : k === "Sole" ? "sunny" : k === "Stella" ? "star" : k === "Luogo" ? "location" : "planet";

const sourceLine = (o: FramedObject) =>
  o.kind === "Luogo"
    ? "Fonte: OpenStreetMap · posizione, distanza ed elevazione reali"
    : o.kind === "Satellite"
    ? "Fonte: TLE NORAD · posizione calcolata da OverView™"
    : "Fonte: effemeridi · calcolata da OverView™ dai dati reali dello scatto";

export function SenseRecognized({ dd, camAz, camAlt, cardW, cardH, zoom = 1, hiddenObj, canEdit, legendOn, overlayOn, saving, onToggleObj, onToggleNames, onToggleOverlay }: Props) {
  const router = useRouter();
  const [nearOpen, setNearOpen] = useState(false);
  const [sel, setSel] = useState<FramedObject | null>(null);

  const { recognized, nearby } = useMemo(
    () => frameObjects(dd, camAz, camAlt, cardW, cardH, FOV_H / Math.max(1, zoom)),
    [dd, camAz, camAlt, cardW, cardH, zoom],
  );

  if (recognized.length === 0 && nearby.length === 0) return null;

  const visible = recognized.filter((o) => !hiddenObj.has(o.name)).length;

  return (
    <>
      {/* Riconosciuti — solo ciò che ricade realmente nell'inquadratura */}
      {recognized.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Riconosciuti · {visible}/{recognized.length}</Text>
            {canEdit ? (
              <View style={styles.headRight}>
                {saving ? <ActivityIndicator size="small" color={colors.brand} /> : null}
                <Pressable testID="legend-overlay-toggle" style={[styles.namesToggle, overlayOn && styles.namesToggleOn]} onPress={onToggleOverlay}>
                  <Ionicons name={overlayOn ? "eye" : "eye-off"} size={13} color={overlayOn ? colors.onBrand : colors.brand} />
                  <Text style={[styles.namesToggleText, overlayOn && { color: colors.onBrand }]}>Overlay</Text>
                </Pressable>
                <Pressable testID="legend-names-toggle" style={[styles.namesToggle, legendOn && styles.namesToggleOn, !overlayOn && styles.namesToggleDisabled]} onPress={overlayOn ? onToggleNames : undefined} disabled={!overlayOn}>
                  <Ionicons name={legendOn ? "pricetag" : "pricetag-outline"} size={13} color={legendOn ? colors.onBrand : colors.brand} />
                  <Text style={[styles.namesToggleText, legendOn && { color: colors.onBrand }]}>Nomi</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          {canEdit ? (
            <Text style={styles.hint}>Overlay = punti e linee · Nomi = etichette. Tocca l&apos;occhio di un oggetto per mostrarlo o nasconderlo sulla foto.</Text>
          ) : null}
          <View style={styles.chips}>
            {recognized.map((o) => {
              const shown = !hiddenObj.has(o.name);
              return (
                <View key={o.name} style={[styles.chip, shown && styles.chipOn]}>
                  {canEdit ? (
                    <Pressable testID={`legend-eye-${o.name}`} hitSlop={6} onPress={() => onToggleObj?.(o.name)}>
                      <Ionicons name={shown ? "eye" : "eye-off"} size={13} color={shown ? colors.brand : colors.onSurfaceSecondary} />
                    </Pressable>
                  ) : <Ionicons name={kindIcon(o.kind)} size={12} color={colors.brand} />}
                  <Pressable testID={`legend-${o.name}`} onPress={() => { Haptics.selectionAsync(); setSel(o); }}>
                    <Text style={[styles.chipText, shown && { color: colors.onSurface }]}>{o.label}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Nella tua direzione — elementi reali vicini al punto di vista, fuori dalla foto. Chiuso di default. */}
      {nearby.length > 0 ? (
        <View style={styles.card}>
          <Pressable testID="nearby-toggle" style={styles.head} onPress={() => { Haptics.selectionAsync(); setNearOpen((v) => !v); }}>
            <Text style={styles.title}>Nella tua direzione · {nearby.length}/{nearby.length}</Text>
            <Ionicons name={nearOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.onSurfaceSecondary} />
          </Pressable>
          {nearOpen ? (
            <>
              <Text style={styles.hint}>Erano reali attorno al tuo punto di vista, ma fuori dall&apos;inquadratura. Tocca per la direzione.</Text>
              <View style={styles.nearList}>
                {nearby.map((o) => (
                  <Pressable key={o.name} testID={`nearby-${o.name}`} style={styles.nearRow} onPress={() => { Haptics.selectionAsync(); setSel(o); }}>
                    <View style={styles.arrowBadge}>
                      <View style={{ transform: [{ rotate: `${arrowRotation(o)}deg` }] }}>
                        <Ionicons name="arrow-up" size={16} color={colors.brand} />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nearName}>{o.label}</Text>
                      <Text style={styles.nearSub} numberOfLines={1}>{o.alt < -0.5 ? "sotto l'orizzonte" : directionPhrase(o)} · {Math.round(o.sep)}° fuori</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceSecondary} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Scheda tecnica */}
      <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
        <Pressable style={styles.scrim} onPress={() => setSel(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {sel ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHead}>
                  {celestialThumb(sel.name, sel.name) ? (
                    <Image source={{ uri: celestialThumb(sel.name, sel.name) as string }} style={styles.thumb} contentFit="cover" />
                  ) : <View style={[styles.thumb, styles.thumbEmpty]}><Ionicons name={kindIcon(sel.kind)} size={28} color={colors.brand} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName}>{sel.label}</Text>
                    <Text style={styles.sheetKind}>{sel.kind}</Text>
                    <View style={[styles.statePill, sel.inFrame ? styles.statePillIn : styles.statePillOut]}>
                      <Text style={styles.statePillText}>{sel.inFrame ? "Dentro l'inquadratura" : `${Math.round(sel.sep)}° fuori dall'inquadratura`}</Text>
                    </View>
                  </View>
                </View>

                {!sel.inFrame ? (
                  <View style={styles.guideBox}>
                    <View style={styles.guideArrow}>
                      <View style={{ transform: [{ rotate: `${arrowRotation(sel)}deg` }] }}>
                        <Ionicons name="arrow-up" size={26} color={colors.onBrand} />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guideText}>{sel.alt < -0.5 ? "Sotto l'orizzonte" : directionPhrase(sel)}</Text>
                      <Text style={styles.guideStatus}>{statusPhrase(sel)}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.dataGrid}>
                  <Data label="Azimut" value={`${Math.round(sel.az)}°`} />
                  <Data label="Elevazione" value={`${Math.round(sel.alt)}°`} />
                  <Data label="Dist. angolare" value={`${Math.round(sel.sep)}°`} />
                  <Data label="Rispetto al centro" value={sel.inFrame ? "in campo" : directionPhrase(sel)} />
                </View>

                <Text style={styles.source}>{sourceLine(sel)}</Text>
                <Text style={styles.beyond}>OverView non inventa distanze o dettagli non disponibili.</Text>

                <View style={styles.actions}>
                  <Pressable testID="card-guide" style={styles.guideBtn} onPress={() => { setSel(null); router.push(`/overview-guide?q=${encodeURIComponent(sel.label)}` as never); }}>
                    <Ionicons name="navigate" size={16} color={colors.onBrand} />
                    <Text style={styles.guideBtnText}>Guidami</Text>
                  </Pressable>
                  <Pressable testID="card-open" style={styles.openBtn} onPress={() => { const r = sel.kind === "Satellite" ? "/satellite-explore" : "/universe-explorer"; setSel(null); router.push(r as never); }}>
                    <Ionicons name={sel.kind === "Satellite" ? "hardware-chip" : "planet"} size={16} color={colors.brand} />
                    <Text style={styles.openBtnText}>{sel.kind === "Satellite" ? "Satellite" : "Cielo"}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataCell}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  hint: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 4, lineHeight: 15 },
  namesToggle: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  namesToggleOn: { backgroundColor: colors.brand },
  namesToggleDisabled: { opacity: 0.4 },
  namesToggleText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.sm - 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { borderColor: colors.brand },
  chipText: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm },
  nearList: { marginTop: spacing.sm, gap: 6 },
  nearRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  arrowBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(212,175,55,0.15)", alignItems: "center", justifyContent: "center" },
  nearName: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.sm },
  nearSub: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginTop: 1 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { maxHeight: "82%", backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  sheetHead: { flexDirection: "row", gap: spacing.md, alignItems: "center", marginBottom: spacing.md },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceTertiary },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  sheetName: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type.xl },
  sheetKind: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, marginTop: 1 },
  statePill: { alignSelf: "flex-start", marginTop: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statePillIn: { backgroundColor: "rgba(52,199,89,0.18)" },
  statePillOut: { backgroundColor: colors.surfaceTertiary },
  statePillText: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.sm - 2 },
  guideBox: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  guideArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  guideText: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base },
  guideStatus: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, marginTop: 2 },
  dataGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  dataCell: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  dataLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2 },
  dataValue: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.base, marginTop: 2 },
  source: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginBottom: 4 },
  beyond: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.sm - 2, marginBottom: spacing.md },
  actions: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  guideBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 12 },
  guideBtnText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: type.base },
  openBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand },
  openBtnText: { color: colors.brand, fontFamily: fonts.semibold, fontSize: type.base },
});
