// Sync incrémentale Supabase → SQLite pour les tables pédagogiques.
// Stratégie : on lit la dernière valeur `updated_at` connue dans _sync_meta,
// on récupère toutes les lignes plus récentes, on upsert dans le miroir.
// Un seed complet est réalisé automatiquement si _sync_meta est vide.

import { supabase } from "@/integrations/supabase/client";
import { getDb, isSqliteAvailable, sqliteQuery, sqliteRun } from "./db";
import { mirrorUpsert } from "./mirror";
import { SQLITE_TABLES, type SqliteTable } from "./schema";

let syncInFlight: Promise<void> | null = null;
let lastSyncAt = 0;

async function getLastPulled(table: SqliteTable): Promise<string | null> {
  const rows = await sqliteQuery<{ last_pulled_at: string | null }>(
    `SELECT last_pulled_at FROM _sync_meta WHERE table_name = ?`,
    [table],
  );
  return rows[0]?.last_pulled_at ?? null;
}

async function setLastPulled(table: SqliteTable, ts: string): Promise<void> {
  await sqliteRun(
    `INSERT INTO _sync_meta (table_name, last_pulled_at) VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    [table, ts],
  );
}

async function pullTable(table: SqliteTable): Promise<void> {
  const since = await getLastPulled(table);
  let q = (supabase.from as unknown as (t: string) => any)(table)
    .select("*")
    .order("updated_at", { ascending: true })
    .limit(1000);
  if (since) q = q.gt("updated_at", since);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return;
  await mirrorUpsert(table, rows);
  const maxUpdated = rows.reduce<string>((acc, r) => {
    const u = (r["updated_at"] ?? r["created_at"]) as string | undefined;
    return u && u > acc ? u : acc;
  }, since ?? "");
  if (maxUpdated) await setLastPulled(table, maxUpdated);
}

/**
 * Synchronise toutes les tables pédagogiques (seed initial ou pull
 * incrémental). Idempotent, coalescé (un seul appel actif à la fois),
 * silencieusement no-op sur web / PWA.
 */
export async function syncAllTables(force = false): Promise<void> {
  if (!(await isSqliteAvailable())) return;
  const db = await getDb();
  if (!db) return;
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
        console.warn(`[sqlite] pull(${table}) failed`, err);
      }
    }
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}
