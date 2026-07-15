// Real reference thumbnails for celestial bodies (Wikimedia Commons, public/CC).
// Special:FilePath resolves to the current file — stable & free. Beyond View:
// these are real reference images of the recognized object, never invented scenes.
const W = 160;
const wm = (file: string) => `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${W}`;

const BY_ID: Record<string, string> = {
  sun: wm("Sun_white.jpg"),
  moon: wm("FullMoon2010.jpg"),
  mercury: wm("Mercury in color - Prockter07-edit1.jpg"),
  venus: wm("Venus-real_color.jpg"),
  mars: wm("Mars_Valles_Marineris.jpeg"),
  jupiter: wm("Jupiter.jpg"),
  saturn: wm("Saturn_during_Equinox.jpg"),
  uranus: wm("Uranus2.jpg"),
  neptune: wm("Neptune_Full.jpg"),
  galcenter: wm("Milky_Way_Arch.jpg"),
};

const BY_NAME: Record<string, string> = {
  "Andromeda": wm("Andromeda_Galaxy_560mm_FL.jpg"),
  "M31": wm("Andromeda_Galaxy_560mm_FL.jpg"),
  "Nebulosa di Orione": wm("Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg"),
  "M42": wm("Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg"),
  "Pleiadi": wm("Pleiades_large.jpg"),
  "M45": wm("Pleiades_large.jpg"),
  "ISS": wm("International_Space_Station_after_undocking_of_STS-132.jpg"),
};

// Best-effort real thumbnail for a recognized celestial object.
export function celestialThumb(id: string, name: string): string | null {
  if (BY_ID[id]) return BY_ID[id];
  if (BY_NAME[name]) return BY_NAME[name];
  // Bright stars: no single canonical photo → no thumbnail (label only).
  return null;
}

// Real reference thumbnail for ANY recognized subject, via Wikipedia search.
// Returns a Wikimedia thumbnail URL (real photo of the subject) or null.
export async function wikiThumb(query: string): Promise<string | null> {
  if (!query) return null;
  const headers = { "User-Agent": "OverViewApp/1.0 (live-sense)", "Api-User-Agent": "OverViewApp/1.0" };
  for (const lang of ["it", "en"]) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=1`, { headers });
      if (!r.ok) continue;
      const j = await r.json();
      let url: string | undefined = j?.pages?.[0]?.thumbnail?.url;
      if (url) {
        if (url.startsWith("//")) url = `https:${url}`;
        // Request a larger crop than the tiny default (…/60px-… → …/240px-…).
        return url.replace(/\/\d+px-/, "/240px-");
      }
    } catch { /* try next language */ }
  }
  return null;
}
