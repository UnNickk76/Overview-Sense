// Sense Vision 2.0 — recognition & Session Spatial Memory preferences.
// A tiny external store shared by the camera (native) and settings UI.
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type MemoryMode = "off" | "relevant" | "all";

export interface SceneRecogState {
  // Whether the recognition overlay is shown during live framing. Hiding the
  // overlay does NOT stop the analysis (OFF = "I don't want to SEE it").
  recognitionOn: boolean;
  // Session Spatial Memory: off / only noteworthy elements (default) / all.
  memoryMode: MemoryMode;
}

const KEY = "overview_scene_recog";
let state: SceneRecogState = { recognitionOn: true, memoryMode: "relevant" };
const listeners = new Set<() => void>();
let hydrated = false;

function emit() { listeners.forEach((l) => l()); }
function persist() { AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); }

export async function hydrateSceneRecog(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      state = {
        recognitionOn: p.recognitionOn !== false,
        memoryMode: (["off", "relevant", "all"].includes(p.memoryMode) ? p.memoryMode : "relevant"),
      };
      emit();
    }
  } catch { /* ignore */ }
}

export function setRecognitionOn(on: boolean) { state = { ...state, recognitionOn: on }; persist(); emit(); }
export function setMemoryMode(mode: MemoryMode) { state = { ...state, memoryMode: mode }; persist(); emit(); }

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return state; }
export function useSceneRecog(): SceneRecogState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Per-viewer, per-Sense "show recognition layer" preference (does NOT alter the
// Sense). Default follows the creator's overlay_default captured at shot time.
const VKEY = (obsId: string) => `overview_recog_view_${obsId}`;
export async function getViewerPref(obsId: string, fallbackOn: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VKEY(obsId));
    if (raw === "on") return true;
    if (raw === "off") return false;
  } catch { /* ignore */ }
  return fallbackOn;
}
export function setViewerPref(obsId: string, on: boolean) {
  AsyncStorage.setItem(VKEY(obsId), on ? "on" : "off").catch(() => {});
}
