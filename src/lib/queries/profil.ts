import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlanKey = "gratuit" | "lite" | "premium";
export type PlanPeriode = "mensuelle" | "trimestrielle" | "annuelle";

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
  telephone_verifie: boolean;
  telephone_verifie_le: string | null;
  email: string | null;
  matiere_principale: string | null;
  etablissement: string | null;
  plan?: PlanKey;
  plan_periode?: PlanPeriode | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
}

export interface PlanCapabilities {
  plan: PlanKey;
  /** Plan enregistré en base avant vérification d'expiration. */
  storedPlan: PlanKey;
  isAdmin: boolean;
  bulletins_pdf: boolean;
  rapports: boolean;
  progression: boolean;
  max_ecoles: number;
  max_classes_par_ecole: number;
  max_eleves: number;
  periode: PlanPeriode | null;
  startedAt: string | null;
  expiresAt: string | null;
  /** Jours restants avant expiration (peut être négatif). null si pas d'expiration. */
  daysRemaining: number | null;
  /** True si le plan payant est arrivé à échéance. */
  isExpired: boolean;
  /** True si un plan payant est actif et expire dans ≤ 10 jours. */
  isExpiringSoon: boolean;
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
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
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
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<PlanCapabilities> => {
      // Hors ligne : conserver les dernières capacités connues plutôt que
      // de basculer sur le plan gratuit par défaut.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("offline");
      }
      const fallback: PlanCapabilities = {
        plan: "gratuit", storedPlan: "gratuit", isAdmin: false,
        bulletins_pdf: false, rapports: false, progression: false,
        max_ecoles: 1, max_classes_par_ecole: 1, max_eleves: 25,
        periode: null, startedAt: null, expiresAt: null,
        daysRemaining: null, isExpired: false, isExpiringSoon: false,
      };
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return fallback;
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profils_enseignant")
          .select("plan, plan_periode, plan_started_at, plan_expires_at")
          .eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      const profRow = (prof ?? {}) as {
        plan?: string;
        plan_periode?: PlanPeriode | null;
        plan_started_at?: string | null;
        plan_expires_at?: string | null;
      };
      const storedPlan = (profRow.plan ?? "gratuit") as PlanKey;
      const expiresAt = profRow.plan_expires_at ?? null;
      const startedAt = profRow.plan_started_at ?? null;
      const periode = profRow.plan_periode ?? null;

      const now = Date.now();
      const expTs = expiresAt ? new Date(expiresAt).getTime() : null;
      const daysRemaining = expTs !== null
        ? Math.ceil((expTs - now) / 86_400_000)
        : null;
      const isPaid = storedPlan !== "gratuit";
      const isExpired = isPaid && expTs !== null && expTs <= now;
      const isExpiringSoon = isPaid && !isExpired && daysRemaining !== null && daysRemaining <= 10;
      // Plan effectif : gratuit si expiré
      const plan: PlanKey = isExpired ? "gratuit" : storedPlan;

      const { data: limits } = await supabase
        .from("plan_limits")
        .select("bulletins_pdf, rapports, progression, max_ecoles, max_classes_par_ecole, max_eleves")
        .eq("plan", plan)
        .maybeSingle();
      const l = (limits ?? {}) as Partial<PlanCapabilities>;
      return {
        plan,
        storedPlan,
        isAdmin,
        bulletins_pdf: isAdmin || Boolean(l.bulletins_pdf),
        rapports: isAdmin || Boolean(l.rapports),
        progression: isAdmin || Boolean(l.progression),
        max_ecoles: l.max_ecoles ?? fallback.max_ecoles,
        max_classes_par_ecole: l.max_classes_par_ecole ?? fallback.max_classes_par_ecole,
        max_eleves: l.max_eleves ?? fallback.max_eleves,
        periode,
        startedAt,
        expiresAt,
        daysRemaining,
        isExpired,
        isExpiringSoon,
      };
    },
  });
}



export function profilQueryOptions() {
  return queryOptions({
    queryKey: ["profil"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<Profil | null> => {
      // Hors ligne : préserver le profil en cache (évite un état "vide").
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("offline");
      }
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
