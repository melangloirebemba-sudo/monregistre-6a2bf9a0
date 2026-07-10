// SQLite (Android natif) — singleton de connexion + init/migrations.
// Sur web / PWA : désactivé (retourne null), la lecture s'appuie sur le
// cache TanStack Query persisté dans IndexedDB.

import { SQLITE_DDL, SQLITE_SCHEMA_VERSION } from "./schema";

// Type minimal — évite d'importer les types plugin dans le bundle web.
type DBConnection = {
  open: () => Promise<void>;
  execute: (statements: string) => Promise<unknown>;
  query: (statement: string, values?: unknown[]) => Promise<{ values?: Record<string, unknown>[] }>;
  run: (
    statement: string,
    values?: unknown[],
  ) => Promise<{ changes?: { changes?: number; lastId?: number } }>;
  close: () => Promise<void>;
};

let dbPromise: Promise<DBConnection | null> | null = null;
let nativeChecked = false;
let isNative = false;

export async function isSqliteAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (nativeChecked) return isNative;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
  } catch {
    isNative = false;
  }
  nativeChecked = true;
  return isNative;
}

const DB_NAME = "monregistre";

async function openConnection(): Promise<DBConnection | null> {
  if (!(await isSqliteAvailable())) return null;
  try {
    const mod = await import("@capacitor-community/sqlite");
    const sqlite = new mod.SQLiteConnection(mod.CapacitorSQLite);
    // Certaines versions exigent un check de connexion existante
    const consistent = await sqlite
      .checkConnectionsConsistency()
      .catch(() => ({ result: false }));
    const hasConn = await sqlite.isConnection(DB_NAME, false).catch(() => ({ result: false }));
    let db: DBConnection;
    if (consistent.result && hasConn.result) {
      db = (await sqlite.retrieveConnection(DB_NAME, false)) as unknown as DBConnection;
    } else {
      db = (await sqlite.createConnection(
        DB_NAME,
        false,
        "no-encryption",
        SQLITE_SCHEMA_VERSION,
        false,
      )) as unknown as DBConnection;
    }
    await db.open();
    // Applique le schéma (idempotent grâce à IF NOT EXISTS).
    for (const stmt of SQLITE_DDL) {
      await db.execute(stmt);
    }
    return db;
  } catch (err) {
    console.warn("[sqlite] init failed, falling back to network-only reads", err);
    return null;
  }
}

export function getDb(): Promise<DBConnection | null> {
  if (!dbPromise) dbPromise = openConnection();
  return dbPromise;
}

export async function sqliteQuery<T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const res = await db.query(sql, values);
    return (res.values ?? []) as T[];
  } catch (err) {
    console.warn("[sqlite] query failed", sql, err);
    return [];
  }
}

export async function sqliteRun(sql: string, values: unknown[] = []): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.run(sql, values);
  } catch (err) {
    console.warn("[sqlite] run failed", sql, err);
  }
}

export async function sqliteExec(statements: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(statements);
  } catch (err) {
    console.warn("[sqlite] exec failed", err);
  }
}
