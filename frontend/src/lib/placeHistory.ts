// On-device place history for Go There™ auto-protection. Never leaves the device:
// if the capture point matches somewhere the user visits often (home, work…),
// OverView suggests a broader sharing level. No server tracking whatsoever.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GeoPrecision } from "./backend";

const KEY = "overview_place_history";
const MAX = 400;

interface Pt { lat: number; lon: number; ts: number }

function meters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function read(): Promise<Pt[]> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

export async function recordPlace(lat: number, lon: number): Promise<void> {
  if (lat == null || lon == null) return;
  const hist = await read();
  hist.push({ lat, lon, ts: Date.now() });
  const trimmed = hist.slice(-MAX);
  try { await AsyncStorage.setItem(KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
}

export interface PrivacyAssessment {
  suggested: GeoPrecision | null;
  reason: string | null;
  count: number;
}

// Count past captures within ~180m; 3+ visits ⇒ likely a private/frequent place.
export async function assessPrivacy(lat: number, lon: number): Promise<PrivacyAssessment> {
  if (lat == null || lon == null) return { suggested: null, reason: null, count: 0 };
  const hist = await read();
  const count = hist.filter((p) => meters(lat, lon, p.lat, p.lon) <= 180).length;
  if (count >= 3) {
    return {
      suggested: "approx",
      reason: "Sembra un luogo che frequenti spesso (es. casa o lavoro). Per la tua sicurezza ti consigliamo “Area ampia” o “Approssimata”.",
      count,
    };
  }
  return { suggested: null, reason: null, count };
}
