// Server functions to compose, schedule and dispatch broadcast notifications
// from the admin console. Every function requires an authenticated caller with
// role=admin; the check is done via `public.has_role`.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const targetTypeSchema = z.enum(["all", "plan", "user"]);
const planSchema = z.enum(["gratuit", "lite", "premium"]);

const composeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(1000).optional().nullable(),
  category: z
    .enum(["admin", "feature", "fix", "billing", "security", "account", "reactivation"])
    .default("admin"),
  href: z.string().trim().max(300).optional().nullable(),
  target_type: targetTypeSchema.default("all"),
  target_value: z.string().trim().max(200).optional().nullable(),
  send_at: z.string().datetime().optional().nullable(),
});

async function assertAdmin(supabase: {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Impossible de vérifier le rôle");
  if (data !== true) throw new Error("Forbidden: admin only");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Résout un destinataire à partir d'un email ou d'un UUID.
 * - Si la valeur est un UUID, on la considère comme user_id directement.
 * - Sinon on cherche l'email dans `profils_enseignant` (rempli par l'utilisateur),
 *   puis en repli via l'API Auth Admin (source de vérité pour l'email de connexion).
 */
async function resolveUserByEmailOrId(
  db: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { user_id: string } | null; error: unknown }>;
        };
      };
    };
  },
  raw: string,
): Promise<string> {
  const value = raw.trim();
  if (!value) throw new Error("Destinataire manquant");
  if (UUID_RE.test(value)) return value;
  if (!value.includes("@")) {
    throw new Error("Entrez un email valide pour le destinataire");
  }
  const email = value.toLowerCase();

  // 1) Recherche dans les profils enseignants (colonne email renseignée par l'utilisateur).
  const { data: profil } = await db
    .from("profils_enseignant")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (profil?.user_id) return profil.user_id;

  // 2) Repli : source de vérité côté Auth (email de connexion).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // getUserByEmail n'existe pas dans l'API publique ; on utilise listUsers avec un filtre.
  const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) {
    throw new Error(`Recherche utilisateur impossible: ${error.message}`);
  }
  const match = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!match) {
    throw new Error(`Aucun utilisateur trouvé pour ${email}`);
  }
  return match.id;
}

/** Send a broadcast immediately (writes user_notifications rows). */
export const sendAdminBroadcastNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => composeSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);

    // Utilise le client authentifié (RLS admin autorise l'accès à tous les
    // profils/notifications). Le client service_role peut échouer sur Lovable
    // Cloud avec les nouvelles clés `sb_secret_*` sur les endpoints Data API.
    const db = context.supabase;

    let userIds: string[] = [];
    if (data.target_type === "all") {
      const { data: rows, error } = await db
        .from("profils_enseignant")
        .select("user_id");
      if (error) throw new Error(`Lecture des profils impossible: ${error.message}`);
      userIds = (rows ?? []).map((r) => r.user_id as string);
    } else if (data.target_type === "plan") {
      const plan = planSchema.parse(data.target_value);
      const { data: rows, error } = await db
        .from("profils_enseignant")
        .select("user_id")
        .eq("plan", plan);
      if (error) throw new Error(`Lecture des profils impossible: ${error.message}`);
      userIds = (rows ?? []).map((r) => r.user_id as string);
    } else if (data.target_type === "user") {
      if (!data.target_value) throw new Error("Destinataire manquant");
      userIds = [await resolveUserByEmailOrId(db, data.target_value)];
    }

    if (userIds.length === 0) {
      // Journalise quand même la tentative pour que l'admin voie 0 destinataire.
      await db.from("scheduled_notifications").insert({
        title: data.title,
        body: data.body ?? null,
        category: data.category,
        href: data.href ?? null,
        target_type: data.target_type,
        target_value: data.target_value ?? null,
        send_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        recipients_count: 0,
        status: "sent",
        created_by: context.userId,
      });
      return { ok: true, recipients: 0 };
    }

    // Insertion par lots de 500 pour rester bien en deçà des limites de requête.
    const rows = userIds.map((uid) => ({
      user_id: uid,
      title: data.title,
      body: data.body ?? null,
      category: data.category,
      href: data.href ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db.from("user_notifications").insert(chunk);
      if (error) throw new Error(`Envoi impossible: ${error.message}`);
    }

    // Trace la diffusion pour audit.
    await db.from("scheduled_notifications").insert({
      title: data.title,
      body: data.body ?? null,
      category: data.category,
      href: data.href ?? null,
      target_type: data.target_type,
      target_value: data.target_value ?? null,
      send_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      recipients_count: userIds.length,
      status: "sent",
      created_by: context.userId,
    });

    return { ok: true, recipients: userIds.length };
  });

/** Create a scheduled broadcast (dispatched by the cron endpoint). */
export const scheduleAdminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => composeSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (!data.send_at) throw new Error("Date d'envoi manquante");
    const when = new Date(data.send_at);
    if (Number.isNaN(when.getTime())) throw new Error("Date invalide");
    if (when.getTime() < Date.now() - 60 * 1000) {
      throw new Error("La date doit être dans le futur");
    }

    const { error } = await context.supabase.from("scheduled_notifications").insert({
      title: data.title,
      body: data.body ?? null,
      category: data.category,
      href: data.href ?? null,
      target_type: data.target_type,
      target_value: data.target_value ?? null,
      send_at: when.toISOString(),
      status: "pending",
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cancel a pending scheduled notification. */
export const cancelScheduledBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("scheduled_notifications")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Trigger a cron hook manually (schedule daily, license expiry, relay, dispatch). */
export const triggerNotificationHook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        hook: z.enum([
          "schedule-daily-reminders",
          "license-expiry-reminders",
          "relay-inapp-notifications",
          "dispatch-scheduled-notifications",
        ]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const base =
      process.env.SUPABASE_URL?.includes("supabase.co")
        ? "https://monregistre.lovable.app"
        : "https://monregistre.lovable.app";
    const res = await fetch(`${base}/api/public/hooks/${data.hook}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, response: text };
  });
