// Offline write queue backed by IndexedDB.
// Enqueues Supabase writes when offline and flushes them when the connection returns.
//
// Usage (adopter progressively in mutation sites):
//   import { enqueueWrite } from "@/lib/offline-queue";
//   await enqueueWrite({ table: "eleves", op: "insert", payload: { nom, prenom } });
//
// The queue is per-user (scoped by auth user id) and survives reloads.

import { supabase } from "@/integrations/supabase/client";

export type QueueOp = "insert" | "update" | "delete";

export interface QueuedWrite {
  id: string;
  createdAt: number;
  userId: string | null;
  table: string;
  op: QueueOp;
  // Row to insert / patch to apply
  payload?: Record<string, unknown>;
  // WHERE filters as equality pairs (for update/delete)
  match?: Record<string, unknown>;
  // Optional label for the UI
  label?: string;
  // Number of failed attempts
  attempts: number;
  lastError?: string;
}

const DB_NAME = "monregistre-offline";
const DB_VERSION = 1;
const STORE = "writes";

type Listener = () => void;
const listeners = new Set<Listener>();
let syncing = false;
let flushChain: Promise<void> = Promise.resolve();

function notify() {
  for (const l of listeners) l();
}

export function subscribeOfflineQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isSyncing(): boolean {
  return syncing;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function txStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  return tx.objectStore(STORE);
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export async function listQueue(): Promise<QueuedWrite[]> {
  try {
    const store = await txStore("readonly");
    return await new Promise((resolve, reject) => {
      const items: QueuedWrite[] = [];
      const req = store.index("createdAt").openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          items.push(cur.value as QueuedWrite);
          cur.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function pendingCount(): Promise<number> {
  try {
    const store = await txStore("readonly");
    return await new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

async function putItem(item: QueuedWrite): Promise<void> {
  const store = await txStore("readwrite");
  await new Promise<void>((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function removeItem(id: string): Promise<void> {
  const store = await txStore("readwrite");
  await new Promise<void>((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearQueue(): Promise<void> {
  const store = await txStore("readwrite");
  await new Promise<void>((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  notify();
}

export interface EnqueueInput {
  table: string;
  op: QueueOp;
  payload?: Record<string, unknown>;
  match?: Record<string, unknown>;
  label?: string;
}

/**
 * If online, executes the write immediately. If offline (or the direct write
 * fails with a network error), enqueues it and returns { queued: true }.
 */
export async function enqueueWrite(
  input: EnqueueInput,
): Promise<
  | { queued: false; data: unknown }
  | { queued: true; id: string }
> {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  if (online) {
    try {
      const data = await runWrite(input);
      return { queued: false, data };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      // fall through to queue
    }
  }

  const userId = await currentUserId();
  const item: QueuedWrite = {
    id: makeId(),
    createdAt: Date.now(),
    userId,
    attempts: 0,
    ...input,
  };
  await putItem(item);
  notify();
  return { queued: true, id: item.id };
}

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /network|failed to fetch|offline|timeout/i.test(msg);
}

async function runWrite(input: EnqueueInput): Promise<unknown> {
  const { table, op, payload, match } = input;
  const from = supabase.from(table);
  if (op === "insert") {
    const { data, error } = await from.insert(payload ?? {}).select();
    if (error) throw error;
    return data;
  }
  if (op === "update") {
    let q = from.update(payload ?? {});
    for (const [k, v] of Object.entries(match ?? {})) q = q.eq(k, v as never);
    const { data, error } = await q.select();
    if (error) throw error;
    return data;
  }
  // delete
  let q = from.delete();
  for (const [k, v] of Object.entries(match ?? {})) q = q.eq(k, v as never);
  const { error } = await q;
  if (error) throw error;
  return null;
}

/**
 * Flushes pending writes in creation order. Safe to call multiple times —
 * concurrent calls are chained. Emits notifications so the UI can update.
 */
export function flushQueue(): Promise<void> {
  flushChain = flushChain.then(doFlush).catch(() => {});
  return flushChain;
}

async function doFlush(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const items = await listQueue();
  if (items.length === 0) return;

  syncing = true;
  notify();
  try {
    for (const item of items) {
      try {
        await runWrite(item);
        await removeItem(item.id);
        notify();
      } catch (err) {
        if (isNetworkError(err)) {
          // Stop the flush; will retry on next online event
          break;
        }
        // Non-network error: increment attempts, keep in queue for visibility.
        // After 5 attempts drop to avoid an infinite loop.
        const next: QueuedWrite = {
          ...item,
          attempts: item.attempts + 1,
          lastError: err instanceof Error ? err.message : String(err),
        };
        if (next.attempts >= 5) {
          await removeItem(item.id);
        } else {
          await putItem(next);
        }
        notify();
      }
    }
  } finally {
    syncing = false;
    notify();
  }
}

let autoWired = false;
export function wireOfflineAutoFlush(onFlushed?: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = async () => {
    await flushQueue();
    onFlushed?.();
  };
  if (!autoWired) {
    window.addEventListener("online", handler);
    autoWired = true;
    // Attempt an initial flush at boot in case network is already up.
    void handler();
    return () => {
      window.removeEventListener("online", handler);
      autoWired = false;
    };
  }
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
