// Global OverView navigation state (route-aware, single source).
// FULL = the 8-item BottomNav; COMPACT = the golden OverView launcher.
// Auto-collapse after 15s of inactivity. This timer is INDEPENDENT from the
// BottomNav DM polling (also 15s) — different concern, different lifecycle.
import { useSyncExternalStore } from "react";

let expanded = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function clear() { if (timer) { clearTimeout(timer); timer = null; } }

export function expandNav() {
  if (!expanded) { expanded = true; emit(); }
  resetCollapseTimer();
}

// Any interaction with the expanded bar resets the 15s window.
export function resetCollapseTimer() {
  clear();
  timer = setTimeout(() => { expanded = false; emit(); }, 15000);
}

export function collapseNav() {
  clear();
  if (expanded) { expanded = false; emit(); }
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return expanded; }
export function useNavExpanded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
