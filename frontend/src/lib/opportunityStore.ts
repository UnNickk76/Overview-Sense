import { Opportunity } from "./opportunities";
import { storage } from "@/src/utils/storage";

// In-memory cache so the detail screen can read the full Opportunity object
// (which is too rich to pass through router params) after the list computes it.
const cache = new Map<string, Opportunity>();

export function cacheOpportunities(list: Opportunity[]) {
  list.forEach((o) => cache.set(o.id, o));
}
export function getCachedOpportunity(id: string): Opportunity | undefined {
  return cache.get(id);
}

const FAV_KEY = "opportunity_favorites";

export async function getFavorites(): Promise<string[]> {
  const raw = await storage.getItem<string>(FAV_KEY, "[]");
  try { return JSON.parse(raw ?? "[]"); } catch { return []; }
}
export async function toggleFavorite(id: string): Promise<boolean> {
  const favs = await getFavorites();
  const has = favs.includes(id);
  const next = has ? favs.filter((f) => f !== id) : [...favs, id];
  await storage.setItem(FAV_KEY, JSON.stringify(next));
  return !has;
}
