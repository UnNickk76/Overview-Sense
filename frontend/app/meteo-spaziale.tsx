import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { GlassCard } from "@/src/components/GlassCard";
import { OpportunitiesSection } from "@/src/components/OpportunitiesSection";
import { colors, fonts, spacing, type } from "@/src/theme";
import { api, SpaceWeather } from "@/src/lib/api";
import { nf } from "@/src/lib/format";

function kpColor(v: number | null) {
  if (v == null) return colors.onSurfaceSecondary;
  if (v < 4) return colors.success;
  if (v < 6) return colors.warning;
  return colors.error;
}

export default function MeteoSpaziale() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<SpaceWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.spaceWeather();
      setData(d);
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const kp = data?.kp_index;

  return (
    <SpaceBackground>
      <ScreenHeader title="Meteo Spaziale" subtitle="NOAA SWPC · dati reali" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          <OpportunitiesSection layer="solar" />
          <GlassCard testID="kp-card" style={{ alignItems: "center", paddingVertical: spacing.xl }}>
            <Text style={styles.label}>ATTIVITÀ GEOMAGNETICA (Kp)</Text>
            {kp?.available ? (
              <>
                <Text style={[styles.kpValue, { color: kpColor(kp.value) }]}>{nf(kp.value ?? 0, 1)}</Text>
                <View style={[styles.badge, { borderColor: kpColor(kp.value) }]}>
                  <Text style={[styles.badgeText, { color: kpColor(kp.value) }]}>{kp.level}</Text>
                </View>
                <Text style={styles.auroraText}>Aurore: {kp.aurora_chance}</Text>
              </>
            ) : (
              <Text style={styles.na}>Indice Kp non disponibile</Text>
            )}
          </GlassCard>

          <View style={styles.row}>
            <Metric testID="solarwind-card" icon="speedometer" label="Vento solare"
              value={data?.solar_wind?.available ? nf(data.solar_wind.speed_kms!, 0) : "n/d"}
              unit={data?.solar_wind?.available ? "km/s" : ""}
              note={data?.solar_wind?.available ? `densità ${nf(data.solar_wind.density_pcm3!, 1)} p/cm³` : "non disponibile"} />
            <Metric testID="imf-card" icon="magnet" label="Campo IMF Bz"
              value={data?.imf?.available ? nf(data.imf.bz_nt!, 1) : "n/d"}
              unit={data?.imf?.available ? "nT" : ""}
              note={data?.imf?.available ? `Bt ${nf(data.imf.bt_nt!, 1)} nT` : "non disponibile"}
              accent={colors.blue} />
          </View>

          <View style={styles.row}>
            <Metric testID="flare-card" icon="flash" label="Ultimo flare X-ray"
              value={data?.solar_flare?.available ? (data.solar_flare.class ?? "—") : "quiete"}
              unit=""
              note={data?.solar_flare?.available ? "classe raggi X" : "nessuno rilevato"} />
            <Metric testID="sunspots-card" icon="sunny" label="Macchie solari"
              value={data?.sunspots?.available ? `${data.sunspots.sunspot_number}` : "n/d"}
              unit=""
              note={data?.sunspots?.available ? `${data.sunspots.month}` : "non disponibile"}
              accent={colors.blue} />
          </View>

          <GlassCard testID="explain-card">
            <Text style={styles.explainTitle}>Cosa significa</Text>
            <Text style={styles.explain}>
              {"Il vento solare — un flusso di particelle cariche dal Sole — colpisce il campo magnetico terrestre. Quando il campo IMF Bz è fortemente negativo e il vento è veloce, l'energia si accumula e l'indice Kp sale: è allora che le aurore scendono verso latitudini più basse."}
            </Text>
          </GlassCard>

          <Text style={styles.disclaimer}>
            Fonte: NOAA Space Weather Prediction Center. Aggiornato: {data?.updated ? new Date(data.updated).toLocaleTimeString() : "—"}. Tira giù per aggiornare.
          </Text>
        </ScrollView>
      )}
    </SpaceBackground>
  );
}

function Metric({ icon, label, value, unit, note, accent = colors.brand, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; unit: string; note: string; accent?: string; testID: string;
}) {
  return (
    <GlassCard testID={testID} style={{ flex: 1 }}>
      <View style={styles.metricTop}>
        <Ionicons name={icon} size={16} color={accent} />
        <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
        <Text style={styles.metricValue} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.metricNote}>{note}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 1 },
  kpValue: { fontFamily: fonts.mono, fontSize: 64, marginVertical: spacing.sm },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  badgeText: { fontFamily: fonts.semibold, fontSize: type.base },
  auroraText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, marginTop: spacing.md, textAlign: "center" },
  na: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.lg, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  metricTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm, minHeight: 34 },
  metricLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.medium, fontSize: type.sm, flex: 1 },
  metricValue: { color: colors.onSurface, fontFamily: fonts.mono, fontSize: type["2xl"] },
  metricUnit: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.base, marginBottom: 3 },
  metricNote: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: spacing.xs },
  explainTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.sm },
  explain: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  disclaimer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, lineHeight: 16, opacity: 0.6 },
});
