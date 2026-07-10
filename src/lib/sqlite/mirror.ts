// Miroir local IndexedDB-first.
// On conserve les mêmes exports que l'ancien miroir SQLite afin que les
// queries, la file hors-ligne et l'UI restent inchangées. IndexedDB fonctionne
// dans le navigateur, la PWA et la WebView mobile sans dépendre du plugin natif.

import type { SqliteTable } from "./schema";

// Colonnes miroir par table (dans l'ordre du INSERT). L'ordre importe :
// la clause VALUES suit la même séquence.
const TABLE_COLUMNS: Record<SqliteTable, string[]> = {
  ecoles: ["id", "user_id", "nom", "numero", "adresse", "telephone", "directeur_etudes", "created_at", "updated_at"],
  classes: ["id", "user_id", "ecole_id", "nom", "code", "matiere", "effectif", "chef_id", "annee_scolaire", "created_at", "updated_at"],
  eleves: ["id", "user_id", "ecole_id", "classe_id", "nom", "prenom", "sexe", "tuteur_nom", "tuteur_numero", "adresse", "numero_eleve", "created_at", "updated_at"],
  periodes: ["id", "user_id", "label", "ordre", "active", "annee_scolaire", "created_at", "updated_at"],
  creneaux: ["id", "user_id", "ecole_id", "classe_id", "jour_semaine", "heure_debut", "heure_fin", "matiere", "salle", "created_at", "updated_at"],
  sequences_programme: ["id", "user_id", "classe_id", "periode_id", "titre", "description", "ordre", "semaine_prevue", "date_traitee", "statut", "notes_libres", "created_at", "updated_at"],
  notes: ["id", "user_id", "ecole_id", "eleve_id", "periode_id", "sequence_id", "libelle", "matiere", "valeur", "coefficient", "date", "created_at", "updated_at"],
  absences: ["id", "user_id", "eleve_id", "date", "motif", "justifiee", "created_at", "updated_at"],
  annees_scolaires: ["id", "user_id", "libelle", "date_debut", "date_fin", "active", "archived", "created_at", "updated_at"],
};

const BOOL_COLUMNS = new Set(["active", "justifiee", "archived"]);

const DB_NAME = "monregistre-local-mirror";
const DB_VERSION = 1;
const STORE = "rows";

interface StoredMirrorRow {
  key: string;
  table: SqliteTable;
  id: string;
  row: Record<string, unknown>;
}

function rowKey(table: SqliteTable, id: string): string {
  return `${table}:${id}`;
}

function openMirrorDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("table", "table");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function toSqlValue(col: string, v: unknown): unknown {
  if (v === undefined) return null;
  if (v === null) return null;
  if (BOOL_COLUMNS.has(col)) return v ? 1 : 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

function fromSqlRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const col of Object.keys(out)) {
    if (BOOL_COLUMNS.has(col) && (out[col] === 0 || out[col] === 1)) {
      out[col] = out[col] === 1;
    }
  }
  return out as T;
}

/** Upsert d'un lot de lignes reçues du serveur dans le miroir SQLite. */
export async function mirrorUpsert(
  table: SqliteTable,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const db = await openMirrorDb();
    const cols = TABLE_COLUMNS[table];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB mirror upsert failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB mirror upsert aborted"));

      for (const row of rows) {
        const id = row.id;
        if (typeof id !== "string" || !id) continue;
        const normalized: Record<string, unknown> = {};
        for (const col of cols) normalized[col] = toSqlValue(col, row[col]);
        const item: StoredMirrorRow = {
          key: rowKey(table, id),
          table,
          id,
          row: normalized,
        };
        store.put(item);
      }
    });
  } catch (err) {
    console.warn(`[indexeddb] mirrorUpsert(${table}) failed`, err);
  }
}

/** Supprime une ligne du miroir (utile après un delete réussi côté serveur). */
export async function mirrorDelete(table: SqliteTable, id: string): Promise<void> {
  try {
    const db = await openMirrorDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(rowKey(table, id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB mirror delete failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB mirror delete aborted"));
    });
  } catch (err) {
    console.warn(`[indexeddb] mirrorDelete(${table}) failed`, err);
  }
}

async function readTableRows(table: SqliteTable): Promise<Record<string, unknown>[]> {
  try {
    const db = await openMirrorDb();
    return await new Promise((resolve, reject) => {
      const rows: Record<string, unknown>[] = [];
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("table").openCursor(IDBKeyRange.only(table));
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) {
          resolve(rows);
          return;
        }
        const item = cur.value as StoredMirrorRow;
        rows.push(fromSqlRow(item.row));
        cur.continue();
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB mirror read failed"));
    });
  } catch (err) {
    console.warn(`[indexeddb] readTableRows(${table}) failed`, err);
    return [];
  }
}

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined || v === null) continue;
    if (row[k] !== toSqlValue(k, v)) return false;
  }
  return true;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
}

/** Sélection générique — used by les read-fallbacks dans data.ts. */
export async function mirrorSelect<T>(
  table: SqliteTable,
  opts: {
    where?: Record<string, unknown>;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
  } = {},
): Promise<T[]> {
  let rows = await readTableRows(table);
  rows = rows.filter((row) => matchesWhere(row, opts.where ?? {}));
  if (opts.orderBy) {
    const dir = opts.orderDir === "DESC" ? -1 : 1;
    rows = rows.slice().sort((a, b) => compareValues(a[opts.orderBy!], b[opts.orderBy!]) * dir);
  }
  return rows as T[];
}

export async function sqliteHasData(table: SqliteTable): Promise<boolean> {
  const rows = await mirrorSelect(table);
  return rows.length > 0;
}
