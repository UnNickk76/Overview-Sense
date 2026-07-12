import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { SpaceBackground } from "@/src/components/SpaceBackground";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { GlassCard } from "@/src/components/GlassCard";
import { StatCard } from "@/src/components/StatCard";
import { colors, fonts, spacing, type } from "@/src/theme";
import { useObserver, useNow } from "@/src/hooks/useObserver";
import { useMagnetometer } from "@/src/hooks/useSensors";
import { api, Weather, SpaceWeather, ISS } from "@/src/lib/api";
import { nf, compassPoint, fmtTime } from "@/src/lib/format";
import {
  dayNumber, sun, moon, moonPhase, toHorizontal, sunTimes,
  earthOrbitalSpeedKmh, earthRotationSpeedKmh, sunLightMinutes, AU_KM, EARTH_RADIUS_KM,
} from "@/src/lib/astronomy";

export default function QuiEOra() {
  const insets = useSafeAreaInsets();
  const obs = useObserver();
  const now = useNow(1000);
  const mag = useMagnetometer(obs.status === "granted");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [space, setSpace] = useState<SpaceWeather | null>(null);
  const [iss, setIss] = useState<ISS | null>(null);
  const [narrIdx, setNarrIdx] = useState(0);

  useEffect(() => {
    if (obs.status !== "granted") return;
    api.weather(obs.lat, obs.lon).then(setWeather).catch(() => {});
    api.spaceWeather().then(setSpace).catch(() => {});
    api.iss().then(setIss).catch(() => {});
  }, [obs.status, obs.lat, obs.lon]);

  const sky = useMemo(() => {
    const d = dayNumber(now);
    const s = sun(d);
    const m = moon(d);
    const ph = moonPhase(d);
    const sunHz = toHorizontal(s.ra, s.dec, obs.lat, obs.lon, d);
    const moonHz = toHorizontal(m.ra, m.dec, obs.lat, obs.lon, d);
    return {
      orbitalSpeed: earthOrbitalSpeedKmh(s.dist),
      rotationSpeed: earthRotationSpeedKmh(obs.lat),
      sunDistKm: s.dist * AU_KM,
      lightMin: sunLightMinutes(s.dist),
      moonDistKm: m.dist * EARTH_RADIUS_KM,
      phase: ph,
      sunHz, moonHz,
    };
  }, [now, obs.lat, obs.lon]);

  const times = useMemo(
    () => sunTimes(now, obs.lat, obs.lon),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), obs.lat, obs.lon],
  );

  const narratives = useMemo(() => {
    const list: string[] = [
      `In questo momento stai viaggiando nello spazio a circa ${nf(sky.orbitalSpeed, 0)} km/h insieme alla Terra, lungo la sua orbita attorno al Sole.`,
      `La luce del Sole che ti raggiunge ora è partita circa ${nf(sky.lightMin, 1)} minuti fa, dopo un viaggio di ${nf(sky.sunDistKm / 1e6, 1)} milioni di km.`,
      `La rotazione terrestre ti trascina verso est a circa ${nf(sky.rotationSpeed, 0)} km/h, alla tua latitudine.`,
      `In questo istante miliardi di neutrini provenienti dal Sole stanno attraversando il tuo corpo, quasi senza interagire.`,
      `La Luna è a circa ${nf(sky.moonDistKm, 0)} km da te — ${sky.phase.name.toLowerCase()}, illuminata al ${nf(sky.phase.illumination * 100, 0)}%.`,
      sky.sunHz.alt > 0
        ? `Il Sole è ${nf(sky.sunHz.alt, 0)}° sopra l'orizzonte, in direzione ${compassPoint(sky.sunHz.az)}.`
        : `Il Sole è sotto l'orizzonte: dall'altra parte del pianeta è giorno.`,
    ];
    return list;
  }, [sky]);

  useEffect(() => {
    const t = setInterval(() => setNarrIdx((i) => (i + 1) % narratives.length), 6000);
    return () => clearInterval(t);
  }, [narratives.length]);

  if (obs.status === "loading") {
    return (
      <SpaceBackground>
        <ScreenHeader title="Qui e Ora" />
        <View style={styles.center}><ActivityIndicator color={colors.brand} /><Text style={styles.dim}>Calibrazione sensori…</Text></View>
      </SpaceBackground>
    );
  }

  if (obs.status !== "granted") {
    return (
      <SpaceBackground>
        <ScreenHeader title="Qui e Ora" />
        <View style={styles.center}>
          <Text style={styles.permTitle}>Serve la posizione</Text>
          <Text style={styles.dim}>Overview usa la tua posizione per calcolare cielo, Sole e Luna reali attorno a te. Nessun dato viene inventato.</Text>
          {obs.status === "blocked" ? (
            <Pressable testID="open-settings-button" style={styles.cta} onPress={() => Linking.openSettings()}>
              <Text style={styles.ctaText}>Apri Impostazioni</Text>
            </Pressable>
          ) : (
            <Pressable testID="grant-location-button" style={styles.cta} onPress={obs.request}>
              <Text style={styles.ctaText}>Consenti posizione</Text>
            </Pressable>
          )}
        </View>
      </SpaceBackground>
    );
  }

  return (
    <SpaceBackground>
      <ScreenHeader title="Qui e Ora" subtitle={now.toLocaleTimeString()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing["2xl"], gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={narrIdx} entering={FadeIn.duration(700)}>
          <GlassCard testID="narrative-hero" style={styles.hero}>
            <Text style={styles.heroLabel}>ADESSO</Text>
            <Text style={styles.heroText}>{narratives[narrIdx]}</Text>
          </GlassCard>
        </Animated.View>

        <View style={styles.row}>
          <StatCard testID="stat-orbital" label="Velocità orbitale" value={nf(sky.orbitalSpeed, 0)} unit="km/h" icon="rocket" />
          <StatCard testID="stat-rotation" label="Rotazione (lat.)" value={nf(sky.rotationSpeed, 0)} unit="km/h" icon="sync" accent={colors.blue} />
        </View>
        <View style={styles.row}>
          <StatCard testID="stat-sun-dist" label="Distanza Sole" value={nf(sky.sunDistKm / 1e6, 2)} unit="M km" icon="sunny" note={`Luce: ${nf(sky.lightMin, 1)} min fa`} />
          <StatCard testID="stat-moon" label={`Luna ${sky.phase.emoji}`} value={`${nf(sky.phase.illumination * 100, 0)}%`} icon="moon" note={sky.phase.name} accent={colors.blue} />
        </View>
        <View style={styles.row}>
          <StatCard testID="stat-coords" label="Coordinate" value={`${nf(obs.lat, 3)}`} unit={`, ${nf(obs.lon, 3)}`} icon="location" />
          <StatCard testID="stat-altitude" label="Altitudine" value={obs.altitude != null ? nf(obs.altitude, 0) : "—"} unit="m" icon="triangle" accent={colors.blue} />
        </View>
        <View style={styles.row}>
          <StatCard testID="stat-magfield" label="Campo magnetico" value={nf(mag.magnitude, 1)} unit="µT" icon="magnet" note="dal magnetometro" />
          <StatCard testID="stat-sunpos" label="Sole" value={sky.sunHz.alt > 0 ? `${nf(sky.sunHz.alt, 0)}°` : "sotto"} note={`${compassPoint(sky.sunHz.az)} · alt/az`} icon="compass" accent={colors.blue} />
        </View>

        <GlassCard testID="daylight-card">
          <Text style={styles.sectionTitle}>Luce del giorno</Text>
          <View style={styles.timeRow}>
            <TimePill label="Alba" value={fmtTime(times.sunrise)} />
            <TimePill label="Tramonto" value={fmtTime(times.sunset)} />
            <TimePill label="Crepuscolo" value={fmtTime(times.dusk)} />
          </View>
        </GlassCard>

        <GlassCard testID="weather-card">
          <Text style={styles.sectionTitle}>Atmosfera · Open-Meteo</Text>
          {weather?.available ? (
            <View style={styles.metaGrid}>
              <Meta label="Temperatura" value={weather.temperature_c != null ? `${nf(weather.temperature_c, 1)} °C` : "n/d"} />
              <Meta label="Pressione" value={weather.pressure_hpa != null ? `${nf(weather.pressure_hpa, 0)} hPa` : "n/d"} />
              <Meta label="Umidità" value={weather.humidity_pct != null ? `${nf(weather.humidity_pct, 0)}%` : "n/d"} />
              <Meta label="AQI (US)" value={weather.air_quality?.us_aqi != null ? `${weather.air_quality.us_aqi}` : "n/d"} />
            </View>
          ) : (
            <Text style={styles.dim}>Dati atmosferici non disponibili in questo momento.</Text>
          )}
        </GlassCard>

        <GlassCard testID="geomagnetic-card">
          <Text style={styles.sectionTitle}>Attività geomagnetica · NOAA</Text>
          {space?.kp_index?.available ? (
            <View style={styles.metaGrid}>
              <Meta label="Indice Kp" value={`${space.kp_index.value}`} />
              <Meta label="Livello" value={space.kp_index.level ?? "—"} />
              <Meta label="Vento solare" value={space.solar_wind?.available ? `${nf(space.solar_wind.speed_kms!, 0)} km/s` : "n/d"} />
              <Meta label="Aurore" value={space.kp_index.aurora_chance ?? "—"} />
            </View>
          ) : (
            <Text style={styles.dim}>Dati geomagnetici non disponibili in questo momento.</Text>
          )}
        </GlassCard>

        {iss?.available ? (
          <GlassCard testID="iss-card">
            <Text style={styles.sectionTitle}>Stazione Spaziale (ISS)</Text>
            <Text style={styles.dim}>
              Ora sopra {nf(iss.latitude!, 1)}°, {nf(iss.longitude!, 1)}° · quota {nf(iss.altitude_km!, 0)} km · {nf(iss.velocity_kmh!, 0)} km/h
            </Text>
          </GlassCard>
        ) : null}

        <Text style={styles.disclaimer}>
          Valori astronomici calcolati (algoritmo di Schlyter). Meteo: Open-Meteo. Geomagnetismo: NOAA SWPC. Campo magnetico e altitudine: sensori del dispositivo.
        </Text>
      </ScrollView>
    </SpaceBackground>
  );
}

function TimePill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  dim: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.base, textAlign: "center", lineHeight: 21 },
  permTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.xl },
  cta: { backgroundColor: colors.brand, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999, marginTop: spacing.md },
  ctaText: { color: colors.onBrand, fontFamily: fonts.semibold, fontSize: type.base },
  hero: { paddingVertical: spacing.xl },
  heroLabel: { color: colors.brand, fontFamily: fonts.medium, fontSize: type.sm, letterSpacing: 2, marginBottom: spacing.sm },
  heroText: { color: colors.onSurface, fontFamily: fonts.regular, fontSize: type.xl, lineHeight: 30 },
  row: { flexDirection: "row", gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: type.lg, marginBottom: spacing.md },
  timeRow: { flexDirection: "row", gap: spacing.sm },
  pill: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 14, paddingVertical: spacing.md, alignItems: "center" },
  pillValue: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: type.lg },
  pillLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1, marginTop: 2 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap" },
  meta: { width: "50%", paddingVertical: spacing.sm },
  metaLabel: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 1 },
  metaValue: { color: colors.onSurface, fontFamily: fonts.monoMedium, fontSize: type.lg, marginTop: 2 },
  disclaimer: { color: colors.onSurfaceSecondary, fontFamily: fonts.regular, fontSize: type.sm - 2, lineHeight: 16, opacity: 0.6, marginTop: spacing.sm },
});
