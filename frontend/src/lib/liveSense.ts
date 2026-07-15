// Live Sense™ — OverView recognizes what you're observing in real time.
// This module holds the user's recognition preferences (Control Center), shared
// between the camera and the settings screen via a tiny external store.
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type LiveCategory =
  | "astronomy" | "monuments" | "nature" | "botany" | "animals" | "architecture"
  | "art" | "geology" | "sea" | "technology" | "vehicles" | "objects";

export type LivePreset = "wow" | "balanced" | "full" | "custom";

export interface LiveCategoryDef {
  key: LiveCategory;
  emoji: string;
  label: string;
  wow: boolean;       // shown in "Solo WOW"
  balanced: boolean;  // shown in "Bilanciato"
}

export const LIVE_CATEGORIES: LiveCategoryDef[] = [
  { key: "astronomy", emoji: "🪐", label: "Astronomia", wow: true, balanced: true },
  { key: "monuments", emoji: "🏛", label: "Monumenti", wow: true, balanced: true },
  { key: "geology", emoji: "🏔", label: "Geologia", wow: true, balanced: true },
  { key: "animals", emoji: "🦋", label: "Animali", wow: true, balanced: true },
  { key: "art", emoji: "🎨", label: "Arte", wow: true, balanced: true },
  { key: "nature", emoji: "🌿", label: "Natura", wow: false, balanced: true },
  { key: "botany", emoji: "🌺", label: "Botanica", wow: false, balanced: true },
  { key: "architecture", emoji: "🏗", label: "Architettura", wow: false, balanced: true },
  { key: "sea", emoji: "🌊", label: "Mare", wow: false, balanced: true },
  { key: "technology", emoji: "🛰", label: "Tecnologia", wow: true, balanced: false },
  { key: "vehicles", emoji: "🚗", label: "Veicoli", wow: false, balanced: false },
  { key: "objects", emoji: "📦", label: "Oggetti", wow: false, balanced: false },
];

export interface LiveSenseState {
  on: boolean;
  preset: LivePreset;
  custom: Record<LiveCategory, boolean>;
}

const KEY = "overview_livesense";
const ALL = LIVE_CATEGORIES.map((c) => c.key);

function defaultCustom(): Record<LiveCategory, boolean> {
  const o = {} as Record<LiveCategory, boolean>;
  LIVE_CATEGORIES.forEach((c) => { o[c.key] = c.balanced; });
  return o;
}

let state: LiveSenseState = { on: true, preset: "balanced", custom: defaultCustom() };
const listeners = new Set<() => void>();
let hydrated = false;

function emit() { listeners.forEach((l) => l()); }
function persist() { AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); }

export async function hydrateLiveSense(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state = {
        on: p.on !== false,
        preset: p.preset ?? "balanced",
        custom: { ...defaultCustom(), ...(p.custom ?? {}) },
      };
      emit();
    }
  } catch { /* ignore */ }
}

export function setLiveOn(on: boolean) { state = { ...state, on }; persist(); emit(); }
export function setLivePreset(preset: LivePreset) { state = { ...state, preset }; persist(); emit(); }
export function toggleLiveCategory(cat: LiveCategory) {
  const custom = { ...state.custom, [cat]: !state.custom[cat] };
  state = { ...state, preset: "custom", custom };
  persist(); emit();
}

// The set of categories currently active for the chosen preset.
export function activeCategories(s: LiveSenseState = state): LiveCategory[] {
  if (!s.on) return [];
  if (s.preset === "full") return [...ALL];
  if (s.preset === "wow") return LIVE_CATEGORIES.filter((c) => c.wow).map((c) => c.key);
  if (s.preset === "balanced") return LIVE_CATEGORIES.filter((c) => c.balanced).map((c) => c.key);
  return ALL.filter((k) => s.custom[k]);
}

export function isCategoryActive(cat: LiveCategory, s: LiveSenseState = state): boolean {
  return activeCategories(s).includes(cat);
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return state; }

export function useLiveSense(): LiveSenseState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
