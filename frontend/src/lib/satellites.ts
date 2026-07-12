import * as satellite from "satellite.js";

export interface SatTLE { name: string; satelliteId: number; line1: string; line2: string }
export interface SatPos { id: string; name: string; az: number; alt: number; rangeKm: number }

interface Rec { name: string; id: number; rec: satellite.SatRec }
let satrecs: Rec[] = [];

export function loadSatrecs(tles: SatTLE[]) {
  satrecs = tles
    .map((t) => ({ name: t.name, id: t.satelliteId, rec: satellite.twoline2satrec(t.line1, t.line2) }))
    .filter((s) => s.rec && !(s.rec as unknown as { error: number }).error);
}

export function hasSatrecs(): boolean { return satrecs.length > 0; }

// Real SGP4 propagation → topocentric alt/az for the observer.
export function computeSatellites(date: Date, lat: number, lon: number, altKm = 0): SatPos[] {
  if (!satrecs.length) return [];
  const gmst = satellite.gstime(date);
  const obs = {
    longitude: satellite.degreesToRadians(lon),
    latitude: satellite.degreesToRadians(lat),
    height: altKm,
  };
  const out: SatPos[] = [];
  for (const s of satrecs) {
    try {
      const pv = satellite.propagate(s.rec, date);
      const pos = pv?.position;
      if (!pos || typeof pos === "boolean") continue;
      const ecf = satellite.eciToEcf(pos, gmst);
      const look = satellite.ecfToLookAngles(obs, ecf);
      out.push({
        id: `sat-${s.id}`,
        name: s.name.replace(/\s*\(.*\)$/, ""),
        az: (satellite.radiansToDegrees(look.azimuth) + 360) % 360,
        alt: satellite.radiansToDegrees(look.elevation),
        rangeKm: look.rangeSat,
      });
    } catch { /* skip */ }
  }
  return out;
}

export function satellitesOverhead(date: Date, lat: number, lon: number): SatPos[] {
  return computeSatellites(date, lat, lon).filter((s) => s.alt > 0).sort((a, b) => b.alt - a.alt);
}
