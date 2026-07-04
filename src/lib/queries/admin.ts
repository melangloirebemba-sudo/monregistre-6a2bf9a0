import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user";
export type AppPlan = "gratuit" | "lite" | "premium";
export type UserStatut = "actif" | "suspendu";

/** Rôles du user courant */
export function currentUserRolesQO() {
  return queryOptions({
    queryKey: ["current-user-roles"],
    staleTime: 60_000,
    queryFn: async (): Promise<AppRole[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userRes.user.id);
      if (error) return [];
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export const PLAN_LABELS: Record<AppPlan, string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};

export const PLAN_LIMITS: Record<AppPlan, { ecoles: number | null; classesParEcole: number | null; eleves: number | null; bulletinsPdf: boolean }> = {
  gratuit: { ecoles: 1, classesParEcole: 1, eleves: 25, bulletinsPdf: false },
  lite: { ecoles: 2, classesParEcole: 2, eleves: null, bulletinsPdf: true },
  premium: { ecoles: null, classesParEcole: null, eleves: null, bulletinsPdf: true },
};

/** Formate une erreur Supabase pour l'afficher côté UI. */
export function formatPlanError(message: string): string {
  if (message.includes("PLAN_LIMIT_")) {
    // Extrait le message après le préfixe technique
    const clean = message.replace(/^.*PLAN_LIMIT_[A-Z]+:\s*/, "");
    return clean || message;
  }
  return message;
}
