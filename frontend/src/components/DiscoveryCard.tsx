import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import { colors, fonts } from "@/src/theme";
import { nf, compassPoint } from "@/src/lib/format";
import { SenseMark } from "@/src/components/SenseMark";
import { SenseCanvas, SenseVisualLayer } from "@/src/components/SenseCanvas";
import type { Observation, ObsData } from "@/src/lib/gallery";

export type CardFormat = "square" | "story";

const WEB_BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

function buildLines(d: ObsData): { icon: string; value: string }[] {
  const out: { icon: string; value: string }[] = [];
  if (d.lat != null && d.lon != null) out.push({ icon: "📍", value: `${nf(d.lat, 2)}°, ${nf(d.lon, 2)}°` });
  if (d.cameraAz != null) out.push({ icon: "🧭", value: `${compassPoint(d.cameraAz)} ${nf(d.cameraAz, 0)}°` });
  if (d.sun) out.push({ icon: "☀️", value: `Sole ${nf(d.sun.alt, 0)}° alt` });
  if (d.moon) out.push({ icon: "🌙", value: `Luna ${d.moon.phase} · ${nf(d.moon.illum * 100, 0)}%` });
  if (d.weather?.temp != null) out.push({ icon: "🌡️", value: `${nf(d.weather.temp, 0)}°C` });
  if (d.spaceWeather?.kp != null) out.push({ icon: "☄️", value: `Kp ${nf(d.spaceWeather.kp, 1)} · meteo spaziale` });
  if (d.iss) out.push({ icon: "🛰️", value: "ISS in transito" });
  return out.slice(0, 5);
}

interface Props {
  obs: Observation;
  publishedId: string | null;
  visualLayer: SenseVisualLayer;
  format: CardFormat;
  width: number;
}

export function DiscoveryCard({ obs, publishedId, visualLayer, format, width }: Props) {
  const d = obs.data as ObsData;
  const height = format === "square" ? width : Math.round((width * 16) / 9);
  const qr = publishedId ? `${WEB_BASE}/observation-detail?id=${publishedId}` : (WEB_BASE || "overview");
  const lines = buildLines(d);
  const dateStr = new Date(d.ts).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.card, { width, height }]}>
      <SenseCanvas uri={obs.uri} width={width} height={height} layer={visualLayer} />
      <LinearGradient
        colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.94)"]}
        locations={[0, 0.28, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Brand header */}
      <View style={styles.top}>
        <SenseMark size={28} />
        <View>
          <Text style={styles.wordmark}>OverView</Text>
          <Text style={styles.tag}>THE INVISIBLE SENSE</Text>
        </View>
      </View>

      {/* Bottom data + QR */}
      <View style={styles.bottom}>
        <View style={styles.dataCol}>
          <Text style={styles.senseLabel}>{d.senseLayer ? `SENSE · ${d.senseLayer.toUpperCase()}` : "SENSE VISION"}</Text>
          {lines.map((l, i) => (
            <Text key={i} style={styles.line}>{l.icon}  {l.value}</Text>
          ))}
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <View style={styles.qrCol}>
          <View style={styles.qrBox}>
            <QRCode value={qr} size={68} color="#0A0A0A" backgroundColor="#FFFFFF" />
          </View>
          <Text style={styles.scan}>{publishedId ? "Osserva" : "overview"}</Text>
        </View>
      </View>

      <View style={styles.frame} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#0A0A0A", overflow: "hidden", borderRadius: 20 },
  top: { position: "absolute", top: 18, left: 18, right: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 1 },
  tag: { color: colors.brand, fontFamily: fonts.regular, fontSize: 9, letterSpacing: 2.5, marginTop: 1 },
  bottom: { position: "absolute", left: 18, right: 18, bottom: 18, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  dataCol: { flex: 1, gap: 3 },
  senseLabel: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.5, marginBottom: 4 },
  line: { color: "#F2F2F2", fontFamily: fonts.medium, fontSize: 13 },
  date: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.regular, fontSize: 11, marginTop: 6 },
  qrCol: { alignItems: "center", gap: 4 },
  qrBox: { padding: 5, backgroundColor: "#FFFFFF", borderRadius: 8 },
  scan: { color: "rgba(255,255,255,0.8)", fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1 },
  frame: { ...StyleSheet.absoluteFillObject, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(212,175,55,0.5)" },
});
