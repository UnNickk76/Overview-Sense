import { project, angDiff, FOV_H } from "./project";
import type { ObsData } from "./gallery";

export type FramedKind = "Pianeta" | "Satellite" | "Luna" | "Sole" | "Centro Galattico" | "Stella";

export interface FramedObject {
  name: string;                 // stored name (key for legend hide/show)
  label: string;                // localized display name
  kind: FramedKind;
  az: number;
  alt: number;
  pt: { x: number; y: number } | null;
  inFrame: boolean;
  dAz: number;                  // signed azimuth offset from camera axis (deg)
  dAlt: number;                 // signed elevation offset from camera axis (deg)
  sep: number;                  // angular separation from frame center (deg)
}

const IT: Record<string, string> = {
  Mercury: "Mercurio", Venus: "Venere", Mars: "Marte", Jupiter: "Giove",
  Saturn: "Saturno", Uranus: "Urano", Neptune: "Nettuno", Pluto: "Plutone",
  Sun: "Sole", Moon: "Luna", ISS: "ISS",
};
const label = (n: string) => IT[n] ?? n;

const D2R = Math.PI / 180;
function separation(objAz: number, objAlt: number, camAz: number, camAlt: number): number {
  // Spherical angular distance between the frame center axis and the object.
  const c = Math.sin(objAlt * D2R) * Math.sin(camAlt * D2R)
    + Math.cos(objAlt * D2R) * Math.cos(camAlt * D2R) * Math.cos((objAz - camAz) * D2R);
  return Math.acos(Math.max(-1, Math.min(1, c))) / D2R;
}

export function frameObjects(dd: ObsData | undefined, camAz: number, camAlt: number, w: number, h: number, fovH: number = FOV_H) {
  const list: FramedObject[] = [];
  if (!dd) return { recognized: [] as FramedObject[], nearby: [] as FramedObject[], all: list };

  const add = (name: string, kind: FramedKind, az: number, alt: number) => {
    const pt = project(az, alt, camAz, camAlt, w, h, fovH);
    // Recognized only if it falls in the frame AND is above the horizon (otherwise the
    // ground occludes it — it's really "in your direction", not captured).
    const inFrame = pt !== null && alt >= 0;
    list.push({
      name, label: label(name), kind, az, alt, pt, inFrame,
      dAz: angDiff(az, camAz), dAlt: alt - camAlt, sep: separation(az, alt, camAz, camAlt),
    });
  };

  (dd.planets ?? []).forEach((p) => add(p.name, "Pianeta", p.az, p.alt));
  (dd.stars ?? []).forEach((s) => add(s.name, "Stella", s.az, s.alt));
  if (dd.iss) add("ISS", "Satellite", dd.iss.az, dd.iss.alt);
  (dd.satellites ?? []).forEach((s) => add(s.name, "Satellite", s.az, s.alt));
  if (dd.moon) add("Luna", "Luna", dd.moon.az, dd.moon.alt);
  if (dd.sun) add("Sole", "Sole", dd.sun.az, dd.sun.alt);
  if (dd.galacticCenter) add("Centro Galattico", "Centro Galattico", dd.galacticCenter.az, dd.galacticCenter.alt);

  const recognized = list.filter((o) => o.inFrame);
  const nearby = list.filter((o) => !o.inFrame).sort((a, b) => a.sep - b.sep).slice(0, 12);
  return { recognized, nearby, all: list };
}

// "18° a destra e 12° più in alto" · "dietro il tuo punto di vista"
export function directionPhrase(o: FramedObject): string {
  if (Math.abs(o.dAz) > 100) return "dietro il tuo punto di vista";
  const parts = [`${Math.round(Math.abs(o.dAz))}° a ${o.dAz >= 0 ? "destra" : "sinistra"}`];
  if (Math.abs(o.dAlt) >= 2) parts.push(`${Math.round(Math.abs(o.dAlt))}° più in ${o.dAlt >= 0 ? "alto" : "basso"}`);
  return parts.join(" e ");
}

export function statusPhrase(o: FramedObject): string {
  if (o.alt < -0.5) return "sotto l'orizzonte · non osservabile da qui";
  if (o.alt < 6) return "vicino all'orizzonte";
  return "sopra l'orizzonte";
}

// One-line summary like the spec examples: "Giove: 18° a destra e 12° più in alto."
export function guidanceLine(o: FramedObject): string {
  if (o.alt < -0.5) return `${o.label}: sotto l'orizzonte, non osservabile da questa posizione.`;
  return `${o.label}: ${directionPhrase(o)}.`;
}

// Screen-space rotation (deg) for an OverView™ direction arrow pointing at the object.
// 0° = up. Right = +dAz, higher = +dAlt (up on screen).
export function arrowRotation(o: FramedObject): number {
  return (Math.atan2(o.dAz, o.dAlt) / D2R);
}
