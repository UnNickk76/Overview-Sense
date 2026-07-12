// NASA GIBS / Worldview satellite imagery — real public Earth-observation data.
// Uses the EarthData Worldview Snapshots API (public, no key) to fetch a single
// composited image for a bbox + date + layer.

export interface GibsLayer {
  id: string;         // GIBS layer identifier
  label: string;
  desc: string;
  emoji: string;
}

export const GIBS_LAYERS: GibsLayer[] = [
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", label: "True Color", emoji: "🌍", desc: "Colori reali di superficie, nubi e mari (MODIS Terra)." },
  { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", label: "True Color HD", emoji: "🛰️", desc: "Colori reali ad alta risoluzione (VIIRS SNPP)." },
  { id: "MODIS_Terra_CorrectedReflectance_Bands721", label: "False Color", emoji: "🔥", desc: "Bande 7-2-1: evidenzia incendi, vegetazione bruciata e neve." },
  { id: "MODIS_Terra_Land_Surface_Temp_Day", label: "Termico", emoji: "🌡️", desc: "Temperatura della superficie terrestre di giorno." },
  { id: "MODIS_Terra_NDVI_8Day", label: "Vegetazione", emoji: "🌱", desc: "Indice NDVI: densità e salute della vegetazione." },
  { id: "VIIRS_SNPP_DayNightBand_ENCC", label: "Luci notturne", emoji: "🌃", desc: "Luci artificiali notturne (VIIRS Day/Night Band)." },
];

const SNAPSHOT = "https://wvs.earthdata.nasa.gov/api/v1/snapshot";

// Build a snapshot URL for a location, date and layer.
export function gibsSnapshotUrl(lat: number, lon: number, dateISO: string, layerId: string, delta = 3, size = 640): string {
  const south = Math.max(-90, lat - delta);
  const north = Math.min(90, lat + delta);
  const west = Math.max(-180, lon - delta);
  const east = Math.min(180, lon + delta);
  const bbox = `${south},${west},${north},${east}`;
  const params = new URLSearchParams({
    REQUEST: "GetSnapshot",
    TIME: dateISO,
    BBOX: bbox,
    CRS: "EPSG:4326",
    LAYERS: layerId,
    WRAP: "day",
    FORMAT: "image/jpeg",
    WIDTH: String(size),
    HEIGHT: String(size),
  });
  return `${SNAPSHOT}?${params.toString()}`;
}

// Imagery has latency; default to a few days ago.
export function defaultImageryDate(daysAgo = 3): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
