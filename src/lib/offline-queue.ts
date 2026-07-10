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
export type ConflictStrategy = "client-wins" | "server-wins" | "merge";

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
  // ISO timestamp of the server row when the edit started (for conflict detection).
  baseUpdatedAt?: string;
  // How to resolve when server has changed since baseUpdatedAt. Default: "merge".
  conflictStrategy?: ConflictStrategy;
  // Number of failed attempts
  attempts: number;
  lastError?: string;
}

export interface ConflictEvent {
  table: string;
  op: QueueOp;
  match?: Record<string, unknown>;
  label?: string;
  baseUpdatedAt: string;
  serverUpdatedAt: string;
  strategy: ConflictStrategy;
  resolution: "client-applied" | "server-kept";
}

const DB_NAME = "monregistre-offline";
const DB_VERSION = 1;
const STORE = "writes";

type Listener = () => void;
type ConflictListener = (e: ConflictEvent) => void;
const listeners = new Set<Listener>();
const conflictListeners = new Set<ConflictListener>();
let syncing = false;
let flushChain: Promise<void> = Promise.resolve();

function notify() {
  for (const l of listeners) l();
}

function notifyConflict(e: ConflictEvent) {
  for (const l of conflictListeners) l(e);
}

export function subscribeOfflineQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function subscribeOfflineConflicts(fn: ConflictListener): () => void {
  conflictListeners.add(fn);
  return () => {
    conflictListeners.delete(fn);
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
  /** Server updated_at known by the client when the edit started. */
  baseUpdatedAt?: string;
  /** Conflict policy when server row changed since baseUpdatedAt. Default "merge". */
  conflictStrategy?: ConflictStrategy;
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

/**
 * Detects a conflict on update/delete: fetches the current server row and
 * compares `updated_at` with the client's `baseUpdatedAt`. Emits a conflict
 * event and applies the requested strategy:
 *   - "client-wins" (or "merge"): proceed with the write, overwriting server changes.
 *     "merge" is treated as last-write-wins at row granularity + user notification.
 *   - "server-wins": skip the write, keep the server version.
 */
async function detectConflict(
  input: EnqueueInput,
): Promise<{ skip: boolean }> {
  if (!input.baseUpdatedAt || !input.match) return { skip: false };
  if (input.op !== "update" && input.op !== "delete") return { skip: false };

  const strategy: ConflictStrategy = input.conflictStrategy ?? "merge";
  const from = (supabase.from as unknown as (t: string) => any)(input.table);
  let q = from.select("updated_at").limit(1);
  for (const [k, v] of Object.entries(input.match)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  if (error) {
    if (isNetworkError(error)) throw error;
    // Row not found or other read error — let the write proceed and surface its own error.
    return { skip: false };
  }
  const serverUpdatedAt: string | undefined = data?.updated_at;
  if (!serverUpdatedAt) return { skip: false };
  if (new Date(serverUpdatedAt).getTime() <= new Date(input.baseUpdatedAt).getTime()) {
    return { skip: false };
  }

  const skip = strategy === "server-wins";
  notifyConflict({
    table: input.table,
    op: input.op,
    match: input.match,
    label: input.label,
    baseUpdatedAt: input.baseUpdatedAt,
    serverUpdatedAt,
    strategy,
    resolution: skip ? "server-kept" : "client-applied",
  });
  return { skip };
}

async function runWrite(input: EnqueueInput): Promise<unknown> {
  const { table, op, payload, match } = input;
  // Cast to loose typing — this queue is a generic writer that must accept
  // arbitrary tables/payloads chosen at runtime, so we bypass the strict
  // per-table types from the generated Database schema.
  const from = (supabase.from as unknown as (t: string) => any)(table);
  if (op === "insert") {
    const { data, error } = await from.insert(payload ?? {}).select();
    if (error) throw error;
    void mirrorToSqlite(table, "insert", data);
    return data;
  }

  // Conflict detection for update/delete
  const { skip } = await detectConflict(input);
  if (skip) return null;

  if (op === "update") {
    // Bump updated_at so subsequent conflict checks compare correctly.
    const patch = { ...(payload ?? {}), updated_at: new Date().toISOString() };
    let q = from.update(patch);
    for (const [k, v] of Object.entries(match ?? {})) q = q.eq(k, v);
    const { data, error } = await q.select();
    if (error) throw error;
    void mirrorToSqlite(table, "update", data);
    return data;
  }
  // delete
  let q = from.delete();
  for (const [k, v] of Object.entries(match ?? {})) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw error;
  void mirrorToSqlite(table, "delete", null, match);
  return null;
}

// Propage l'écriture serveur au miroir SQLite local (Android natif).
// No-op sur web / si la table n'est pas mirrorée.
const MIRRORED_TABLES = new Set([
  "ecoles", "classes", "eleves", "periodes", "creneaux",
  "sequences_programme", "notes", "absences", "annees_scolaires",
]);
async function mirrorToSqlite(
  table: string,
  op: QueueOp,
  data: unknown,
  match?: Record<string, unknown>,
): Promise<void> {
  if (!MIRRORED_TABLES.has(table)) return;
  try {
    const mod = await import("@/lib/sqlite");
    if (op === "delete") {
      const id = (match?.id as string | undefined) ?? null;
      if (id) await mod.mirrorDelete(table as any, id);
      return;
    }
    const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    if (rows.length > 0) await mod.mirrorUpsert(table as any, rows);
  } catch {
    // SQLite indisponible — silencieux (web ou plugin absent).
  }
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

  // Écoute Capacitor Network en plus des events navigateur (WebView Android
  // ne déclenche pas toujours 'online' de façon fiable).
  let removeNetworkListener: (() => void) | undefined;
  void (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { Network } = await import("@capacitor/network");
      const listener = await Network.addListener("networkStatusChange", (s) => {
        if (s.connected) void handler();
      });
      removeNetworkListener = () => {
        void listener.remove();
      };
    } catch {
      // @capacitor/network indisponible (web) — on garde uniquement les events navigateur.
    }
  })();

  if (!autoWired) {
    window.addEventListener("online", handler);
    autoWired = true;
    // Attempt an initial flush at boot in case network is already up.
    void handler();
    return () => {
      window.removeEventListener("online", handler);
      removeNetworkListener?.();
      autoWired = false;
    };
  }
  window.addEventListener("online", handler);
  return () => {
    window.removeEventListener("online", handler);
    removeNetworkListener?.();
  };
}
