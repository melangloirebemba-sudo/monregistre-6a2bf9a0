import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mirrorSelect, mirrorUpsert, type SqliteTable } from "@/lib/sqlite";

// Fallback natif hors ligne : lit dans le miroir SQLite si l'appel réseau
// échoue et rejoue les données servies dans le miroir sinon.
async function netThenMirror<T>(
  table: SqliteTable | null,
  net: () => Promise<T>,
  extract: (data: T) => Record<string, unknown>[],
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    const result = await net();
    if (table) {
      const rows = extract(result);
      if (rows.length > 0) void mirrorUpsert(table, rows).catch(() => {});
    }
    return result;
  } catch (err) {
    // Réseau/serveur KO : bascule sur SQLite local si disponible.
    try {
      return await fallback();
    } catch {
      throw err;
    }
  }
}

// Extrait uniquement les colonnes plates (élimine les objets de jointure)
// pour l'upsert dans SQLite.
function stripJoins(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v === null || typeof v !== "object" || Array.isArray(v)) out[k] = v;
    }
    return out;
  });
}

export interface Ecole {
  id: string;
  nom: string;
  numero: string | null;
  adresse: string | null;
  telephone: string | null;
  directeur_etudes: string | null;
  user_id: string;
}

export interface Classe {
  id: string;
  nom: string;
  code: string;
  matiere: string | null;
  effectif: number;
  ecole_id: string;
  user_id: string;
  chef_id: string | null;
  annee_scolaire: string | null;
}


export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  sexe: string | null;
  classe_id: string;
  ecole_id: string;
  user_id: string;
  tuteur_nom: string | null;
  tuteur_numero: string | null;
  adresse: string | null;
  numero_eleve: string | null;
}

export interface Periode {
  id: string;
  label: string;
  ordre: number;
  active: boolean;
  annee_scolaire: string;
  user_id: string;
}

export interface Note {
  id: string;
  libelle: string;
  valeur: number;
  coefficient: number;
  date: string;
  matiere: string | null;
  eleve_id: string;
  ecole_id: string;
  periode_id: string | null;
  sequence_id: string | null;
  user_id: string;
  updated_at: string;
}

export interface Creneau {
  id: string;
  classe_id: string;
  ecole_id: string;
  jour_semaine: number; // 1=Lun ... 7=Dim
  heure_debut: string; // "HH:MM:SS"
  heure_fin: string;
  matiere: string | null;
  salle: string | null;
  user_id: string;
}

export interface Sequence {
  id: string;
  titre: string;
  description: string | null;
  ordre: number;
  semaine_prevue: number | null;
  date_traitee: string | null;
  statut: string; // 'a_venir' | 'en_cours' | 'terminee'
  notes_libres: string | null;
  classe_id: string;
  periode_id: string | null;
  user_id: string;
}
export interface Absence {
  id: string;
  eleve_id: string;
  date: string;
  motif: string | null;
  justifiee: boolean;
  user_id: string;
  updated_at: string;
}

// Cache court des données de référence (auth utilisateur + année active)
// pour éviter d'exécuter les mêmes requêtes en cascade sur chaque appel de
// query. Le cache est invalidé côté client par l'écoute de auth.onAuthStateChange
// dans __root.tsx (queryClient.invalidateQueries) et expire naturellement.
const REF_TTL = 30_000;
let _userIdCache: { value: string | null; at: number; p?: Promise<string | null> } | null = null;
let _anneeCache: { value: string | null; at: number; p?: Promise<string | null> } | null = null;

async function getCachedUserId(): Promise<string | null> {
  const now = Date.now();
  if (_userIdCache && now - _userIdCache.at < REF_TTL) return _userIdCache.value;
  if (_userIdCache?.p) return _userIdCache.p;
  const p = (async () => {
    // getSession() lit le token depuis le localStorage — fonctionne hors ligne.
    // On l'essaie d'abord pour ne jamais bloquer la sauvegarde offline.
    let v: string | null = null;
    try {
      const { data: s } = await supabase.auth.getSession();
      v = s.session?.user?.id ?? null;
    } catch {
      /* ignore */
    }
    if (!v) {
      try {
        const { data } = await supabase.auth.getUser();
        v = data.user?.id ?? null;
      } catch {
        /* offline : on garde v = null */
      }
    }
    _userIdCache = { value: v, at: Date.now() };
    return v;
  })();
  _userIdCache = { value: null, at: 0, p };
  return p;
}

async function getAnneeActive(): Promise<string | null> {
  const now = Date.now();
  if (_anneeCache && now - _anneeCache.at < REF_TTL) return _anneeCache.value;
  if (_anneeCache?.p) return _anneeCache.p;
  const p = (async () => {
    const uid = await getCachedUserId();
    if (!uid) return null;
    const { data } = await supabase
      .from("profils_enseignant")
      .select("annee_active")
      .eq("user_id", uid)
      .maybeSingle();
    const val = (data as { annee_active?: string } | null)?.annee_active;
    const v = val && val.trim() ? val : null;
    _anneeCache = { value: v, at: Date.now() };
    return v;
  })();
  _anneeCache = { value: null, at: 0, p };
  return p;
}

export function invalidateDataRefCache() {
  _userIdCache = null;
  _anneeCache = null;
}

// Fraîcheur par défaut : navigation instantanée entre pages sans refetch systématique.
const DEFAULT_STALE = 2 * 60_000;
// Données de référence rarement modifiées : plus long TTL, moins de refetch inutiles.
const REF_STALE = 10 * 60_000;

// Hydrate les jointures depuis SQLite (eleves/classes/ecoles/periodes)
// pour reproduire la forme attendue par l'UI même hors ligne.
async function hydrateEleveJoin<T extends { eleve_id: string }>(
  rows: T[],
): Promise<Array<T & { eleve: { nom: string; prenom: string; classe_id: string } | null }>> {
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.eleve_id)));
  const eleves = await mirrorSelect<{ id: string; nom: string; prenom: string; classe_id: string }>(
    "eleves",
  );
  const byId = new Map(eleves.filter((e) => ids.includes(e.id)).map((e) => [e.id, e]));
  return rows.map((r) => ({
    ...r,
    eleve: byId.get(r.eleve_id)
      ? {
          nom: byId.get(r.eleve_id)!.nom,
          prenom: byId.get(r.eleve_id)!.prenom,
          classe_id: byId.get(r.eleve_id)!.classe_id,
        }
      : null,
  }));
}

export const absencesQO = (opts: { classeId?: string; eleveId?: string } = {}) =>
  queryOptions({
    queryKey: ["absences", opts.classeId ?? "-", opts.eleveId ?? "-"],
    staleTime: DEFAULT_STALE,
    gcTime: 10 * 60_000,
    queryFn: async () =>
      netThenMirror(
        "absences",
        async () => {
          const rel = opts.classeId
            ? "eleve:eleves!inner(nom, prenom, classe_id)"
            : "eleve:eleves(nom, prenom, classe_id)";
          let q = supabase.from("absences").select(`*, ${rel}`).order("date", { ascending: false });
          if (opts.eleveId) q = q.eq("eleve_id", opts.eleveId);
          if (opts.classeId) q = q.eq("eleve.classe_id", opts.classeId);
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []) as Array<
            Absence & { eleve: { nom: string; prenom: string; classe_id: string } | null }
          >;
        },
        (data) => stripJoins(data as unknown as Record<string, unknown>[]),
        async () => {
          const where: Record<string, unknown> = {};
          if (opts.eleveId) where.eleve_id = opts.eleveId;
          const rows = await mirrorSelect<Absence>("absences", {
            where,
            orderBy: "date",
            orderDir: "DESC",
          });
          const filtered = opts.classeId
            ? (
                await hydrateEleveJoin(rows)
              ).filter((r) => r.eleve?.classe_id === opts.classeId)
            : await hydrateEleveJoin(rows);
          return filtered;
        },
      ),
  });

export const ecolesQO = () =>
  queryOptions({
    queryKey: ["ecoles"],
    staleTime: REF_STALE,
    gcTime: 30 * 60_000,
    queryFn: async () =>
      netThenMirror(
        "ecoles",
        async () => {
          const { data, error } = await supabase.from("ecoles").select("*").order("nom");
          if (error) throw error;
          return data as Ecole[];
        },
        (d) => d as unknown as Record<string, unknown>[],
        async () => mirrorSelect<Ecole>("ecoles", { orderBy: "nom" }),
      ),
  });

export const classesQO = (ecoleId?: string) =>
  queryOptions({
    queryKey: ["classes", ecoleId ?? "all"],
    staleTime: REF_STALE,
    gcTime: 30 * 60_000,
    queryFn: async () =>
      netThenMirror(
        "classes",
        async () => {
          const annee = await getAnneeActive();
          let q = supabase.from("classes").select("*").order("nom");
          if (ecoleId) q = q.eq("ecole_id", ecoleId);
          if (annee) q = q.or(`annee_scolaire.eq.${annee},annee_scolaire.is.null`);
          const { data, error } = await q;
          if (error) throw error;
          return data as Classe[];
        },
        (d) => d as unknown as Record<string, unknown>[],
        async () => {
          const where: Record<string, unknown> = {};
          if (ecoleId) where.ecole_id = ecoleId;
          return mirrorSelect<Classe>("classes", { where, orderBy: "nom" });
        },
      ),
  });

export const elevesQO = (classeId?: string) =>
  queryOptions({
    queryKey: ["eleves", classeId ?? "all"],
    staleTime: DEFAULT_STALE,
    gcTime: 15 * 60_000,
    queryFn: async () =>
      netThenMirror(
        "eleves",
        async () => {
          let q = supabase.from("eleves").select("*").order("nom");
          if (classeId) q = q.eq("classe_id", classeId);
          const { data, error } = await q;
          if (error) throw error;
          return data as Eleve[];
        },
        (d) => d as unknown as Record<string, unknown>[],
        async () => {
          const where: Record<string, unknown> = {};
          if (classeId) where.classe_id = classeId;
          return mirrorSelect<Eleve>("eleves", { where, orderBy: "nom" });
        },
      ),
  });

export const periodesQO = () =>
  queryOptions({
    queryKey: ["periodes"],
    staleTime: REF_STALE,
    gcTime: 30 * 60_000,
    queryFn: async () =>
      netThenMirror(
        "periodes",
        async () => {
          const annee = await getAnneeActive();
          let q = supabase.from("periodes").select("*").order("ordre");
          if (annee) q = q.eq("annee_scolaire", annee);
          const { data, error } = await q;
          if (error) throw error;
          return data as Periode[];
        },
        (d) => d as unknown as Record<string, unknown>[],
        async () => mirrorSelect<Periode>("periodes", { orderBy: "ordre" }),
      ),
  });

export const notesQO = (opts: { classeId?: string; eleveId?: string; periodeId?: string } = {}) =>
  queryOptions({
    queryKey: ["notes", opts.classeId ?? "-", opts.eleveId ?? "-", opts.periodeId ?? "-"],
    staleTime: DEFAULT_STALE,
    queryFn: async () =>
      netThenMirror(
        "notes",
        async () => {
          const rel = opts.classeId
            ? "eleve:eleves!inner(nom, prenom, classe_id)"
            : "eleve:eleves(nom, prenom, classe_id)";
          let q = supabase.from("notes").select(`*, ${rel}`).order("date", { ascending: false });
          if (opts.eleveId) q = q.eq("eleve_id", opts.eleveId);
          if (opts.periodeId) q = q.eq("periode_id", opts.periodeId);
          if (opts.classeId) q = q.eq("eleve.classe_id", opts.classeId);
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []) as Array<
            Note & { eleve: { nom: string; prenom: string; classe_id: string } | null }
          >;
        },
        (data) => stripJoins(data as unknown as Record<string, unknown>[]),
        async () => {
          const where: Record<string, unknown> = {};
          if (opts.eleveId) where.eleve_id = opts.eleveId;
          if (opts.periodeId) where.periode_id = opts.periodeId;
          const rows = await mirrorSelect<Note>("notes", {
            where,
            orderBy: "date",
            orderDir: "DESC",
          });
          const hydrated = await hydrateEleveJoin(rows);
          return opts.classeId
            ? hydrated.filter((r) => r.eleve?.classe_id === opts.classeId)
            : hydrated;
        },
      ),
  });

export const creneauxQO = (opts: { ecoleId?: string; classeId?: string } = {}) =>
  queryOptions({
    queryKey: ["creneaux", opts.ecoleId ?? "-", opts.classeId ?? "-"],
    staleTime: REF_STALE,
    gcTime: 30 * 60_000,
    queryFn: async () =>
      netThenMirror(
        "creneaux",
        async () => {
          let q = supabase
            .from("creneaux")
            .select("*, classe:classes(nom, code), ecole:ecoles(nom)")
            .order("jour_semaine")
            .order("heure_debut");
          if (opts.ecoleId) q = q.eq("ecole_id", opts.ecoleId);
          if (opts.classeId) q = q.eq("classe_id", opts.classeId);
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []) as Array<
            Creneau & {
              classe: { nom: string; code: string } | null;
              ecole: { nom: string } | null;
            }
          >;
        },
        (d) => stripJoins(d as unknown as Record<string, unknown>[]),
        async () => {
          const where: Record<string, unknown> = {};
          if (opts.ecoleId) where.ecole_id = opts.ecoleId;
          if (opts.classeId) where.classe_id = opts.classeId;
          const rows = await mirrorSelect<Creneau>("creneaux", {
            where,
            orderBy: "jour_semaine",
          });
          const classes = await mirrorSelect<Classe>("classes");
          const ecoles = await mirrorSelect<Ecole>("ecoles");
          const cById = new Map(classes.map((c) => [c.id, c]));
          const eById = new Map(ecoles.map((e) => [e.id, e]));
          return rows.map((r) => ({
            ...r,
            classe: cById.get(r.classe_id)
              ? { nom: cById.get(r.classe_id)!.nom, code: cById.get(r.classe_id)!.code }
              : null,
            ecole: eById.get(r.ecole_id) ? { nom: eById.get(r.ecole_id)!.nom } : null,
          }));
        },
      ),
  });

export const sequencesQO = (opts: { classeId?: string; periodeId?: string } = {}) =>
  queryOptions({
    queryKey: ["sequences", opts.classeId ?? "-", opts.periodeId ?? "-"],
    staleTime: DEFAULT_STALE,
    queryFn: async () =>
      netThenMirror(
        "sequences_programme",
        async () => {
          let q = supabase
            .from("sequences_programme")
            .select("*, classe:classes(nom, code, ecole_id), periode:periodes(label)")
            .order("ordre");
          if (opts.classeId) q = q.eq("classe_id", opts.classeId);
          if (opts.periodeId) q = q.eq("periode_id", opts.periodeId);
          const { data, error } = await q;
          if (error) throw error;
          return (data ?? []) as Array<
            Sequence & {
              classe: { nom: string; code: string; ecole_id: string } | null;
              periode: { label: string } | null;
            }
          >;
        },
        (d) => stripJoins(d as unknown as Record<string, unknown>[]),
        async () => {
          const where: Record<string, unknown> = {};
          if (opts.classeId) where.classe_id = opts.classeId;
          if (opts.periodeId) where.periode_id = opts.periodeId;
          const rows = await mirrorSelect<Sequence>("sequences_programme", {
            where,
            orderBy: "ordre",
          });
          const classes = await mirrorSelect<Classe>("classes");
          const periodes = await mirrorSelect<Periode>("periodes");
          const cById = new Map(classes.map((c) => [c.id, c]));
          const pById = new Map(periodes.map((p) => [p.id, p]));
          return rows.map((r) => ({
            ...r,
            classe: cById.get(r.classe_id)
              ? {
                  nom: cById.get(r.classe_id)!.nom,
                  code: cById.get(r.classe_id)!.code,
                  ecole_id: cById.get(r.classe_id)!.ecole_id,
                }
              : null,
            periode: r.periode_id && pById.get(r.periode_id)
              ? { label: pById.get(r.periode_id)!.label }
              : null,
          }));
        },
      ),
  });

export async function requireUserId(): Promise<string> {
  const uid = await getCachedUserId();
  if (!uid) throw new Error("Session expirée");
  return uid;
}
