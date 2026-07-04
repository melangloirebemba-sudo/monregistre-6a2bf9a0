import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StatutAnnee = "active" | "archivee" | "a_venir";

export interface AnneeScolaire {
  id: string;
  user_id: string;
  libelle: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: StatutAnnee;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const anneesScolairesQO = () =>
  queryOptions({
    queryKey: ["annees_scolaires"],
    staleTime: 30_000,
    queryFn: async (): Promise<AnneeScolaire[]> => {
      const { data, error } = await supabase
        .from("annees_scolaires")
        .select("*")
        .order("libelle", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnneeScolaire[];
    },
  });

export async function activerAnnee(id: string, libelle: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Session expirée");

  // Désactive les autres
  const { error: e1 } = await supabase
    .from("annees_scolaires")
    .update({ statut: "archivee" })
    .eq("user_id", uid)
    .eq("statut", "active")
    .neq("id", id);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("annees_scolaires")
    .update({ statut: "active" })
    .eq("id", id);
  if (e2) throw e2;

  // Reflet sur le profil
  const { error: e3 } = await supabase
    .from("profils_enseignant")
    .update({ annee_active: libelle })
    .eq("user_id", uid);
  if (e3) throw e3;
}
