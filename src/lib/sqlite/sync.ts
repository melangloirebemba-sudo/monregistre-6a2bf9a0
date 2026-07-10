// Sync incrémentale backend → miroir IndexedDB pour les tables pédagogiques.
// Stratégie : on lit la dernière valeur `updated_at` connue en localStorage,
// on récupère toutes les lignes plus récentes, on upsert dans le miroir.
// Un seed complet est réalisé automatiquement si _sync_meta est vide.

import { supabase } from "@/integrations/supabase/client";
import { mirrorUpsert } from "./mirror";
import { SQLITE_TABLES, type SqliteTable } from "./schema";

let syncInFlight: Promise<void> | null = null;
let lastSyncAt = 0;
const META_KEY_PREFIX = "monregistre.idbMirror.lastPulled.";
const PAGE_SIZE = 1000;

function getLastPulled(table: SqliteTable): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(`${META_KEY_PREFIX}${table}`);
  } catch {
    return null;
  }
}

function setLastPulled(table: SqliteTable, ts: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${META_KEY_PREFIX}${table}`, ts);
  } catch {
    /* ignore */
  }
}

async function pullTable(table: SqliteTable): Promise<void> {
  const since = getLastPulled(table);
  let page = 0;
  let maxUpdated = since ?? "";

  while (true) {
    let q = (supabase.from as unknown as (t: string) => any)(table)
      .select("*")
      .order("updated_at", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) break;

    await mirrorUpsert(table, rows);
    maxUpdated = rows.reduce<string>((acc, r) => {
      const u = (r["updated_at"] ?? r["created_at"]) as string | undefined;
      return u && u > acc ? u : acc;
    }, maxUpdated);

    if (rows.length < PAGE_SIZE) break;
    page += 1;
  }

  if (maxUpdated) setLastPulled(table, maxUpdated);
}

/**
 * Synchronise toutes les tables pédagogiques (seed initial ou pull
 * incrémental). Idempotent, coalescé (un seul appel actif à la fois),
 * silencieusement no-op côté serveur et offline.
 */
export async function syncAllTables(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (syncInFlight) return syncInFlight;
  // Throttle : max 1 sync par 20 s sauf force.
  const now = Date.now();
  if (!force && now - lastSyncAt < 20_000) return;
  lastSyncAt = now;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  syncInFlight = (async () => {
    for (const table of SQLITE_TABLES) {
      try {
        await pullTable(table);
      } catch (err) {
        console.warn(`[indexeddb] pull(${table}) failed`, err);
      }
    }
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}
