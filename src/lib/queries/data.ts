import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    const { data } = await supabase.auth.getUser();
    const v = data.user?.id ?? null;
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

export const absencesQO = (opts: { classeId?: string; eleveId?: string } = {}) =>
  queryOptions({
    queryKey: ["absences", opts.classeId ?? "-", opts.eleveId ?? "-"],
    staleTime: DEFAULT_STALE,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<
      Array<Absence & { eleve: { nom: string; prenom: string; classe_id: string } | null }>
    > => {
      // Filtre côté DB via jointure inner quand une classe est demandée.
      const rel = opts.classeId ? "eleve:eleves!inner(nom, prenom, classe_id)" : "eleve:eleves(nom, prenom, classe_id)";
      let q = supabase
        .from("absences")
        .select(`*, ${rel}`)
        .order("date", { ascending: false });
      if (opts.eleveId) q = q.eq("eleve_id", opts.eleveId);
      if (opts.classeId) q = q.eq("eleve.classe_id", opts.classeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<
        Absence & { eleve: { nom: string; prenom: string; classe_id: string } | null }
      >;
    },
  });


export const ecolesQO = () =>
  queryOptions({
    queryKey: ["ecoles"],
    staleTime: REF_STALE,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<Ecole[]> => {
      const { data, error } = await supabase
        .from("ecoles")
        .select("*")
        .order("nom");
      if (error) throw error;
      return data as Ecole[];
    },
  });

export const classesQO = (ecoleId?: string) =>
  queryOptions({
    queryKey: ["classes", ecoleId ?? "all"],
    staleTime: REF_STALE,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<Classe[]> => {
      const annee = await getAnneeActive();
      let q = supabase.from("classes").select("*").order("nom");
      if (ecoleId) q = q.eq("ecole_id", ecoleId);
      if (annee) q = q.or(`annee_scolaire.eq.${annee},annee_scolaire.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return data as Classe[];
    },
  });

export const elevesQO = (classeId?: string) =>
  queryOptions({
    queryKey: ["eleves", classeId ?? "all"],
    staleTime: DEFAULT_STALE,
    gcTime: 15 * 60_000,
    queryFn: async (): Promise<Eleve[]> => {
      let q = supabase.from("eleves").select("*").order("nom");
      if (classeId) q = q.eq("classe_id", classeId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Eleve[];
    },
  });

export const periodesQO = () =>
  queryOptions({
    queryKey: ["periodes"],
    staleTime: REF_STALE,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<Periode[]> => {
      const annee = await getAnneeActive();
      let q = supabase.from("periodes").select("*").order("ordre");
      if (annee) q = q.eq("annee_scolaire", annee);
      const { data, error } = await q;
      if (error) throw error;
      return data as Periode[];
    },
  });



export const notesQO = (opts: { classeId?: string; eleveId?: string; periodeId?: string } = {}) =>
  queryOptions({
    queryKey: ["notes", opts.classeId ?? "-", opts.eleveId ?? "-", opts.periodeId ?? "-"],
    staleTime: DEFAULT_STALE,
    queryFn: async (): Promise<Array<Note & { eleve: { nom: string; prenom: string; classe_id: string } | null }>> => {
      const rel = opts.classeId ? "eleve:eleves!inner(nom, prenom, classe_id)" : "eleve:eleves(nom, prenom, classe_id)";
      let q = supabase
        .from("notes")
        .select(`*, ${rel}`)
        .order("date", { ascending: false });
      if (opts.eleveId) q = q.eq("eleve_id", opts.eleveId);
      if (opts.periodeId) q = q.eq("periode_id", opts.periodeId);
      if (opts.classeId) q = q.eq("eleve.classe_id", opts.classeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<Note & { eleve: { nom: string; prenom: string; classe_id: string } | null }>;
    },
  });

export const creneauxQO = (opts: { ecoleId?: string; classeId?: string } = {}) =>
  queryOptions({
    queryKey: ["creneaux", opts.ecoleId ?? "-", opts.classeId ?? "-"],
    staleTime: DEFAULT_STALE,
    queryFn: async (): Promise<Array<Creneau & { classe: { nom: string; code: string } | null; ecole: { nom: string } | null }>> => {
      let q = supabase
        .from("creneaux")
        .select("*, classe:classes(nom, code), ecole:ecoles(nom)")
        .order("jour_semaine")
        .order("heure_debut");
      if (opts.ecoleId) q = q.eq("ecole_id", opts.ecoleId);
      if (opts.classeId) q = q.eq("classe_id", opts.classeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<Creneau & { classe: { nom: string; code: string } | null; ecole: { nom: string } | null }>;
    },
  });

export const sequencesQO = (opts: { classeId?: string; periodeId?: string } = {}) =>
  queryOptions({
    queryKey: ["sequences", opts.classeId ?? "-", opts.periodeId ?? "-"],
    staleTime: DEFAULT_STALE,
    queryFn: async (): Promise<Array<Sequence & { classe: { nom: string; code: string; ecole_id: string } | null; periode: { label: string } | null }>> => {
      let q = supabase
        .from("sequences_programme")
        .select("*, classe:classes(nom, code, ecole_id), periode:periodes(label)")
        .order("ordre");
      if (opts.classeId) q = q.eq("classe_id", opts.classeId);
      if (opts.periodeId) q = q.eq("periode_id", opts.periodeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<Sequence & { classe: { nom: string; code: string; ecole_id: string } | null; periode: { label: string } | null }>;
    },
  });

export async function requireUserId(): Promise<string> {
  const uid = await getCachedUserId();
  if (!uid) throw new Error("Session expirée");
  return uid;
}
