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
}

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  sexe: string | null;
  classe_id: string;
  ecole_id: string;
  user_id: string;
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

export const ecolesQO = () =>
  queryOptions({
    queryKey: ["ecoles"],
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
    queryFn: async (): Promise<Classe[]> => {
      let q = supabase.from("classes").select("*").order("nom");
      if (ecoleId) q = q.eq("ecole_id", ecoleId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Classe[];
    },
  });

export const elevesQO = (classeId?: string) =>
  queryOptions({
    queryKey: ["eleves", classeId ?? "all"],
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
    queryFn: async (): Promise<Periode[]> => {
      const { data, error } = await supabase
        .from("periodes")
        .select("*")
        .order("ordre");
      if (error) throw error;
      return data as Periode[];
    },
  });

export const notesQO = (opts: { classeId?: string; eleveId?: string; periodeId?: string } = {}) =>
  queryOptions({
    queryKey: ["notes", opts.classeId ?? "-", opts.eleveId ?? "-", opts.periodeId ?? "-"],
    queryFn: async (): Promise<Array<Note & { eleve: { nom: string; prenom: string; classe_id: string } | null }>> => {
      let q = supabase
        .from("notes")
        .select("*, eleve:eleves(nom, prenom, classe_id)")
        .order("date", { ascending: false });
      if (opts.eleveId) q = q.eq("eleve_id", opts.eleveId);
      if (opts.periodeId) q = q.eq("periode_id", opts.periodeId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as Array<Note & { eleve: { nom: string; prenom: string; classe_id: string } | null }>;
      if (opts.classeId) rows = rows.filter((r) => r.eleve?.classe_id === opts.classeId);
      return rows;
    },
  });

export const creneauxQO = (opts: { ecoleId?: string; classeId?: string } = {}) =>
  queryOptions({
    queryKey: ["creneaux", opts.ecoleId ?? "-", opts.classeId ?? "-"],
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
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Session expirée");
  return data.user.id;
}
