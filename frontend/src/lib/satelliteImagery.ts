// NASA GIBS / Worldview satellite imagery — real public Earth-observation data.
// Uses the EarthData Worldview Snapshots API (public, no key) to fetch a single
// composited image for a bbox + date + layer.

export interface GibsLayer {
  id: string;         // layer identifier
  label: string;
  desc: string;
  emoji: string;
  kind?: "gibs" | "sentinel2" | "osm";  // imagery source (default gibs)
}

export const GIBS_LAYERS: GibsLayer[] = [
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", label: "True Color", emoji: "🌍", desc: "Colori reali di superficie, nubi e mari (MODIS Terra).", kind: "gibs" },
  { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", label: "True Color HD", emoji: "🛰️", desc: "Colori reali ad alta risoluzione (VIIRS SNPP).", kind: "gibs" },
  { id: "s2cloudless-2023", label: "Satellite HD", emoji: "🔭", desc: "Mosaico Sentinel-2 senza nubi (~10 m/px, EOX cloudless). Ideale per paesaggi, montagne, coste, campi.", kind: "sentinel2" },
  { id: "OSM-WMS", label: "Mappa", emoji: "🗺️", desc: "Mappa stradale OpenStreetMap per orientarti da vicino (dati liberi).", kind: "osm" },
  { id: "MODIS_Terra_CorrectedReflectance_Bands721", label: "False Color", emoji: "🔥", desc: "Bande 7-2-1: evidenzia incendi, vegetazione bruciata e neve.", kind: "gibs" },
  { id: "MODIS_Terra_Land_Surface_Temp_Day", label: "Termico", emoji: "🌡️", desc: "Temperatura della superficie terrestre di giorno.", kind: "gibs" },
  { id: "MODIS_Terra_NDVI_8Day", label: "Vegetazione", emoji: "🌱", desc: "Indice NDVI: densità e salute della vegetazione.", kind: "gibs" },
  { id: "VIIRS_SNPP_DayNightBand_ENCC", label: "Luci notturne", emoji: "🌃", desc: "Luci artificiali notturne (VIIRS Day/Night Band).", kind: "gibs" },
  { id: "MODIS_Terra_Aerosol", label: "Aerosol", emoji: "🌫️", desc: "Spessore ottico degli aerosol: polveri, foschia e inquinamento in atmosfera.", kind: "gibs" },
  { id: "MODIS_Terra_Cloud_Fraction_Day", label: "Nuvole", emoji: "☁️", desc: "Frazione di copertura nuvolosa diurna (MODIS Terra).", kind: "gibs" },
  { id: "GHRSST_L4_MUR_Sea_Surface_Temperature", label: "Temperatura mare", emoji: "🌊", desc: "Temperatura della superficie del mare (GHRSST MUR).", kind: "gibs" },
];

const SNAPSHOT = "https://wvs.earthdata.nasa.gov/api/v1/snapshot";
// Free WMS sources for close-up detail (both single-image GetMap, no API key).
const EOX_WMS = "https://tiles.maps.eox.at/wms";           // Sentinel-2 cloudless (CC-BY)
const OSM_WMS = "https://ows.terrestris.de/osm/service";   // OpenStreetMap rendered

function bboxDeg(lat: number, lon: number, delta: number) {
  return {
    south: Math.max(-90, lat - delta),
    north: Math.min(90, lat + delta),
    west: Math.max(-180, lon - delta),
    east: Math.min(180, lon + delta),
  };
}

// Build a snapshot URL for a location, date and NASA GIBS layer.
export function gibsSnapshotUrl(lat: number, lon: number, dateISO: string, layerId: string, delta = 3, size = 640): string {
  const b = bboxDeg(lat, lon, delta);
  const params = new URLSearchParams({
    REQUEST: "GetSnapshot",
    TIME: dateISO,
    BBOX: `${b.south},${b.west},${b.north},${b.east}`,
    CRS: "EPSG:4326",
    LAYERS: layerId,
    WRAP: "day",
    FORMAT: "image/jpeg",
    WIDTH: String(size),
    HEIGHT: String(size),
  });
  return `${SNAPSHOT}?${params.toString()}`;
}

function wmsGetMap(base: string, layerId: string, lat: number, lon: number, delta: number, size: number, fmt: string): string {
  const b = bboxDeg(lat, lon, delta);
  const params = new URLSearchParams({
    service: "WMS", version: "1.1.1", request: "GetMap",
    layers: layerId, styles: "",
    // WMS 1.1.1 EPSG:4326 bbox order: minx,miny,maxx,maxy = west,south,east,north
    bbox: `${b.west},${b.south},${b.east},${b.north}`,
    srs: "EPSG:4326", width: String(size), height: String(size), format: fmt,
  });
  return `${base}?${params.toString()}`;
}

// Unified URL builder — picks the right free source for the chosen layer.
export function layerImageUrl(layer: GibsLayer, lat: number, lon: number, dateISO: string, delta = 3, size = 640): string {
  if (layer.kind === "sentinel2") return wmsGetMap(EOX_WMS, layer.id, lat, lon, delta, size, "image/jpeg");
  if (layer.kind === "osm") return wmsGetMap(OSM_WMS, layer.id, lat, lon, delta, size, "image/png");
  return gibsSnapshotUrl(lat, lon, dateISO, layer.id, delta, size);
}

// Imagery has latency; default to a few days ago.
export function defaultImageryDate(daysAgo = 3): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
