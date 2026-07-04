import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Profil {
  id: string;
  user_id: string;
  nom_affiche: string;
  initiales: string;
  echelle_notation: number;
  annee_active: string;
  prenom: string | null;
  nom_famille: string | null;
  telephone: string | null;
  email: string | null;
  matiere_principale: string | null;
  etablissement: string | null;
}

export function profilQueryOptions() {
  return queryOptions({
    queryKey: ["profil"],
    staleTime: 60_000,
    queryFn: async (): Promise<Profil | null> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data, error } = await supabase
        .from("profils_enseignant")
        .select("*")
        .eq("user_id", userRes.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profil | null;
    },
  });
}

export function countsQueryOptions() {
  return queryOptions({
    queryKey: ["counts"],
    staleTime: 30_000,
    queryFn: async () => {
      const [ecoles, classes, eleves, notes] = await Promise.all([
        supabase.from("ecoles").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("eleves").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
      ]);
      return {
        ecoles: ecoles.count ?? 0,
        classes: classes.count ?? 0,
        eleves: eleves.count ?? 0,
        notes: notes.count ?? 0,
      };
    },
  });
}
