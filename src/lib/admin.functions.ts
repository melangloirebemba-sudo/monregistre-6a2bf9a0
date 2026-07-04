import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Vérifie que l'appelant est admin. À utiliser en tête de handler.
 */
async function assertAdmin(supabase: ReturnType<typeof Object>, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabase as any;
  const { data, error } = await s
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
