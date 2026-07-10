// Offline write queue backed by IndexedDB.
// Enqueues Supabase writes when offline and flushes them when the connection returns.
//
// Usage (adopter progressively in mutation sites):
//   import { enqueueWrite } from "@/lib/offline-queue";
//   await enqueueWrite({ table: "eleves", op: "insert", payload: { nom, prenom } });
//
// The queue is per-user (scoped by auth user id) and survives reloads.

import { supabase } from "@/integrations/supabase/client";
import { isSimulatedOffline } from "@/lib/simulated-offline";


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
type MutationListener = (table: string) => void;
const listeners = new Set<Listener>();
const conflictListeners = new Set<ConflictListener>();
const mutationListeners = new Set<MutationListener>();
let syncing = false;
let flushChain: Promise<void> = Promise.resolve();

export type FlushItemStatus = "pending" | "running" | "ok" | "failed";

export interface FlushItemSnapshot {
  id: string;
  table: string;
  op: QueueOp;
  label?: string;
  createdAt: number;
  status: FlushItemStatus;
  attempts: number;
  lastError?: string;
}

export interface FlushProgress {
  active: boolean;
  total: number;
  done: number;
  failed: number;
  /** Item en cours de traitement */
  currentId?: string;
  currentTable?: string;
  currentOp?: QueueOp;
  currentLabel?: string;
  /** Dernière erreur non-réseau observée dans le cycle */
  lastError?: string;
  lastErrorTable?: string;
  /** Liste des écritures traitées ou en attente durant le cycle courant */
  items: FlushItemSnapshot[];
}

let flushProgress: FlushProgress = { active: false, total: 0, done: 0, failed: 0, items: [] };

export function getFlushProgress(): FlushProgress {
  return flushProgress;
}

function notify() {
  for (const l of listeners) l();
}

function notifyConflict(e: ConflictEvent) {
  for (const l of conflictListeners) l(e);
}

function notifyMutation(table: string) {
  for (const l of mutationListeners) l(table);
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

export function subscribeQueueMutation(fn: MutationListener): () => void {
  mutationListeners.add(fn);
  return () => {
    mutationListeners.delete(fn);
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

/**
 * Retourne `true` si au moins une écriture est encore en attente pour la table.
 * Utilisé côté lecture pour préférer le miroir SQLite (qui contient l'écriture
 * optimiste) tant que le serveur n'a pas confirmé.
 */
export async function hasPendingForTable(table: string): Promise<boolean> {
  const items = await listQueue();
  return items.some((it) => it.table === table);
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
  // Optimistic local mirror : injecte immédiatement dans IndexedDB pour que les
  // listes affichent la donnée comme si le serveur avait répondu.
  const enriched = await applyOptimisticMirror(input, userId);
  const item: QueuedWrite = {
    id: makeId(),
    createdAt: Date.now(),
    userId,
    attempts: 0,
    ...enriched,
  };
  await putItem(item);
  notify();
  notifyMutation(input.table);
  return { queued: true, id: item.id };
}

/**
 * Applique l'écriture au miroir IndexedDB avant que le serveur ne réponde.
 * Retourne l'input possiblement enrichi (id/user_id/timestamps générés
 * côté client) afin que le rejeu envoie exactement la même ligne.
 */
async function applyOptimisticMirror(
  input: EnqueueInput,
  userId: string | null,
): Promise<EnqueueInput> {
  if (!MIRRORED_TABLES.has(input.table)) return input;
  try {
    const mod = await import("@/lib/sqlite");
    const now = new Date().toISOString();
    if (input.op === "insert") {
      const payload: Record<string, unknown> = { ...(input.payload ?? {}) };
      if (!payload.id) {
        payload.id = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : makeId();
      }
      if (!payload.user_id && userId) payload.user_id = userId;
      if (!payload.created_at) payload.created_at = now;
      if (!payload.updated_at) payload.updated_at = now;
      await mod.mirrorUpsert(input.table as any, [payload]);
      return { ...input, payload };
    }
    if (input.op === "update") {
      const id = (input.match?.id as string | undefined) ?? (input.payload?.id as string | undefined);
      if (id) {
        // Fusionne avec la ligne existante pour ne pas écraser les colonnes absentes.
        const rows = await mod.mirrorSelect<Record<string, unknown>>(input.table as any, { where: { id } });
        const existing = rows[0] ?? {};
        const merged = { ...existing, ...(input.payload ?? {}), id, updated_at: now };
        await mod.mirrorUpsert(input.table as any, [merged]);
      }
      return input;
    }
    if (input.op === "delete") {
      const id = input.match?.id as string | undefined;
      if (id) await mod.mirrorDelete(input.table as any, id);
      return input;
    }
  } catch {
    /* IndexedDB indisponible — silencieux. */
  }
  return input;
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

// Propage l'écriture serveur au miroir IndexedDB local.
// No-op si la table n'est pas mirrorée.
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
    // IndexedDB indisponible — silencieux.
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

// Retry avec backoff exponentiel quand un flush se termine avec des échecs
// non-réseau ou est interrompu par une coupure. Redémarré à chaque nouvel
// évènement online / networkStatusChange.
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 0;
const RETRY_MIN = 5_000;
const RETRY_MAX = 60_000;

function scheduleRetry(reason: "network" | "error") {
  if (typeof window === "undefined") return;
  if (retryTimer) clearTimeout(retryTimer);
  retryDelay = retryDelay === 0 ? RETRY_MIN : Math.min(retryDelay * 2, RETRY_MAX);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      // pas de réseau : on attendra l'event 'online'
      return;
    }
    void flushQueue();
  }, retryDelay);
  void reason;
}

function resetRetryBackoff() {
  retryDelay = 0;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

async function doFlush(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const items = await listQueue();
  if (items.length === 0) {
    resetRetryBackoff();
    return;
  }

  syncing = true;
  const startedAt = Date.now();
  const total = items.length;
  let done = 0;
  let failed = 0;
  let interruptedByNetwork = false;
  const snapshots: FlushItemSnapshot[] = items.map((it) => ({
    id: it.id,
    table: it.table,
    op: it.op,
    label: it.label,
    createdAt: it.createdAt,
    attempts: it.attempts,
    lastError: it.lastError,
    status: it.attempts > 0 && it.lastError ? "failed" : "pending",
  }));
  const updateSnap = (id: string, patch: Partial<FlushItemSnapshot>) => {
    const idx = snapshots.findIndex((s) => s.id === id);
    if (idx >= 0) snapshots[idx] = { ...snapshots[idx], ...patch };
  };
  flushProgress = { active: true, total, done, failed, items: snapshots.slice() };
  notify();
  try {
    for (const item of items) {
      updateSnap(item.id, { status: "running" });
      flushProgress = {
        ...flushProgress,
        currentId: item.id,
        currentTable: item.table,
        currentOp: item.op,
        currentLabel: item.label,
        items: snapshots.slice(),
      };
      notify();
      try {
        await runWrite(item);
        await removeItem(item.id);
        done += 1;
        updateSnap(item.id, { status: "ok" });
        flushProgress = { ...flushProgress, done, items: snapshots.slice() };
        notify();
      } catch (err) {
        if (isNetworkError(err)) {
          interruptedByNetwork = true;
          updateSnap(item.id, { status: "pending" });
          flushProgress = { ...flushProgress, items: snapshots.slice() };
          notify();
          break;
        }
        const message = err instanceof Error ? err.message : String(err);
        const next: QueuedWrite = {
          ...item,
          attempts: item.attempts + 1,
          lastError: message,
        };
        if (next.attempts >= 5) {
          await removeItem(item.id);
        } else {
          await putItem(next);
        }
        failed += 1;
        updateSnap(item.id, {
          status: "failed",
          attempts: next.attempts,
          lastError: message,
        });
        flushProgress = {
          ...flushProgress,
          failed,
          lastError: message,
          lastErrorTable: item.table,
          items: snapshots.slice(),
        };
        notify();
      }
    }
  } finally {
    syncing = false;
    flushProgress = {
      ...flushProgress,
      active: false,
      currentId: undefined,
      currentTable: undefined,
      currentOp: undefined,
      currentLabel: undefined,
    };
    recordSyncHistory({ startedAt, finishedAt: Date.now(), total, done, failed });
    notify();
  }

  // Planifie un retry si des lignes restent à envoyer.
  const remaining = await pendingCount();
  if (remaining > 0) {
    scheduleRetry(interruptedByNetwork ? "network" : "error");
  } else {
    resetRetryBackoff();
  }
}


export interface SyncHistoryEntry {
  startedAt: number;
  finishedAt: number;
  total: number;
  done: number;
  failed: number;
}

const HISTORY_KEY = "monregistre.syncHistory";
const HISTORY_MAX = 10;

export function readSyncHistory(): SyncHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SyncHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearSyncHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
    notify();
  } catch {
    /* ignore */
  }
}

function recordSyncHistory(entry: SyncHistoryEntry) {
  if (typeof localStorage === "undefined") return;
  try {
    const cur = readSyncHistory();
    const next = [entry, ...cur].slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

let autoWired = false;
export function wireOfflineAutoFlush(onFlushed?: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = async () => {
    resetRetryBackoff();
    await flushQueue();
    onFlushed?.();
  };
  const visibilityHandler = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      void handler();
    }
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

  const attach = () => {
    window.addEventListener("online", handler);
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", visibilityHandler);
  };
  const detach = () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("focus", handler);
    document.removeEventListener("visibilitychange", visibilityHandler);
    removeNetworkListener?.();
  };

  if (!autoWired) {
    attach();
    autoWired = true;
    // Attempt an initial flush at boot in case network is already up.
    void handler();
    return () => {
      detach();
      autoWired = false;
    };
  }
  attach();
  return detach;
}

