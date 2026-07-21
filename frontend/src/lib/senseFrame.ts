import { project } from "./project";
import { CONSTELLATION_LINES, activeConstellations, type Constellation } from "./constellations";
import type { ObsData, ObsPoint } from "./gallery";

// The SINGLE source of truth for the celestial overlay geometry. Both the live
// Sense Vision preview and the final saved photo build their overlay from THIS
// function, using the SAME dataset (an ObsData snapshot) and the SAME projection
// (camera az/alt + real FOV). This guarantees WYSIWYG: what you frame before the
// shutter is exactly what the saved image renders — no second astronomical pass.

export type Pt = { x: number; y: number };
export type MarkPt = ObsPoint & { pt: Pt };

export type OverlayInput = Pick<
  ObsData,
  "stars" | "planets" | "satellites" | "iss" | "sun" | "moon" | "galacticCenter"
>;

export interface SkyOverlay {
  stars: Pt[];
  lines: { a: Pt; b: Pt }[];
  figures: { c: Constellation; poly: string | null; cx: number; cy: number }[];
  inFrameConstellations: string[];
  planets: MarkPt[];
  satellites: MarkPt[];
  iss: (ObsPoint & { pt: Pt | null }) | null;
  sun: Pt | null;
  moon: Pt | null;
  gc: Pt | null;
}

export function buildOverlay(
  d: OverlayInput,
  camAz: number,
  camAlt: number,
  w: number,
  h: number,
  fovH: number,
  mirror = false,
): SkyOverlay {
  const p = (az: number, alt: number): Pt | null => {
    const r = project(az, alt, camAz, camAlt, w, h, fovH);
    if (!r) return null;
    return mirror ? { x: w - r.x, y: r.y } : r;
  };

  const starPts = new Map<string, Pt>();
  (d.stars ?? []).forEach((s) => { const pt = p(s.az, s.alt); if (pt) starPts.set(s.name, pt); });

  const lines = CONSTELLATION_LINES
    .map(([a, b]) => ({ a: starPts.get(a), b: starPts.get(b) }))
    .filter((l) => l.a && l.b) as { a: Pt; b: Pt }[];

  const mk = (arr?: ObsPoint[]) =>
    (arr ?? []).map((o) => ({ ...o, pt: o.alt >= 0 ? p(o.az, o.alt) : null })).filter((o) => o.pt) as MarkPt[];

  const activeC = activeConstellations(new Set(starPts.keys()));
  const figures = activeC.map((c) => {
    const pts = c.figure.map((n) => starPts.get(n)).filter(Boolean) as Pt[];
    const memberPts = c.stars.map((n) => starPts.get(n)).filter(Boolean) as Pt[];
    const cx = memberPts.reduce((a, m) => a + m.x, 0) / Math.max(1, memberPts.length);
    const cy = memberPts.reduce((a, m) => a + m.y, 0) / Math.max(1, memberPts.length);
    return { c, poly: pts.length >= 3 ? pts.map((pt) => `${pt.x},${pt.y}`).join(" ") : null, cx, cy };
  });

  return {
    stars: Array.from(starPts.values()),
    lines,
    inFrameConstellations: activeC.map((c) => c.name),
    figures,
    planets: mk(d.planets),
    satellites: mk(d.satellites),
    iss: d.iss && d.iss.alt >= 0 ? { ...d.iss, pt: p(d.iss.az, d.iss.alt) } : null,
    sun: d.sun ? p(d.sun.az, d.sun.alt) : null,
    moon: d.moon && d.moon.alt >= 0 ? p(d.moon.az, d.moon.alt) : null,
    gc: d.galacticCenter ? p(d.galacticCenter.az, d.galacticCenter.alt) : null,
  };
}
