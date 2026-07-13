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
        az: ((Number(look.azimuth) * 180) / Math.PI + 360) % 360,
        alt: (Number(look.elevation) * 180) / Math.PI,
        rangeKm: look.rangeSat,
      });
    } catch { /* skip */ }
  }
  return out;
}

export function satellitesOverhead(date: Date, lat: number, lon: number): SatPos[] {
  return computeSatellites(date, lat, lon).filter((s) => s.alt > 0).sort((a, b) => b.alt - a.alt);
}

export interface SatPass {
  name: string;
  start: Date;
  peak: Date;
  end: Date;
  peakAlt: number;
  peakAz: number;
}

// Predict the next pass of a satellite matching `pattern` above `horizonDeg`,
// scanning the next `minutes` (real SGP4). Returns null if none found.
export function nextPass(
  pattern: RegExp, now: Date, lat: number, lon: number,
  horizonDeg = 10, minutes = 120,
): SatPass | null {
  if (!satrecs.length) return null;
  let start: Date | null = null;
  let end: Date | null = null;
  let peakAlt = -90;
  let peakAz = 0;
  let peak: Date | null = null;
  let name = "";
  for (let s = 0; s <= minutes * 60; s += 30) {
    const t = new Date(now.getTime() + s * 1000);
    const sats = computeSatellites(t, lat, lon);
    const sat = sats.find((x) => pattern.test(x.name));
    if (!sat) continue;
    if (sat.alt >= horizonDeg) {
      if (!start) { start = t; name = sat.name; }
      end = t;
      if (sat.alt > peakAlt) { peakAlt = sat.alt; peakAz = sat.az; peak = t; }
    } else if (start) {
      break; // pass ended
    }
  }
  if (start && peak && end) {
    return { name, start, peak, end, peakAlt, peakAz };
  }
  return null;
}
