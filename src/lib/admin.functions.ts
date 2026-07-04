import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Vérifie que l'appelant est admin. À utiliser en tête de handler.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès refusé : rôle admin requis.");
}

/* ==================== LIST USERS ==================== */
export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: usersRes, error: usersErr }, { data: profilsRes, error: profilsErr }, { data: rolesRes }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("profils_enseignant").select("*"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("user_roles").select("*"),
    ]);
    if (usersErr) throw new Error(usersErr.message);
    if (profilsErr) throw new Error(profilsErr.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilsByUser = new Map<string, any>();
    for (const p of profilsRes ?? []) profilsByUser.set(p.user_id, p);
    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    return usersRes.users.map((u) => {
      const profil = profilsByUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        nom_affiche: profil?.nom_affiche ?? null,
        plan: (profil?.plan ?? "gratuit") as "gratuit" | "lite" | "premium",
        statut: (profil?.statut ?? "actif") as "actif" | "suspendu",
        roles: rolesByUser.get(u.id) ?? [],
      };
    });
  });

/* ==================== UPDATE PLAN ==================== */
export const updateUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; plan: "gratuit" | "lite" | "premium" }) =>
    z.object({ userId: z.string().uuid(), plan: z.enum(["gratuit", "lite", "premium"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("profils_enseignant")
      .update({ plan: data.plan })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ==================== SUSPEND / UNSUSPEND ==================== */
export const setUserSuspension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; suspendre: boolean }) =>
    z.object({ userId: z.string().uuid(), suspendre: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ban Supabase = bloque la connexion
    const ban_duration = data.suspendre ? "876000h" : "none"; // 100 ans / aucune
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e1 } = await (supabaseAdmin.auth.admin as any).updateUserById(data.userId, { ban_duration });
    if (e1) throw new Error(e1.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e2 } = await (supabaseAdmin as any)
      .from("profils_enseignant")
      .update({ statut: data.suspendre ? "suspendu" : "actif" })
      .eq("user_id", data.userId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/* ==================== RESET PASSWORD ==================== */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; newPassword: string }) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ==================== DELETE USER ==================== */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ==================== ADMIN STATS ==================== */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [usersRes, profilsRes, rolesRes, ecolesRes, classesRes, elevesRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("profils_enseignant").select("plan, statut"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("user_roles").select("user_id, role"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("ecoles").select("id", { count: "exact", head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("classes").select("id", { count: "exact", head: true }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any).from("eleves").select("id", { count: "exact", head: true }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profils: any[] = profilsRes.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roles: any[] = rolesRes.data ?? [];
    const users = usersRes.data?.users ?? [];

    const now = Date.now();
    const THIRTY_D = 30 * 24 * 60 * 60 * 1000;
    const actifs30j = users.filter((u) => {
      const t = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
      return t > 0 && now - t < THIRTY_D;
    }).length;

    return {
      totalUsers: users.length,
      admins: roles.filter((r) => r.role === "admin").length,
      suspendus: profils.filter((p) => p.statut === "suspendu").length,
      actifs30j,
      planGratuit: profils.filter((p) => p.plan === "gratuit").length,
      planLite: profils.filter((p) => p.plan === "lite").length,
      planPremium: profils.filter((p) => p.plan === "premium").length,
      totalEcoles: ecolesRes.count ?? 0,
      totalClasses: classesRes.count ?? 0,
      totalEleves: elevesRes.count ?? 0,
    };
  });
