// Client helper: invoke the Supabase Edge Function `admin-api`.
// The function verifies role=admin server-side using service role.
import { supabase } from "@/integrations/supabase/client";

async function callAdminApi<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { action, ...params },
  });
  if (error) {
    // Try to surface the body error message
    try {
      // supabase-js FunctionsHttpError exposes .context.body / .context.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = error as any;
      if (anyErr?.context?.text) {
        const txt = await anyErr.context.text();
        try {
          const parsed = JSON.parse(txt);
          throw new Error(parsed?.error ?? txt);
        } catch {
          throw new Error(txt);
        }
      }
    } catch (e) {
      if (e instanceof Error) throw e;
    }
    throw new Error(error.message);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/* ---------- Users ---------- */
export type PlanPeriode = "mensuelle" | "trimestrielle" | "annuelle";

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  nom_affiche: string | null;
  plan: "gratuit" | "lite" | "premium";
  statut: "actif" | "suspendu";
  plan_periode: PlanPeriode | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  roles: string[];
}

export interface PlanActivation {
  id: string;
  plan: "gratuit" | "lite" | "premium";
  periode: PlanPeriode | null;
  plan_started_at: string;
  plan_expires_at: string | null;
  activated_by: string | null;
  activated_by_email: string | null;
  note: string | null;
  created_at: string;
}

export const adminApi = {
  listUsers: () => callAdminApi<{ users: AdminUser[] }>("listUsers").then((r) => r.users),
  updatePlan: (userId: string, plan: "gratuit" | "lite" | "premium") =>
    callAdminApi<{ ok: true }>("updatePlan", { userId, plan }),
  activatePlan: (userId: string, plan: "lite" | "premium", periode: PlanPeriode, note?: string) =>
    callAdminApi<{ ok: true; plan_expires_at: string }>("activatePlan", { userId, plan, periode, note }),
  activationsList: (userId: string) =>
    callAdminApi<{ activations: PlanActivation[] }>("activations.list", { userId }).then((r) => r.activations),
  setSuspension: (userId: string, suspendre: boolean) =>
    callAdminApi<{ ok: true }>("setSuspension", { userId, suspendre }),
  resetPassword: (userId: string, newPassword: string) =>
    callAdminApi<{ ok: true }>("resetPassword", { userId, newPassword }),
  deleteUser: (userId: string) =>
    callAdminApi<{ ok: true }>("deleteUser", { userId }),
  stats: () => callAdminApi<AdminStats>("stats"),

  anneesList: () => callAdminApi<{ annees: AdminAnneeAggregate[] }>("annees.list").then((r) => r.annees),
  anneesCreate: (params: { libelle: string; date_debut?: string | null; date_fin?: string | null; statut?: "active" | "archivee" | "a_venir" }) =>
    callAdminApi<{ ok: true; created: number }>("annees.create", params),
  anneesRename: (oldLibelle: string, newLibelle: string) =>
    callAdminApi<{ ok: true; updated: number }>("annees.rename", { oldLibelle, newLibelle }),
  anneesSetStatus: (libelle: string, statut: "active" | "archivee" | "a_venir") =>
    callAdminApi<{ ok: true; updated: number }>("annees.setStatus", { libelle, statut }),
  anneesArchive: (libelle: string) =>
    callAdminApi<{ ok: true; archived: number }>("annees.archive", { libelle }),
  anneesDelete: (libelle: string) =>
    callAdminApi<{ ok: true; deleted: number }>("annees.delete", { libelle }),

  plansList: () => callAdminApi<{ plans: PlanLimit[] }>("plans.list").then((r) => r.plans),
  plansUpdate: (patch: Partial<PlanLimit> & { plan: PlanLimit["plan"] }) =>
    callAdminApi<{ ok: true }>("plans.update", patch),
};

export interface PlanLimit {
  plan: "gratuit" | "lite" | "premium";
  max_ecoles: number;
  max_classes_par_ecole: number;
  max_eleves: number;
  bulletins_pdf: boolean;
  rapports: boolean;
  progression: boolean;
  updated_at?: string;
}


export interface AdminStats {
  totalUsers: number;
  admins: number;
  suspendus: number;
  actifs30j: number;
  planGratuit: number;
  planLite: number;
  planPremium: number;
  totalEcoles: number;
  totalClasses: number;
  totalEleves: number;
}

export interface AdminAnneeAggregate {
  libelle: string;
  active: number;
  archivee: number;
  a_venir: number;
  enseignants: number;
  date_debut: string | null;
  date_fin: string | null;
}
