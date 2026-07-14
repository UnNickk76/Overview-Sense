const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export interface ISS {
  available: boolean;
  latitude?: number;
  longitude?: number;
  altitude_km?: number;
  velocity_kmh?: number;
  visibility?: string;
}

export interface Weather {
  available: boolean;
  temperature_c?: number;
  humidity_pct?: number;
  pressure_hpa?: number;
  wind_kmh?: number;
  cloud_cover_pct?: number;
  air_quality?: { us_aqi?: number; pm2_5?: number; pm10?: number };
}

export interface SpaceWeather {
  source: string;
  updated: string;
  kp_index: { available: boolean; value: number | null; level: string | null; aurora_chance: string | null };
  solar_wind: { available: boolean; speed_kms?: number; density_pcm3?: number };
  imf: { available: boolean; bz_nt?: number; bt_nt?: number };
  solar_flare: { available: boolean; class?: string; time?: string };
  sunspots: { available: boolean; sunspot_number?: number; month?: string };
}

export const api = {
  iss: () => getJson<ISS>("/iss"),
  weather: (lat: number, lon: number) => getJson<Weather>(`/weather?lat=${lat}&lon=${lon}`),
  spaceWeather: () => getJson<SpaceWeather>("/space-weather"),
  satellites: () => getJson<{ available: boolean; satellites: { name: string; satelliteId: number; line1: string; line2: string }[] }>("/satellites"),
  chatUrl: () => `${BASE}/api/ai/chat`,
  history: (sid: string) => getJson<{ messages: { role: string; text: string }[] }>(`/ai/history/${sid}`),
  see: (image_base64: string, facts: string[]) => postJson<{ text: string }>("/ai/see", { image_base64, facts }),
  guideResolve: (query: string, lat?: number, lon?: number) =>
    postJson<{ domain: string; name: string; sky_key: string; lat?: number; lon?: number; elevation_m?: number; note: string }>(
      "/ai/guide/resolve", { query, lat, lon }),
  guideTranscribe: (audio_base64: string, mime?: string) =>
    postJson<{ text: string }>("/ai/guide/transcribe", { audio_base64, mime }),
};

export { BASE };
