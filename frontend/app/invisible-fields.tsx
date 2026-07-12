import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import Svg, { Circle, G, Line, Defs, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colors, fonts, radius, spacing, type } from "@/src/theme";
import { useMagnetometer, useHeading, useAccelerometer } from "@/src/hooks/useSensors";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { api, Weather, SpaceWeather } from "@/src/lib/api";
import { computeSky } from "@/src/lib/skyObjects";
import { satellitesOverhead, loadSatrecs, hasSatrecs } from "@/src/lib/satellites";
import { aiApi } from "@/src/lib/backend";
import { nf, compassPoint } from "@/src/lib/format";

const WEB = Platform.OS === "web";

export default function InvisibleFields() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const obs = useObserver();
  const now = useNow(2000);
  const mag = useMagnetometer(!WEB, 200);
  const heading = useHeading(!WEB, 150);
  const accel = useAccelerometer(!WEB, 300);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const [satCount, setSatCount] = useState(0);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    api.spaceWeather().then(setSpace).catch(() => {});
    if (!hasSatrecs()) {
      api.satellites().then((r) => { if (r.available && r.satellites?.length) loadSatrecs(r.satellites); }).catch(() => {});
    }
  }, []);
  useEffect(() => {
    if (obs.status === "granted") api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  const sky = useMemo(() => (obs.status === "granted" ? computeSky(now, obs.lat, obs.lon) : []), [now, obs.status, obs.lat, obs.lon]);
  const sun = sky.find((o) => o.kind === "sun");
  const moon = sky.find((o) => o.kind === "moon");
  useEffect(() => {
    if (obs.status === "granted" && hasSatrecs()) setSatCount(satellitesOverhead(now, obs.lat, obs.lon).length);
  }, [now, obs.status, obs.lat, obs.lon]);

  // Visualization parameters driven by REAL data
  const kp = space?.kp_index?.value ?? 0;
  const magMag = mag.magnitude; // µT
  const fieldIntensity = Math.min(1, magMag / 80);
  const hue = kp >= 5 ? colors.brand : kp >= 3 ? "#8FD0FF" : colors.blue;
  const rays = Math.max(6, Math.min(24, 6 + satCount));

  const rot = useSharedValue(0);
  const pulse = useSharedValue(1);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1.08, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [rot, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value + heading}deg` }, { scale: pulse.value }] }));

  const size = Math.min(width - spacing.lg * 2, 340);
  const cx = size / 2;

  const dataFields = useMemo(() => {
    const f: { label: string; value: string }[] = [];
    if (!WEB) {
      f.push({ label: "Campo magnetico", value: `${nf(magMag, 1)} µT` });
      f.push({ label: "Orientamento", value: `${nf(heading, 0)}° ${compassPoint(heading)}` });
      f.push({ label: "Inclinazione", value: `${nf(accel.x, 2)} / ${nf(accel.y, 2)} g` });
    }
    if (obs.status === "granted") {
      f.push({ label: "Coordinate", value: `${nf(obs.lat, 3)}°, ${nf(obs.lon, 3)}°` });
      if (obs.altitude != null) f.push({ label: "Altitudine", value: `${nf(obs.altitude, 0)} m` });
    }
    if (sun) f.push({ label: "Sole", value: sun.alt > 0 ? `${nf(sun.alt, 0)}° ${compassPoint(sun.az)}` : "sotto l'orizzonte" });
    if (moon) f.push({ label: "Luna", value: `${nf(moon.alt, 0)}° ${compassPoint(moon.az)} · ${moon.subtitle}` });
    f.push({ label: "Satelliti sopra di te", value: `${satCount}` });
    if (space?.kp_index?.available) f.push({ label: "Meteo spaziale (Kp)", value: `${nf(kp, 1)} · ${space.kp_index.level ?? ""}` });
    if (space?.solar_wind?.available) f.push({ label: "Vento solare", value: `${nf(space.solar_wind.speed_kms ?? 0, 0)} km/s` });
    if (weather?.available) {
      if (weather.temperature_c != null) f.push({ label: "Temperatura", value: `${nf(weather.temperature_c, 0)} °C` });
      if (weather.cloud_cover_pct != null) f.push({ label: "Copertura nuvolosa", value: `${nf(weather.cloud_cover_pct, 0)}%` });
      if (weather.air_quality?.us_aqi != null) f.push({ label: "Qualità aria (AQI)", value: `${weather.air_quality.us_aqi}` });
    }
    return f;
  }, [magMag, heading, accel, obs, sun, moon, satCount, space, weather, kp]);

  const explain = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiLoading(true);
    try { const r = await aiApi.explainVisualization(dataFields); setExplanation(r.text); }
    catch { setExplanation(null); } finally { setAiLoading(false); }
  };

  return (
    <SpaceBackground>
      <ScreenHeader title="Invisible Fields" subtitle="Visualizzazione di dati fisici reali" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.lg }} showsVerticalScrollIndicator={false} testID="invisible-fields">
        <Text style={styles.disclaimer}>
          Non è un&apos;aura né un fenomeno paranormale. È una resa grafica di dati fisici realmente misurabili
          (campo magnetico, orientamento, luce, Sole, Luna, satelliti, meteo spaziale). Sei libero di interpretarla come preferisci.
        </Text>

        <View style={[styles.vizWrap, { height: size }]}>
          <Animated.View style={[{ width: size, height: size }, ringStyle]}>
            <Svg width={size} height={size}>
              <Defs>
                <RadialGradient id="core" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={hue} stopOpacity={0.5 + fieldIntensity * 0.4} />
                  <Stop offset="100%" stopColor={hue} stopOpacity={0.03} />
                </RadialGradient>
              </Defs>
              <Circle cx={cx} cy={cx} r={cx * (0.55 + fieldIntensity * 0.35)} fill="url(#core)" />
              {[0.9, 0.72, 0.54, 0.36].map((k, i) => (
                <Circle key={i} cx={cx} cy={cx} r={cx * k} stroke={hue} strokeWidth={1} opacity={0.15 + fieldIntensity * 0.25} fill="none" />
              ))}
              <G>
                {Array.from({ length: rays }).map((_, i) => {
                  const a = (i / rays) * Math.PI * 2;
                  const inner = cx * 0.36;
                  const outer = cx * (0.6 + fieldIntensity * 0.35);
                  return (
                    <Line key={i} x1={cx + Math.cos(a) * inner} y1={cx + Math.sin(a) * inner}
                      x2={cx + Math.cos(a) * outer} y2={cx + Math.sin(a) * outer}
                      stroke={hue} strokeWidth={1} opacity={0.25} />
                  );
                })}
              </G>
            </Svg>
          </Animated.View>
          <View style={styles.coreLabel} pointerEvents="none">
            <Text style={styles.coreValue}>{WEB ? nf(kp, 1) : nf(magMag, 0)}</Text>
            <Text style={styles.coreUnit}>{WEB ? "Kp" : "µT"}</Text>
          </View>
        </View>

        {WEB ? (
          <Text style={styles.note}>Magnetometro e sensori di orientamento non sono disponibili in anteprima web. Apri l&apos;app su iPhone per la visualizzazione completa in tempo reale.</Text>
        ) : null}

        <Pressable testID="explain-viz" style={styles.explainBtn} onPress={explain} disabled={aiLoading}>
          <Ionicons name="sparkles" size={18} color={colors.onBrand} />
          <Text style={styles.explainText}>Explain This Visualization</Text>
        </Pressable>

        {aiLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : explanation ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.explanationCard}>
            <Text style={styles.explanationText}>{explanation}</Text>
          </Animated.View>
        ) : null}

        <Text style={styles.sectionTitle}>Dati che alimentano la visualizzazione</Text>
        <View style={styles.dataCard}>
          {dataFields.map((f, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{f.label}</Text>
              <Text style={styles.rowValue}>{f.value}</Text>
            </View>
          ))}
          {dataFields.length === 0 ? <Text style={styles.note}>Attiva la posizione e apri su dispositivo per raccogliere dati reali.</Text> : null}
        </View>
      </ScrollView>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  disclaimer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm, lineHeight: 18, opacity: 0.85 },
  vizWrap: { alignItems: "center", justifyContent: "center" },
  coreLabel: { position: "absolute", alignItems: "center" },
  coreValue: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: type["3xl"] },
  coreUnit: { color: colors.onSurfaceSecondary, fontFamily: fonts.mono, fontSize: type.sm },
  explainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: spacing.lg },
  explainText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.lg },
  explanationCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  explanationText: { color: colors.onSurfaceTertiary, fontFamily: fonts.regular, fontSize: type.base, lineHeight: 22 },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg },
  dataCard: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base },
  rowValue: { color: colors.onSurface, fontFamily: fonts.medium, fontSize: type.base, flexShrink: 1, textAlign: "right" },
  note: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, lineHeight: 17, opacity: 0.7, paddingVertical: spacing.md },
});
