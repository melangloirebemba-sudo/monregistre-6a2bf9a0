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
  plan?: "gratuit" | "lite" | "premium";
}

export interface PlanCapabilities {
  plan: "gratuit" | "lite" | "premium";
  isAdmin: boolean;
  bulletins_pdf: boolean;
  rapports: boolean;
  progression: boolean;
  max_ecoles: number;
  max_classes_par_ecole: number;
  max_eleves: number;
}

export interface PlanLimitsRow {
  plan: "gratuit" | "lite" | "premium";
  bulletins_pdf: boolean;
  rapports: boolean;
  progression: boolean;
  max_ecoles: number;
  max_classes_par_ecole: number;
  max_eleves: number;
}

export function planLimitsQO(plan: "gratuit" | "lite" | "premium") {
  return queryOptions({
    queryKey: ["plan-limits", plan],
    staleTime: 60_000,
    queryFn: async (): Promise<PlanLimitsRow | null> => {
      const { data } = await supabase
        .from("plan_limits")
        .select("plan, bulletins_pdf, rapports, progression, max_ecoles, max_classes_par_ecole, max_eleves")
        .eq("plan", plan)
        .maybeSingle();
      return (data as PlanLimitsRow | null) ?? null;
    },
  });
}


export function planCapabilitiesQO() {
  return queryOptions({
    queryKey: ["plan-capabilities"],
    staleTime: 60_000,
    queryFn: async (): Promise<PlanCapabilities> => {
      const fallback: PlanCapabilities = {
        plan: "gratuit", isAdmin: false, bulletins_pdf: false, rapports: false, progression: false,
        max_ecoles: 1, max_classes_par_ecole: 1, max_eleves: 25,
      };
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return fallback;
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profils_enseignant").select("plan").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      const plan = ((prof as { plan?: string } | null)?.plan ?? "gratuit") as "gratuit" | "lite" | "premium";
      const { data: limits } = await supabase
        .from("plan_limits")
        .select("bulletins_pdf, rapports, progression, max_ecoles, max_classes_par_ecole, max_eleves")
        .eq("plan", plan)
        .maybeSingle();
      const l = (limits ?? {}) as Partial<PlanCapabilities>;
      return {
        plan,
        isAdmin,
        bulletins_pdf: isAdmin || Boolean(l.bulletins_pdf),
        rapports: isAdmin || Boolean(l.rapports),
        progression: isAdmin || Boolean(l.progression),
        max_ecoles: l.max_ecoles ?? fallback.max_ecoles,
        max_classes_par_ecole: l.max_classes_par_ecole ?? fallback.max_classes_par_ecole,
        max_eleves: l.max_eleves ?? fallback.max_eleves,
      };
    },
  });
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
