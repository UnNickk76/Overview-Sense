import * as FileSystem from "expo-file-system/legacy";
import { storage } from "@/src/utils/storage";

export interface Observation {
  id: string;
  kind: "image" | "audio";
  uri: string;
  label: string;
  ts: number;
}

const KEY = "observations";
const DIR = `${FileSystem.documentDirectory}observations/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

export async function listObservations(): Promise<Observation[]> {
  const raw = (await storage.getItem<string>(KEY, "[]")) ?? "[]";
  const list = JSON.parse(raw) as Observation[];
  return list.sort((a, b) => b.ts - a.ts);
}

async function readList(): Promise<Observation[]> {
  const raw = (await storage.getItem<string>(KEY, "[]")) ?? "[]";
  return JSON.parse(raw) as Observation[];
}
async function writeList(list: Observation[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(list));
}

// Persist an image given base64 JPEG data.
export async function saveImageObservation(base64: string, label: string): Promise<Observation> {
  await ensureDir();
  const id = `img_${Date.now()}`;
  const uri = `${DIR}${id}.jpg`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  const obs: Observation = { id, kind: "image", uri, label, ts: Date.now() };
  await writeList([obs, ...(await readList())]);
  return obs;
}

// Persist an audio recording by copying its file into app storage.
export async function saveAudioObservation(sourceUri: string, label: string): Promise<Observation> {
  await ensureDir();
  const id = `aud_${Date.now()}`;
  const uri = `${DIR}${id}.m4a`;
  try { await FileSystem.copyAsync({ from: sourceUri, to: uri }); }
  catch { return { id, kind: "audio", uri: sourceUri, label, ts: Date.now() }; }
  const obs: Observation = { id, kind: "audio", uri, label, ts: Date.now() };
  await writeList([obs, ...(await readList())]);
  return obs;
}

export async function removeObservation(id: string): Promise<void> {
  const list = await readList();
  const target = list.find((o) => o.id === id);
  if (target) { try { await FileSystem.deleteAsync(target.uri, { idempotent: true }); } catch {} }
  await writeList(list.filter((o) => o.id !== id));
}
