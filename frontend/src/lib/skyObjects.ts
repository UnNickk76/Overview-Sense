import {
  dayNumber, sun, moon, moonPhase, planet, toHorizontal, GALACTIC_CENTER, AU_KM, EARTH_RADIUS_KM,
} from "./astronomy";
import { STARS, DEEP_SKY } from "./stars";
import { BODIES, PLANET_ORDER } from "./bodies";

export interface SkyObject {
  id: string;
  name: string;
  kind: "sun" | "moon" | "planet" | "star" | "deepsky" | "galcenter";
  alt: number;
  az: number;
  magnitude: number;
  color: string;
  subtitle: string;
  facts: string[];
  distanceStr: string;
  lightAgeLy: number | null; // light-years for "age of light" (null if trivial)
}

export function computeSky(date: Date, lat: number, lon: number): SkyObject[] {
  const d = dayNumber(date);
  const out: SkyObject[] = [];

  // Sun
  const s = sun(d);
  const sHz = toHorizontal(s.ra, s.dec, lat, lon, d);
  out.push({
    id: "sun", name: "Sole", kind: "sun", alt: sHz.alt, az: sHz.az, magnitude: -26.7,
    color: BODIES.Sun.color, subtitle: "Stella G2V · 1 AU",
    facts: BODIES.Sun.facts,
    distanceStr: `${(s.dist * AU_KM / 1e6).toFixed(1)} milioni di km`,
    lightAgeLy: (s.dist * AU_KM) / 9.461e12,
  });

  // Moon
  const m = moon(d);
  const mHz = toHorizontal(m.ra, m.dec, lat, lon, d);
  const ph = moonPhase(d);
  out.push({
    id: "moon", name: "Luna", kind: "moon", alt: mHz.alt, az: mHz.az, magnitude: -11,
    color: "#D8D8D8", subtitle: `${ph.name} · ${Math.round(ph.illumination * 100)}%`,
    facts: [
      `Fase attuale: ${ph.name}, illuminata al ${Math.round(ph.illumination * 100)}%.`,
      "La sua gravità genera le maree oceaniche.",
      "Si allontana dalla Terra di circa 3,8 cm all'anno.",
    ],
    distanceStr: `${Math.round(m.dist * EARTH_RADIUS_KM).toLocaleString()} km`,
    lightAgeLy: (m.dist * EARTH_RADIUS_KM) / 9.461e12,
  });

  // Planets
  for (const name of PLANET_ORDER) {
    const p = planet(name, d);
    const hz = toHorizontal(p.ra, p.dec, lat, lon, d);
    const b = BODIES[name];
    out.push({
      id: name.toLowerCase(), name: b.name, kind: "planet", alt: hz.alt, az: hz.az,
      magnitude: 1, color: b.color, subtitle: b.type,
      facts: b.facts,
      distanceStr: `${p.dist.toFixed(2)} AU (${(p.dist * AU_KM / 1e6).toFixed(0)} M km)`,
      lightAgeLy: (p.dist * AU_KM) / 9.461e12,
    });
  }

  // Bright stars
  for (const st of STARS) {
    const hz = toHorizontal(st.ra, st.dec, lat, lon, d);
    out.push({
      id: `star-${st.name}`, name: st.name, kind: "star", alt: hz.alt, az: hz.az,
      magnitude: st.mag, color: "#EAF2FF",
      subtitle: `${st.constellation} · ${st.spectralType}`,
      facts: [
        `${st.name} si trova nella costellazione ${st.constellation}.`,
        `Distanza: circa ${st.distanceLy} anni luce.`,
        `La luce che osservi è partita circa ${st.distanceLy} anni fa.`,
      ],
      distanceStr: `${st.distanceLy} anni luce`,
      lightAgeLy: st.distanceLy,
    });
  }

  // Deep sky
  for (const ds of DEEP_SKY) {
    const hz = toHorizontal(ds.ra, ds.dec, lat, lon, d);
    out.push({
      id: `ds-${ds.name}`, name: ds.name, kind: "deepsky", alt: hz.alt, az: hz.az,
      magnitude: 4, color: "#C9B8FF",
      subtitle: `${ds.type} · ${ds.constellation}`,
      facts: [
        `${ds.name}: ${ds.type}.`,
        `Distanza stimata: ${ds.distanceLy.toLocaleString()} anni luce.`,
        `La luce osservata oggi è partita ${ds.distanceLy.toLocaleString()} anni fa.`,
      ],
      distanceStr: `${ds.distanceLy.toLocaleString()} anni luce`,
      lightAgeLy: ds.distanceLy,
    });
  }

  // Galactic center
  const gc = toHorizontal(GALACTIC_CENTER.ra, GALACTIC_CENTER.dec, lat, lon, d);
  out.push({
    id: "galcenter", name: "Centro Galattico", kind: "galcenter", alt: gc.alt, az: gc.az,
    magnitude: 5, color: "#F0C674", subtitle: "Direzione della Via Lattea · Sgr A*",
    facts: [
      "In questa direzione si trova il centro della nostra galassia.",
      "Ospita Sagittarius A*, un buco nero supermassiccio di ~4 milioni di masse solari.",
      "Dista circa 26.000 anni luce dal Sistema Solare.",
    ],
    distanceStr: "≈ 26.000 anni luce",
    lightAgeLy: 26000,
  });

  return out;
}
