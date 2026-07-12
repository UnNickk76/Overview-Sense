// astronomy.ts — Real astronomical computations (Paul Schlyter's algorithm).
// All positions are scientifically derived, not invented. Accuracy ~1 arcmin
// for Sun/planets and ~2 arcmin for the Moon (main perturbations included).

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const rev = (x: number): number => ((x % 360) + 360) % 360;
const sind = (x: number) => Math.sin(x * DEG);
const cosd = (x: number) => Math.cos(x * DEG);
const asind = (x: number) => Math.asin(x) * RAD;
const atan2d = (y: number, x: number) => Math.atan2(y, x) * RAD;

// Days since 2000 Jan 0.0 (= 1999-12-31 00:00 UT)
export function dayNumber(date: Date): number {
  const Y = date.getUTCFullYear();
  const M = date.getUTCMonth() + 1;
  const D = date.getUTCDate();
  const UT = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const d =
    367 * Y -
    Math.floor((7 * (Y + Math.floor((M + 9) / 12))) / 4) +
    Math.floor((275 * M) / 9) +
    D -
    730530;
  return d + UT / 24;
}

function obliquity(d: number): number {
  return 23.4393 - 3.563e-7 * d;
}

interface Equatorial {
  ra: number; // degrees
  dec: number; // degrees
  dist: number; // AU (or Earth radii for Moon)
}

// ---- Sun -----------------------------------------------------------------
export function sun(d: number): Equatorial & { lon: number } {
  const w = 282.9404 + 4.70935e-5 * d;
  const e = 0.016709 - 1.151e-9 * d;
  const M = rev(356.047 + 0.9856002585 * d);
  const E = M + e * RAD * sind(M) * (1 + e * cosd(M));
  const xv = cosd(E) - e;
  const yv = Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const lon = rev(v + w);
  const ecl = obliquity(d);
  const x = r * cosd(lon);
  const y = r * sind(lon);
  const xe = x;
  const ye = y * cosd(ecl);
  const ze = y * sind(ecl);
  return {
    ra: rev(atan2d(ye, xe)),
    dec: atan2d(ze, Math.sqrt(xe * xe + ye * ye)),
    dist: r,
    lon,
  };
}

export function sunMeanLongitude(d: number): number {
  const w = 282.9404 + 4.70935e-5 * d;
  const M = 356.047 + 0.9856002585 * d;
  return rev(w + M);
}

// ---- Moon (geocentric, with main perturbations) --------------------------
export function moon(d: number): Equatorial & { latEcl: number; lonEcl: number } {
  const N = rev(125.1228 - 0.0529538083 * d);
  const i = 5.1454;
  const w = rev(318.0634 + 0.1643573223 * d);
  const a = 60.2666; // Earth radii
  const e = 0.0549;
  const M = rev(115.3654 + 13.0649929509 * d);

  let E = M + e * RAD * sind(M) * (1 + e * cosd(M));
  for (let k = 0; k < 5; k++) {
    E = E - (E - e * RAD * sind(E) - M) / (1 - e * cosd(E));
  }
  const xv = a * (cosd(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);

  const xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  const yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  const zh = r * (sind(v + w) * sind(i));

  let lonecl = atan2d(yh, xh);
  let latecl = atan2d(zh, Math.sqrt(xh * xh + yh * yh));

  // Perturbations
  const Ms = rev(356.047 + 0.9856002585 * d);
  const Ls = sunMeanLongitude(d);
  const Lm = rev(N + w + M);
  const Mm = M;
  const Dm = rev(Lm - Ls);
  const F = rev(Lm - N);

  lonecl +=
    -1.274 * sind(Mm - 2 * Dm) +
    0.658 * sind(2 * Dm) -
    0.186 * sind(Ms) -
    0.059 * sind(2 * Mm - 2 * Dm) -
    0.057 * sind(Mm - 2 * Dm + Ms) +
    0.053 * sind(Mm + 2 * Dm) +
    0.046 * sind(2 * Dm - Ms) +
    0.041 * sind(Mm - Ms) -
    0.035 * sind(Dm) -
    0.031 * sind(Mm + Ms) -
    0.015 * sind(2 * F - 2 * Dm) +
    0.011 * sind(Mm - 4 * Dm);
  latecl +=
    -0.173 * sind(F - 2 * Dm) -
    0.055 * sind(Mm - F - 2 * Dm) -
    0.046 * sind(Mm + F - 2 * Dm) +
    0.033 * sind(F + 2 * Dm) +
    0.017 * sind(2 * Mm + F);
  const rMoon = r - 0.58 * cosd(Mm - 2 * Dm) - 0.46 * cosd(2 * Dm);

  const ecl = obliquity(d);
  const xg = rMoon * cosd(lonecl) * cosd(latecl);
  const yg = rMoon * sind(lonecl) * cosd(latecl);
  const zg = rMoon * sind(latecl);
  const xe = xg;
  const ye = yg * cosd(ecl) - zg * sind(ecl);
  const ze = yg * sind(ecl) + zg * cosd(ecl);
  return {
    ra: rev(atan2d(ye, xe)),
    dec: atan2d(ze, Math.sqrt(xe * xe + ye * ye)),
    dist: rMoon, // Earth radii
    lonEcl: rev(lonecl),
    latEcl: latecl,
  };
}

// ---- Planets -------------------------------------------------------------
interface PlanetElements {
  N: (d: number) => number;
  i: (d: number) => number;
  w: (d: number) => number;
  a: (d: number) => number;
  e: (d: number) => number;
  M: (d: number) => number;
}

export const PLANET_ELEMENTS: Record<string, PlanetElements> = {
  Mercury: {
    N: (d) => 48.3313 + 3.24587e-5 * d, i: (d) => 7.0047 + 5.0e-8 * d,
    w: (d) => 29.1241 + 1.01444e-5 * d, a: () => 0.387098,
    e: (d) => 0.205635 + 5.59e-10 * d, M: (d) => 168.6562 + 4.0923344368 * d,
  },
  Venus: {
    N: (d) => 76.6799 + 2.4659e-5 * d, i: (d) => 3.3946 + 2.75e-8 * d,
    w: (d) => 54.891 + 1.38374e-5 * d, a: () => 0.72333,
    e: (d) => 0.006773 - 1.302e-9 * d, M: (d) => 48.0052 + 1.6021302244 * d,
  },
  Mars: {
    N: (d) => 49.5574 + 2.11081e-5 * d, i: (d) => 1.8497 - 1.78e-8 * d,
    w: (d) => 286.5016 + 2.92961e-5 * d, a: () => 1.523688,
    e: (d) => 0.093405 + 2.516e-9 * d, M: (d) => 18.6021 + 0.5240207766 * d,
  },
  Jupiter: {
    N: (d) => 100.4542 + 2.76854e-5 * d, i: (d) => 1.303 - 1.557e-7 * d,
    w: (d) => 273.8777 + 1.64505e-5 * d, a: () => 5.20256,
    e: (d) => 0.048498 + 4.469e-9 * d, M: (d) => 19.895 + 0.0830853001 * d,
  },
  Saturn: {
    N: (d) => 113.6634 + 2.3898e-5 * d, i: (d) => 2.4886 - 1.081e-7 * d,
    w: (d) => 339.3939 + 2.97661e-5 * d, a: () => 9.55475,
    e: (d) => 0.055546 - 9.499e-9 * d, M: (d) => 316.967 + 0.0334442282 * d,
  },
  Uranus: {
    N: (d) => 74.0005 + 1.3978e-5 * d, i: (d) => 0.7733 + 1.9e-8 * d,
    w: (d) => 96.6612 + 3.0565e-5 * d, a: (d) => 19.18171 - 1.55e-8 * d,
    e: (d) => 0.047318 + 7.45e-9 * d, M: (d) => 142.5905 + 0.011725806 * d,
  },
  Neptune: {
    N: (d) => 131.7806 + 3.0173e-5 * d, i: (d) => 1.77 - 2.55e-7 * d,
    w: (d) => 272.8461 - 6.027e-6 * d, a: (d) => 30.05826 + 3.313e-8 * d,
    e: (d) => 0.008606 + 2.15e-9 * d, M: (d) => 260.2471 + 0.005995147 * d,
  },
};

function heliocentric(el: PlanetElements, d: number) {
  const N = rev(el.N(d));
  const i = el.i(d);
  const w = rev(el.w(d));
  const a = el.a(d);
  const e = el.e(d);
  const M = rev(el.M(d));
  let E = M + e * RAD * sind(M) * (1 + e * cosd(M));
  for (let k = 0; k < 5; k++) {
    E = E - (E - e * RAD * sind(E) - M) / (1 - e * cosd(E));
  }
  const xv = a * (cosd(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  const yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  const zh = r * (sind(v + w) * sind(i));
  const lonEcl = rev(atan2d(yh, xh));
  return { xh, yh, zh, r, lonEcl };
}

export function planet(name: string, d: number): Equatorial {
  const el = PLANET_ELEMENTS[name];
  const { xh, yh, zh } = heliocentric(el, d);
  const s = sun(d);
  const xs = s.dist * cosd(s.lon);
  const ys = s.dist * sind(s.lon);
  const xg = xh + xs;
  const yg = yh + ys;
  const zg = zh;
  const ecl = obliquity(d);
  const xe = xg;
  const ye = yg * cosd(ecl) - zg * sind(ecl);
  const ze = yg * sind(ecl) + zg * cosd(ecl);
  return {
    ra: rev(atan2d(ye, xe)),
    dec: atan2d(ze, Math.sqrt(xe * xe + ye * ye)),
    dist: Math.sqrt(xg * xg + yg * yg + zg * zg),
  };
}

// Heliocentric ecliptic longitude + distance (for the 3D orrery)
export function planetHeliocentric(name: string, d: number): { lon: number; r: number } {
  const { lonEcl, r } = heliocentric(PLANET_ELEMENTS[name], d);
  return { lon: lonEcl, r };
}

export function earthHeliocentric(d: number): { lon: number; r: number } {
  const s = sun(d);
  return { lon: rev(s.lon + 180), r: s.dist };
}

// ---- Horizontal (alt/az) from equatorial ---------------------------------
export interface Horizontal {
  alt: number;
  az: number;
}

export function siderealTimeDeg(d: number, lon: number): number {
  const gmst0 = rev(sunMeanLongitude(d) + 180) / 15; // hours
  const utHours = ((d % 1) + 1) % 1; // fractional day = UT fraction
  const lst = gmst0 + utHours * 24 + lon / 15;
  return rev(lst * 15);
}

export function toHorizontal(
  ra: number, dec: number, lat: number, lon: number, d: number,
): Horizontal {
  const lst = siderealTimeDeg(d, lon);
  const ha = rev(lst - ra);
  const sinAlt = sind(dec) * sind(lat) + cosd(dec) * cosd(lat) * cosd(ha);
  const alt = asind(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz = (sind(dec) - sind(lat) * sinAlt) / (cosd(lat) * cosd(alt));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD;
  if (sind(ha) > 0) az = 360 - az;
  return { alt, az };
}

// ---- Moon phase ----------------------------------------------------------
export interface MoonPhase {
  phase: number; // 0..1 (0 = new, 0.5 = full)
  illumination: number; // 0..1
  name: string;
  emoji: string;
}

export function moonPhase(d: number): MoonPhase {
  const s = sun(d);
  const m = moon(d);
  // Elongation between Moon and Sun
  const elong =
    Math.acos(
      Math.max(-1, Math.min(1,
        sind(s.dec) * sind(m.dec) +
        cosd(s.dec) * cosd(m.dec) * cosd(s.ra - m.ra),
      )),
    ) * RAD;
  const illumination = (1 - cosd(elong)) / 2;
  // Phase fraction via ecliptic longitude difference (waxing/waning aware)
  const diff = rev(m.lonEcl - s.lon);
  const phase = diff / 360;
  let name = "New Moon", emoji = "🌑";
  if (phase < 0.03 || phase > 0.97) { name = "New Moon"; emoji = "🌑"; }
  else if (phase < 0.22) { name = "Waxing Crescent"; emoji = "🌒"; }
  else if (phase < 0.28) { name = "First Quarter"; emoji = "🌓"; }
  else if (phase < 0.47) { name = "Waxing Gibbous"; emoji = "🌔"; }
  else if (phase < 0.53) { name = "Full Moon"; emoji = "🌕"; }
  else if (phase < 0.72) { name = "Waning Gibbous"; emoji = "🌖"; }
  else if (phase < 0.78) { name = "Last Quarter"; emoji = "🌗"; }
  else { name = "Waning Crescent"; emoji = "🌘"; }
  return { phase, illumination, name, emoji };
}

// ---- Sunrise / sunset / twilight (returns Date or null) ------------------
function altOfSunAt(date: Date, lat: number, lon: number): number {
  const d = dayNumber(date);
  const s = sun(d);
  return toHorizontal(s.ra, s.dec, lat, lon, d).alt;
}

// Find time (today, UTC) when sun crosses a target altitude. rising=true finds
// the morning crossing, false the evening. Coarse scan + refine. Returns null
// if the sun never reaches that altitude that day (polar day/night).
function solarEventTime(
  base: Date, lat: number, lon: number, targetAlt: number, rising: boolean,
): Date | null {
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0));
  let prev = altOfSunAt(start, lat, lon);
  for (let min = 10; min <= 24 * 60; min += 10) {
    const t = new Date(start.getTime() + min * 60000);
    const cur = altOfSunAt(t, lat, lon);
    const crossingUp = prev < targetAlt && cur >= targetAlt;
    const crossingDown = prev >= targetAlt && cur < targetAlt;
    if ((rising && crossingUp) || (!rising && crossingDown)) {
      // refine by bisection
      let lo = t.getTime() - 10 * 60000;
      let hi = t.getTime();
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        const a = altOfSunAt(new Date(mid), lat, lon);
        const above = a >= targetAlt;
        if (above === rising) hi = mid;
        else lo = mid;
      }
      return new Date((lo + hi) / 2);
    }
    prev = cur;
  }
  return null;
}

export interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
  dawn: Date | null; // civil twilight begin (-6deg)
  dusk: Date | null; // civil twilight end (-6deg)
}

export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  return {
    sunrise: solarEventTime(date, lat, lon, -0.833, true),
    sunset: solarEventTime(date, lat, lon, -0.833, false),
    dawn: solarEventTime(date, lat, lon, -6, true),
    dusk: solarEventTime(date, lat, lon, -6, false),
  };
}

// ---- Physical constants / derived kinematics -----------------------------
export const AU_KM = 149597870.7;
export const C_KMS = 299792.458; // speed of light km/s
export const EARTH_RADIUS_KM = 6371;

// Instantaneous Earth orbital speed via vis-viva (a = 1 AU, GM_sun known).
export function earthOrbitalSpeedKmh(sunDistAU: number): number {
  const GM = 1.32712440018e11; // km^3/s^2
  const a = AU_KM;
  const r = sunDistAU * AU_KM;
  const v = Math.sqrt(GM * (2 / r - 1 / a)); // km/s
  return v * 3600;
}

// Surface rotation speed at latitude (km/h).
export function earthRotationSpeedKmh(lat: number): number {
  const equatorial = 1674.44; // km/h at equator
  return equatorial * Math.abs(cosd(lat));
}

export function sunLightMinutes(sunDistAU: number): number {
  return (sunDistAU * AU_KM) / C_KMS / 60;
}

// Galactic center (Sagittarius A*) J2000 equatorial coords.
export const GALACTIC_CENTER = { ra: 266.417, dec: -29.008 };
