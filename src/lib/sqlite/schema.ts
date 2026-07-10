// Schéma SQLite miroir des tables pédagogiques Supabase.
// Toutes les colonnes sont en TEXT (avec quelques INTEGER/REAL) : SQLite est
// dynamiquement typé, on préfère la simplicité et éviter les conversions.
// Les booléens sont stockés en INTEGER (0/1), les dates en ISO string.

export const SQLITE_SCHEMA_VERSION = 1;

export const SQLITE_TABLES = [
  "ecoles",
  "classes",
  "eleves",
  "periodes",
  "creneaux",
  "sequences_programme",
  "notes",
  "absences",
  "annees_scolaires",
] as const;

export type SqliteTable = (typeof SQLITE_TABLES)[number];

export const SQLITE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS _sync_meta (
     table_name TEXT PRIMARY KEY,
     last_pulled_at TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS ecoles (
     id TEXT PRIMARY KEY, user_id TEXT, nom TEXT, numero TEXT,
     adresse TEXT, telephone TEXT, directeur_etudes TEXT,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS classes (
     id TEXT PRIMARY KEY, user_id TEXT, ecole_id TEXT, nom TEXT, code TEXT,
     matiere TEXT, effectif INTEGER, chef_id TEXT, annee_scolaire TEXT,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_classes_ecole ON classes(ecole_id)`,
  `CREATE TABLE IF NOT EXISTS eleves (
     id TEXT PRIMARY KEY, user_id TEXT, ecole_id TEXT, classe_id TEXT,
     nom TEXT, prenom TEXT, sexe TEXT, tuteur_nom TEXT, tuteur_numero TEXT,
     adresse TEXT, numero_eleve TEXT,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_eleves_classe ON eleves(classe_id)`,
  `CREATE INDEX IF NOT EXISTS idx_eleves_ecole ON eleves(ecole_id)`,
  `CREATE TABLE IF NOT EXISTS periodes (
     id TEXT PRIMARY KEY, user_id TEXT, label TEXT, ordre INTEGER,
     active INTEGER, annee_scolaire TEXT,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS creneaux (
     id TEXT PRIMARY KEY, user_id TEXT, ecole_id TEXT, classe_id TEXT,
     jour_semaine INTEGER, heure_debut TEXT, heure_fin TEXT,
     matiere TEXT, salle TEXT,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_creneaux_classe ON creneaux(classe_id)`,
  `CREATE TABLE IF NOT EXISTS sequences_programme (
     id TEXT PRIMARY KEY, user_id TEXT, classe_id TEXT, periode_id TEXT,
     titre TEXT, description TEXT, ordre INTEGER, semaine_prevue INTEGER,
     date_traitee TEXT, statut TEXT, notes_libres TEXT,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sequences_classe ON sequences_programme(classe_id)`,
  `CREATE TABLE IF NOT EXISTS notes (
     id TEXT PRIMARY KEY, user_id TEXT, ecole_id TEXT, eleve_id TEXT,
     periode_id TEXT, sequence_id TEXT, libelle TEXT, matiere TEXT,
     valeur REAL, coefficient REAL, date TEXT,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_notes_eleve ON notes(eleve_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_periode ON notes(periode_id)`,
  `CREATE TABLE IF NOT EXISTS absences (
     id TEXT PRIMARY KEY, user_id TEXT, eleve_id TEXT,
     date TEXT, motif TEXT, justifiee INTEGER,
     created_at TEXT, updated_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_absences_eleve ON absences(eleve_id)`,
  `CREATE TABLE IF NOT EXISTS annees_scolaires (
     id TEXT PRIMARY KEY, user_id TEXT, libelle TEXT, date_debut TEXT,
     date_fin TEXT, active INTEGER, archived INTEGER,
     created_at TEXT, updated_at TEXT
   )`,
];
