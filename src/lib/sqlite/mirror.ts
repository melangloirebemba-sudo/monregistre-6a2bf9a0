// Upsert / read helpers pour le miroir SQLite local.
// Chaque table est stockée avec les colonnes déclarées dans schema.ts.
// Les valeurs booléennes sont converties en 0/1 pour SQLite.

import { getDb, sqliteQuery, isSqliteAvailable } from "./db";
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
  if (!(await isSqliteAvailable()) || rows.length === 0) return;
  const db = await getDb();
  if (!db) return;
  const cols = TABLE_COLUMNS[table];
  const placeholders = cols.map(() => "?").join(",");
  const updateSet = cols
    .filter((c) => c !== "id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})
               ON CONFLICT(id) DO UPDATE SET ${updateSet}`;
  try {
    for (const row of rows) {
      const values = cols.map((c) => toSqlValue(c, row[c]));
      await db.run(sql, values);
    }
  } catch (err) {
    console.warn(`[sqlite] mirrorUpsert(${table}) failed`, err);
  }
}

/** Supprime une ligne du miroir (utile après un delete réussi côté serveur). */
export async function mirrorDelete(table: SqliteTable, id: string): Promise<void> {
  if (!(await isSqliteAvailable())) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  } catch (err) {
    console.warn(`[sqlite] mirrorDelete(${table}) failed`, err);
  }
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
  const clauses: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(opts.where ?? {})) {
    if (v === undefined || v === null) continue;
    clauses.push(`${k} = ?`);
    values.push(toSqlValue(k, v));
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderSql = opts.orderBy ? `ORDER BY ${opts.orderBy} ${opts.orderDir ?? "ASC"}` : "";
  const rows = await sqliteQuery<T>(
    `SELECT * FROM ${table} ${whereSql} ${orderSql}`,
    values,
  );
  return rows.map((r) => fromSqlRow(r as unknown as Record<string, unknown>)) as unknown as T[];
}

export async function sqliteHasData(table: SqliteTable): Promise<boolean> {
  const rows = await sqliteQuery<{ n: number }>(`SELECT COUNT(*) as n FROM ${table}`);
  return (rows[0]?.n ?? 0) > 0;
}
