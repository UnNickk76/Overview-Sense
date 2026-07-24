import { storage } from "@/src/utils/storage";
import { socialApi } from "./backend";
import { ApiError } from "./client";

export type PublishPayload = Parameters<typeof socialApi.createObservation>[0];

interface PendingItem {
  key: string;
  payload: PublishPayload;
  ts: number;
}

const QKEY = "pending_publish";

async function read(): Promise<PendingItem[]> {
  const raw = (await storage.getItem<string>(QKEY, "[]")) ?? "[]";
  try { return JSON.parse(raw) as PendingItem[]; } catch { return []; }
}
async function write(list: PendingItem[]): Promise<void> {
  await storage.setItem(QKEY, JSON.stringify(list));
}

// Queue a Sense whose publish couldn't complete right now (offline / server /
// timeout). The user must never lose content — it will be published automatically
// as soon as possible (app foreground / next attempt).
export async function enqueuePublish(payload: PublishPayload): Promise<void> {
  const list = await read();
  list.push({ key: `pp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, payload, ts: Date.now() });
  await write(list);
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

let flushing = false;

// Attempt to publish every queued Sense. Retriable failures keep the item;
// permanent failures (validation/auth) are dropped so the queue can't get stuck.
export async function flushPendingPublishes(): Promise<{ published: number; remaining: number }> {
  if (flushing) return { published: 0, remaining: (await read()).length };
  flushing = true;
  let published = 0;
  try {
    let list = await read();
    if (list.length === 0) return { published: 0, remaining: 0 };
    const keep: PendingItem[] = [];
    for (const item of list) {
      try {
        await socialApi.createObservation(item.payload);
        published += 1;
      } catch (e) {
        // Permanent errors (bad data / moderation) → drop. Auth/network/server/timeout → keep for later.
        if (e instanceof ApiError && (e.status === 400 || e.status === 422)) {
          continue; // drop
        }
        keep.push(item);
      }
    }
    await write(keep);
    return { published, remaining: keep.length };
  } finally {
    flushing = false;
  }
}
