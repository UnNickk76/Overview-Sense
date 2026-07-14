// OverView Guide™ — guidance engine (real sensor + astronomy data, never invented).
// Designed to grow: same primitives power the mini-radar, the golden status ring,
// and the on-camera guidance hints.

export type GuideDomain = "sky" | "earth";
export type GuideKind =
  | "sun" | "moon" | "planet" | "star" | "deepsky" | "galcenter" | "iss" | "satellite" | "landmark";

export interface GuideTarget {
  domain: GuideDomain;
  name: string;
  kind: GuideKind;
  az: number; // 0..360 (deg, true north)
  alt: number; // elevation deg (can be negative = below horizon)
  distanceKm?: number;
  magnitude?: number;
  note?: string;
}

export type SenseState =
  | "idle" | "searching" | "approaching" | "locked" | "tracking";

export interface Guidance {
  dAz: number; // signed shortest azimuth delta (deg). >0 => turn right (clockwise)
  dAlt: number; // altitude delta (deg). >0 => raise phone
  angularDist: number; // total angular separation (deg)
  proximity: number; // 0..1 (1 = perfectly centred)
  state: SenseState;
  turn: "left" | "right" | null;
  tilt: "up" | "down" | null;
  belowHorizon: boolean;
  hint: string; // single concise Italian instruction shown over the camera
  recommendedZoom: number;
}

const LOCK_DEG = 2.2; // centred
const APPROACH_DEG = 12; // fine-tuning zone
const SCALE_DEG = 90; // proximity full-scale

function norm360(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Signed shortest azimuth delta from current heading to target (deg, -180..180). */
export function azDelta(targetAz: number, headingAz: number): number {
  let d = norm360(targetAz) - norm360(headingAz);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Recommended zoom by target type — honest optical guidance, no fabricated detail. */
export function recommendedZoom(kind: GuideKind): number {
  switch (kind) {
    case "moon": return 6;
    case "sun": return 5;
    case "planet": return 15;
    case "iss":
    case "satellite": return 12;
    case "star": return 8;
    case "deepsky":
    case "galcenter": return 3;
    case "landmark": return 4;
    default: return 2;
  }
}

/** Core guidance computation from live sensors + resolved target. */
export function computeGuidance(t: GuideTarget, headingAz: number, pitchAlt: number): Guidance {
  const dAz = azDelta(t.az, headingAz);
  const dAlt = t.alt - pitchAlt;
  const angularDist = Math.hypot(dAz, dAlt);
  const proximity = Math.max(0, Math.min(1, 1 - angularDist / SCALE_DEG));
  const belowHorizon = t.alt < -2;

  let state: SenseState;
  if (angularDist <= LOCK_DEG) state = "locked";
  else if (angularDist <= APPROACH_DEG) state = "approaching";
  else state = "searching";

  const turn: "left" | "right" | null = Math.abs(dAz) < LOCK_DEG ? null : dAz > 0 ? "right" : "left";
  const tilt: "up" | "down" | null = Math.abs(dAlt) < LOCK_DEG ? null : dAlt > 0 ? "up" : "down";

  let hint: string;
  if (belowHorizon && state !== "locked") {
    hint = `${t.name} è sotto l'orizzonte ora (${t.alt.toFixed(0)}°)`;
  } else if (state === "locked") {
    hint = `✅ ${t.name} individuato`;
  } else {
    const parts: string[] = [];
    if (turn) parts.push(turn === "right" ? "Ruota verso destra" : "Ruota verso sinistra");
    if (tilt) parts.push(tilt === "up" ? `alza il telefono ${Math.round(Math.abs(dAlt))}°` : `abbassa il telefono ${Math.round(Math.abs(dAlt))}°`);
    if (state === "approaching") parts.push("ci sei quasi");
    hint = parts.length ? parts.join(" · ") : "Continua…";
  }

  return {
    dAz, dAlt, angularDist, proximity, state, turn, tilt, belowHorizon,
    hint, recommendedZoom: recommendedZoom(t.kind),
  };
}

/** Great-circle bearing (deg, true north) from observer to an Earth point. */
export function bearingTo(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const φ1 = lat1 * toRad, φ2 = lat2 * toRad, dλ = (lon2 - lon1) * toRad;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return norm360(Math.atan2(y, x) * (180 / Math.PI));
}

/** Great-circle distance (km). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, toRad = Math.PI / 180;
  const dφ = (lat2 - lat1) * toRad, dλ = (lon2 - lon1) * toRad;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Elevation angle to an Earth landmark accounting for its height and distance (deg). */
export function elevationTo(distKm: number, targetElevM = 0, observerElevM = 0): number {
  const dh = targetElevM - observerElevM;
  if (distKm <= 0) return 0;
  // account for Earth curvature drop (approx)
  const drop = (distKm * 1000) ** 2 / (2 * 6371000);
  return Math.atan2(dh - drop, distKm * 1000) * (180 / Math.PI);
}
