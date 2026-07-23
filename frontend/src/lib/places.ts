const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export interface PlaceItem {
  name: string;
  category: string;       // machine key (mountain, city, monument…)
  categoryLabel: string;  // human label (IT)
  lat: number;
  lon: number;
  distanceKm: number;
  az: number;             // bearing from observer (deg from north)
  alt: number;            // real elevation angle (deg, curvature+refraction)
  ele: number | null;
  score: number;
}

export type PlaceRadius = 15 | 60 | 200;

// Fetch real geographic features around the observer from OpenStreetMap (via the
// backend). Beyond View: nothing invented — bearing/elevation come from real
// coordinates. Backend caches results, so repeat calls are instant.
export async function fetchPlaces(lat: number, lon: number, radiusKm: number, ele = 0): Promise<PlaceItem[]> {
  const url = `${BASE}/api/geo/places?lat=${lat}&lon=${lon}&radius_km=${radiusKm}&ele=${Math.round(ele)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geo ${res.status}`);
  const data = await res.json();
  return (data.places ?? []) as PlaceItem[];
}
