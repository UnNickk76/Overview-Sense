import * as FileSystem from "expo-file-system/legacy";
import { storage } from "@/src/utils/storage";

export interface ObsPoint { name: string; alt: number; az: number }

export interface ObsData {
  ts: number;
  lat?: number; lon?: number; altitude?: number | null;
  cameraAz?: number; cameraAlt?: number;
  sun?: { alt: number; az: number };
  moon?: { alt: number; az: number; phase: string; illum: number };
  planets?: ObsPoint[];
  stars?: ObsPoint[];
  constellations?: string[];
  satellites?: ObsPoint[];
  iss?: ObsPoint | null;
  galacticCenter?: { alt: number; az: number };
  weather?: { temp?: number; pressure?: number };
  spaceWeather?: { kp?: number; level?: string; solarWind?: number };
  magnetic?: { magnitude: number };
  senseLayer?: string;
  // Real optical/digital zoom factor frozen at capture (WYSIWYG projection).
  zoom?: number;
  // Frozen terrestrial features (Sense Vision "Luoghi") in the observed direction.
  places?: {
    name: string; category: string; categoryLabel: string;
    lat: number; lon: number; distanceKm: number; az: number; alt: number;
    ele: number | null; score: number;
  }[];
  // AI Visual Assistant explanation attached to the Senshot (real data only).
  aiNote?: string;
  // Origin screen — enables the universal "Go There" viewpoint recreation.
  from?: string;
  // Pulse™ challenge attached to this Senshot (curated task, not AI-generated).
  pulse?: { id: string; title: string; theme: string; prompt?: string };
  // Sky legend: which recognized objects are hidden, and whether names are shown.
  legendHidden?: string[];
  legendOn?: boolean;
  // Go There™ location privacy chosen by the author (default exact for legacy).
  geoPrecision?: "none" | "area" | "approx" | "exact";
}

export interface Observation {
  id: string;
  seq: number;
  kind: "image" | "audio";
  uri: string;
  label: string;
  ts: number;
  data?: ObsData;
}

const KEY = "observations";
const SEQ_KEY = "obs_seq";
const DIR = `${FileSystem.documentDirectory}observations/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}
async function readList(): Promise<Observation[]> {
  const raw = (await storage.getItem<string>(KEY, "[]")) ?? "[]";
  try { return JSON.parse(raw) as Observation[]; } catch { return []; }
}
async function writeList(list: Observation[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(list));
}
async function nextSeq(): Promise<number> {
  const cur = (await storage.getItem<number>(SEQ_KEY, 0)) ?? 0;
  const n = cur + 1;
  await storage.setItem(SEQ_KEY, n);
  return n;
}

export async function listObservations(): Promise<Observation[]> {
  return (await readList()).sort((a, b) => b.ts - a.ts);
}
export async function getObservation(id: string): Promise<Observation | null> {
  return (await readList()).find((o) => o.id === id) ?? null;
}

export function observationCode(seq: number): string {
  return `#${String(seq).padStart(9, "0")}`;
}

// Save a captured photo as a rich Observation (copies the file to app storage).
export async function saveObservation(photoUri: string, data: ObsData): Promise<Observation> {
  await ensureDir();
  const seq = await nextSeq();
  const id = `obs_${Date.now()}`;
  const dest = `${DIR}${id}.jpg`;
  try { await FileSystem.copyAsync({ from: photoUri, to: dest }); }
  catch { /* fall back to original uri */ }
  const finalUri = (await FileSystem.getInfoAsync(dest)).exists ? dest : photoUri;
  const d = new Date(data.ts);
  const label = `Observation • ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} • ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const obs: Observation = { id, seq, kind: "image", uri: finalUri, label, ts: data.ts, data };
  await writeList([obs, ...(await readList())]);
  return obs;
}

export async function saveAudioObservation(sourceUri: string, label: string): Promise<Observation> {
  await ensureDir();
  const seq = await nextSeq();
  const id = `aud_${Date.now()}`;
  const uri = `${DIR}${id}.m4a`;
  try { await FileSystem.copyAsync({ from: sourceUri, to: uri }); }
  catch { return { id, seq, kind: "audio", uri: sourceUri, label, ts: Date.now() }; }
  const obs: Observation = { id, seq, kind: "audio", uri, label, ts: Date.now() };
  await writeList([obs, ...(await readList())]);
  return obs;
}

export async function removeObservation(id: string): Promise<void> {
  const list = await readList();
  const target = list.find((o) => o.id === id);
  if (target) { try { await FileSystem.deleteAsync(target.uri, { idempotent: true }); } catch {} }
  await writeList(list.filter((o) => o.id !== id));
}
