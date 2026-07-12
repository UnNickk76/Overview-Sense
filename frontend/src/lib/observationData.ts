import { computeSky } from "./skyObjects";
import { moonPhase, dayNumber } from "./astronomy";
import { STARS } from "./stars";
import { SatPos } from "./satellites";
import { Weather, SpaceWeather } from "./api";
import { ObsData } from "./gallery";

export function buildObservation(
  now: Date, lat: number, lon: number, altitude: number | null,
  cameraAz: number, cameraAlt: number,
  sats: SatPos[], weather: Weather | null, space: SpaceWeather | null,
): ObsData {
  const objs = computeSky(now, lat, lon);
  const sunO = objs.find((o) => o.kind === "sun");
  const moonO = objs.find((o) => o.kind === "moon");
  const gc = objs.find((o) => o.kind === "galcenter");
  const ph = moonPhase(dayNumber(now));
  const planets = objs.filter((o) => o.kind === "planet" && o.alt > 0).map((o) => ({ name: o.name, alt: o.alt, az: o.az }));
  const stars = objs.filter((o) => o.kind === "star" && o.alt > 0).map((o) => ({ name: o.name, alt: o.alt, az: o.az }));
  const satsUp = sats.filter((s) => s.alt > 0).map((s) => ({ name: s.name, alt: s.alt, az: s.az }));
  const iss = sats.find((s) => /ISS|ZARYA/i.test(s.name) && s.alt > 0);
  const consts = Array.from(new Set(
    stars.map((s) => STARS.find((x) => x.name === s.name)?.constellation).filter(Boolean),
  )) as string[];

  return {
    ts: now.getTime(), lat, lon, altitude, cameraAz, cameraAlt,
    sun: sunO ? { alt: sunO.alt, az: sunO.az } : undefined,
    moon: moonO ? { alt: moonO.alt, az: moonO.az, phase: ph.name, illum: ph.illumination } : undefined,
    planets, stars, constellations: consts,
    satellites: satsUp,
    iss: iss ? { name: iss.name, alt: iss.alt, az: iss.az } : null,
    galacticCenter: gc ? { alt: gc.alt, az: gc.az } : undefined,
    weather: weather?.available ? { temp: weather.temperature_c, pressure: weather.pressure_hpa } : undefined,
    spaceWeather: space?.kp_index?.available
      ? { kp: space.kp_index.value ?? undefined, level: space.kp_index.level ?? undefined, solarWind: space.solar_wind?.speed_kms }
      : undefined,
  };
}

// Recompute sky for a stored observation (astro is deterministic; satellites
// use the stored snapshot since past TLEs are not fetched).
export function reconstructSky(data: ObsData) {
  if (data.lat == null || data.lon == null) return null;
  const date = new Date(data.ts);
  return computeSky(date, data.lat, data.lon);
}
