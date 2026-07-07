// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: admin-api
// Provides admin-only management of users and school-year labels.
// Auth: caller must have role 'admin' in public.user_roles.
// Runtime injects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Auth: extract caller from Authorization header ----
  const authz = req.headers.get("Authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return json({ error: "Missing bearer token" }, 401);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
  const uid = userRes.user.id;

  // ---- Verify admin role ----
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);

  let payload: any = {};
  try { payload = await req.json(); } catch { /* empty */ }
  const action: string = payload?.action ?? "";

  try {
    switch (action) {
      /* ============ USERS ============ */
      case "listUsers": {
        const [{ data: usersRes, error: uErr }, { data: profils, error: pErr }, { data: roles }] = await Promise.all([
          admin.auth.admin.listUsers({ page: 1, perPage: 500 }),
          admin.from("profils_enseignant").select("*"),
          admin.from("user_roles").select("*"),
        ]);
        if (uErr) throw uErr;
        if (pErr) throw pErr;
        const profByUser = new Map<string, any>();
        for (const p of profils ?? []) profByUser.set(p.user_id, p);
        const rolesByUser = new Map<string, string[]>();
        for (const r of roles ?? []) {
          const arr = rolesByUser.get(r.user_id) ?? [];
          arr.push(r.role); rolesByUser.set(r.user_id, arr);
        }
        return json({
          users: (usersRes.users ?? []).map((u: any) => ({
            id: u.id,
            email: u.email ?? "",
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            banned_until: u.banned_until ?? null,
            email_confirmed_at: u.email_confirmed_at ?? null,
            nom_affiche: profByUser.get(u.id)?.nom_affiche ?? null,
            plan: profByUser.get(u.id)?.plan ?? "gratuit",
            statut: profByUser.get(u.id)?.statut ?? "actif",
            plan_periode: profByUser.get(u.id)?.plan_periode ?? null,
            plan_started_at: profByUser.get(u.id)?.plan_started_at ?? null,
            plan_expires_at: profByUser.get(u.id)?.plan_expires_at ?? null,
            roles: rolesByUser.get(u.id) ?? [],
          })),
        });
      }

      case "updatePlan": {
        const { userId, plan } = payload;
        if (!userId || !["gratuit", "lite", "premium"].includes(plan))
          return json({ error: "Bad input" }, 400);
        // Réinitialise la période/expiration lors d'un changement direct.
        const patch: Record<string, unknown> =
          plan === "gratuit"
            ? { plan, plan_periode: null, plan_started_at: null, plan_expires_at: null }
            : { plan };
        const { error } = await admin.from("profils_enseignant").update(patch).eq("user_id", userId);
        if (error) throw error;
        await admin.from("user_notifications").insert({
          user_id: userId,
          title: "Votre plan a été mis à jour",
          body: `Un administrateur a défini votre plan sur « ${plan} ».`,
          category: "billing",
          href: "/mon-profil",
        });
        return json({ ok: true });
      }

      case "activatePlan": {
        const { userId, plan, periode, note, montant: montantOverride, moyen_paiement, trial, trialDays } = payload;
        if (!userId || !["lite", "premium"].includes(plan))
          return json({ error: "Plan invalide (lite ou premium)" }, 400);
        if (!["mensuelle", "trimestrielle", "annuelle"].includes(periode))
          return json({ error: "Période invalide" }, 400);
        const isTrial = trial === true;
        let days: number;
        if (isTrial) {
          const n = Math.floor(Number(trialDays));
          if (!Number.isFinite(n) || n < 1 || n > 365)
            return json({ error: "Durée d'essai invalide (1 à 365 jours)" }, 400);
          days = n;
        } else {
          days = periode === "mensuelle" ? 30 : periode === "trimestrielle" ? 90 : 300;
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + days * 86_400_000);
        const { error } = await admin.from("profils_enseignant").update({
          plan,
          plan_periode: periode,
          plan_started_at: now.toISOString(),
          plan_expires_at: expiresAt.toISOString(),
          statut: "actif",
        }).eq("user_id", userId);
        if (error) throw error;
        const trialNote = isTrial ? `Période d'essai (${days} j)` : null;
        const finalNote = [trialNote, typeof note === "string" && note.trim() ? note.trim() : null]
          .filter(Boolean)
          .join(" — ") || null;
        // Journal d'historique
        const { data: activationRow, error: logErr } = await admin
          .from("plan_activations")
          .insert({
            user_id: userId,
            plan,
            periode,
            plan_started_at: now.toISOString(),
            plan_expires_at: expiresAt.toISOString(),
            activated_by: uid,
            activated_by_email: userRes.user.email ?? null,
            note: finalNote,
          })
          .select("id")
          .single();
        if (logErr) console.error("[admin-api] plan_activations insert failed", logErr.message);

        // Reçu de paiement : uniquement pour un plan payé (pas de facture pour un essai gratuit).
        if (!isTrial) {
          let montant = 0;
          if (typeof montantOverride === "number" && montantOverride >= 0) {
            montant = Math.floor(montantOverride);
          } else {
            const { data: priceRow } = await admin
              .from("plan_prices")
              .select("montant")
              .eq("plan", plan)
              .eq("periode", periode)
              .maybeSingle();
            montant = priceRow?.montant ?? 0;
          }
          const { error: payErr } = await admin.from("paiements").insert({
            user_id: userId,
            plan_activation_id: activationRow?.id ?? null,
            plan,
            periode,
            montant,
            devise: "XAF",
            paye_le: now.toISOString(),
            plan_expires_at: expiresAt.toISOString(),
            moyen_paiement: typeof moyen_paiement === "string" && moyen_paiement.trim() ? moyen_paiement.trim() : "manuel",
            note: finalNote,
            created_by: uid,
          });
          if (payErr) console.error("[admin-api] paiements insert failed", payErr.message);
        }


        await admin.from("user_notifications").insert({
          user_id: userId,
          title: isTrial ? `Essai ${plan} activé` : `Plan ${plan} activé`,
          body: isTrial
            ? `Vous bénéficiez d'un essai gratuit de ${days} jour(s). Expire le ${expiresAt.toLocaleDateString("fr-FR")}.`
            : `Votre plan ${plan} (${periode}) est actif jusqu'au ${expiresAt.toLocaleDateString("fr-FR")}.`,
          category: "billing",
          href: "/mon-profil",
        });
        return json({ ok: true, plan_expires_at: expiresAt.toISOString() });
      }


      case "activations.list": {
        const { userId } = payload;
        if (!userId) return json({ error: "Bad input" }, 400);
        const { data, error } = await admin
          .from("plan_activations")
          .select("id, plan, periode, plan_started_at, plan_expires_at, activated_by, activated_by_email, note, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return json({ activations: data ?? [] });
      }


      case "setSuspension": {
        const { userId, suspendre } = payload;
        if (!userId || typeof suspendre !== "boolean") return json({ error: "Bad input" }, 400);
        const banDuration = suspendre ? "876000h" : "none";
        const { error: e1 } = await (admin.auth.admin as any)
          .updateUserById(userId, { ban_duration: banDuration });
        if (e1) throw e1;
        const { error: e2 } = await admin.from("profils_enseignant")
          .update({ statut: suspendre ? "suspendu" : "actif" }).eq("user_id", userId);
        if (e2) throw e2;
        // La réactivation est déjà notifiée par un trigger sur profils_enseignant.
        if (suspendre) {
          await admin.from("user_notifications").insert({
            user_id: userId,
            title: "Votre compte a été suspendu",
            body: "Un administrateur a suspendu votre compte. Contactez le support pour plus d'informations.",
            category: "account",
            href: "/parametres",
          });
        }
        return json({ ok: true });
      }

      case "resetPassword": {
        const { userId, newPassword } = payload;
        if (!userId || !newPassword || newPassword.length < 8) return json({ error: "Bad input" }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw error;
        // Journalisation
        const { data: targetU } = await admin.auth.admin.getUserById(userId);
        await admin.from("admin_password_changes").insert({
          user_id: userId,
          user_email: targetU?.user?.email ?? null,
          changed_by: uid,
          changed_by_email: userRes.user.email ?? null,
          source: "admin-reset",
        });
        return json({ ok: true });
      }

      /* ============ PASSWORD CHANGES LOG ============ */
      case "passwordChanges.log": {
        // Utilisé après un changement de mot de passe côté client (self-service admin).
        const targetUserId: string = payload?.targetUserId ?? uid;
        const source: string = ["self", "reset", "admin-reset"].includes(payload?.source)
          ? payload.source
          : "self";
        const { data: targetU } = await admin.auth.admin.getUserById(targetUserId);
        const { error } = await admin.from("admin_password_changes").insert({
          user_id: targetUserId,
          user_email: targetU?.user?.email ?? null,
          changed_by: uid,
          changed_by_email: userRes.user.email ?? null,
          source,
        });
        if (error) throw error;
        return json({ ok: true });
      }

      case "passwordChanges.list": {
        const limit = Math.min(Math.max(Number(payload?.limit) || 50, 1), 200);
        const { data, error } = await admin
          .from("admin_password_changes")
          .select("id, user_id, user_email, changed_by, changed_by_email, source, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return json({ entries: data ?? [] });
      }

      case "sendPasswordResetEmail": {
        const { userId, redirectTo } = payload;
        if (!userId) return json({ error: "Bad input" }, 400);
        const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
        if (uErr) throw uErr;
        const email = u?.user?.email;
        if (!email) return json({ error: "Utilisateur sans adresse e-mail" }, 400);
        const { error } = await admin.auth.resetPasswordForEmail(email, {
          redirectTo: typeof redirectTo === "string" && redirectTo ? redirectTo : undefined,
        });
        if (error) throw error;
        return json({ ok: true, email });
      }

      /* ============ APP SETTINGS ============ */
      case "settings.get": {
        const { data, error } = await admin.from("app_settings").select("*").eq("id", 1).maybeSingle();
        if (error) throw error;
        return json({ settings: data });
      }

      case "settings.update": {
        const { whatsapp_number, whatsapp_display, support_email } = payload;
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof whatsapp_number === "string") {
          const n = whatsapp_number.replace(/\D/g, "");
          if (n.length < 6 || n.length > 20) return json({ error: "Numéro WhatsApp invalide" }, 400);
          patch.whatsapp_number = n;
        }
        if (typeof whatsapp_display === "string") {
          if (whatsapp_display.trim().length < 3) return json({ error: "Libellé WhatsApp invalide" }, 400);
          patch.whatsapp_display = whatsapp_display.trim();
        }
        if (typeof support_email === "string") {
          const em = support_email.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return json({ error: "E-mail support invalide" }, 400);
          patch.support_email = em;
        }
        if (Object.keys(patch).length === 1) return json({ error: "Aucun champ à mettre à jour" }, 400);
        const { error } = await admin.from("app_settings").update(patch).eq("id", 1);
        if (error) throw error;
        return json({ ok: true });
      }

      case "deleteUser": {
        const { userId } = payload;
        if (!userId) return json({ error: "Bad input" }, 400);
        if (userId === uid) return json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
        return json({ ok: true });
      }

      case "stats": {
        const [usersRes, profilsRes, rolesRes, ecolesRes, classesRes, elevesRes] = await Promise.all([
          admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
          admin.from("profils_enseignant").select("plan, statut"),
          admin.from("user_roles").select("user_id, role"),
          admin.from("ecoles").select("id", { count: "exact", head: true }),
          admin.from("classes").select("id", { count: "exact", head: true }),
          admin.from("eleves").select("id", { count: "exact", head: true }),
        ]);
        const users = usersRes.data?.users ?? [];
        const profils: any[] = profilsRes.data ?? [];
        const roles: any[] = rolesRes.data ?? [];
        const now = Date.now();
        const THIRTY = 30 * 24 * 3600 * 1000;
        const actifs30j = users.filter((u: any) =>
          u.last_sign_in_at && now - new Date(u.last_sign_in_at).getTime() < THIRTY).length;
        return json({
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
        });
      }

      /* ============ ANNEES SCOLAIRES ============ */
      case "annees.list": {
        const { data, error } = await admin
          .from("annees_scolaires")
          .select("id, user_id, libelle, statut, date_debut, date_fin, created_at");
        if (error) throw error;
        const byLibelle = new Map<string, any>();
        for (const a of data ?? []) {
          const key = a.libelle as string;
          const b = byLibelle.get(key) ?? {
            libelle: key, active: 0, archivee: 0, a_venir: 0, enseignants: new Set<string>(),
            date_debut: a.date_debut, date_fin: a.date_fin,
          };
          if (a.statut === "active") b.active++;
          else if (a.statut === "archivee") b.archivee++;
          else b.a_venir++;
          b.enseignants.add(a.user_id);
          byLibelle.set(key, b);
        }
        return json({
          annees: Array.from(byLibelle.values())
            .map((b) => ({
              libelle: b.libelle,
              active: b.active,
              archivee: b.archivee,
              a_venir: b.a_venir,
              enseignants: b.enseignants.size,
              date_debut: b.date_debut,
              date_fin: b.date_fin,
            }))
            .sort((a, b) => b.libelle.localeCompare(a.libelle)),
        });
      }

      case "annees.create": {
        const { libelle, date_debut, date_fin, statut } = payload;
        if (!libelle) return json({ error: "Libellé requis" }, 400);
        const targetStatut = statut === "active" || statut === "archivee" ? statut : "a_venir";
        // Créer l'année pour tous les enseignants existants
        const { data: users } = await admin.from("profils_enseignant").select("user_id");
        const rows = (users ?? []).map((u: any) => ({
          user_id: u.user_id,
          libelle,
          statut: targetStatut,
          date_debut: date_debut || null,
          date_fin: date_fin || null,
        }));
        if (rows.length === 0) return json({ ok: true, created: 0 });
        const { error, count } = await admin
          .from("annees_scolaires")
          .upsert(rows, { onConflict: "user_id,libelle", count: "exact" });
        if (error) throw error;
        return json({ ok: true, created: count ?? rows.length });
      }

      case "annees.rename": {
        const { oldLibelle, newLibelle } = payload;
        if (!oldLibelle || !newLibelle) return json({ error: "Bad input" }, 400);
        const { error, count } = await admin
          .from("annees_scolaires")
          .update({ libelle: newLibelle }, { count: "exact" })
          .eq("libelle", oldLibelle);
        if (error) throw error;
        // Mise à jour de profils_enseignant.annee_active
        await admin.from("profils_enseignant")
          .update({ annee_active: newLibelle })
          .eq("annee_active", oldLibelle);
        return json({ ok: true, updated: count ?? 0 });
      }

      case "annees.setStatus": {
        const { libelle, statut } = payload;
        if (!libelle || !["active", "archivee", "a_venir"].includes(statut))
          return json({ error: "Bad input" }, 400);
        // Si active: passer les autres actives (par enseignant) à archivée pour respecter unicité fonctionnelle
        if (statut === "active") {
          await admin.from("annees_scolaires")
            .update({ statut: "archivee" })
            .neq("libelle", libelle)
            .eq("statut", "active");
        }
        const { error, count } = await admin
          .from("annees_scolaires")
          .update({ statut }, { count: "exact" })
          .eq("libelle", libelle);
        if (error) throw error;
        return json({ ok: true, updated: count ?? 0 });
      }

      case "annees.archive": {
        const { libelle } = payload;
        if (!libelle) return json({ error: "Bad input" }, 400);
        const { error, count } = await admin
          .from("annees_scolaires")
          .update({ statut: "archivee" }, { count: "exact" })
          .eq("libelle", libelle)
          .eq("statut", "active");
        if (error) throw error;
        return json({ ok: true, archived: count ?? 0 });
      }

      case "annees.delete": {
        const { libelle } = payload;
        if (!libelle) return json({ error: "Bad input" }, 400);
        const { error, count } = await admin
          .from("annees_scolaires")
          .delete({ count: "exact" })
          .eq("libelle", libelle);
        if (error) throw error;
        return json({ ok: true, deleted: count ?? 0 });
      }

      /* ============ PLAN LIMITS ============ */
      case "plans.list": {
        const { data, error } = await admin
          .from("plan_limits")
          .select("*")
          .order("plan");
        if (error) throw error;
        return json({ plans: data ?? [] });
      }

      case "plans.update": {
        const { plan, max_ecoles, max_classes_par_ecole, max_eleves, bulletins_pdf, rapports, progression } = payload;
        if (!["gratuit", "lite", "premium"].includes(plan)) return json({ error: "Plan invalide" }, 400);
        const toInt = (v: any) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return null;
          return Math.min(Math.floor(n), 2147483647);
        };
        const patch: any = {};
        if (max_ecoles !== undefined) { const n = toInt(max_ecoles); if (n === null) return json({ error: "max_ecoles invalide" }, 400); patch.max_ecoles = n; }
        if (max_classes_par_ecole !== undefined) { const n = toInt(max_classes_par_ecole); if (n === null) return json({ error: "max_classes_par_ecole invalide" }, 400); patch.max_classes_par_ecole = n; }
        if (max_eleves !== undefined) { const n = toInt(max_eleves); if (n === null) return json({ error: "max_eleves invalide" }, 400); patch.max_eleves = n; }
        if (typeof bulletins_pdf === "boolean") patch.bulletins_pdf = bulletins_pdf;
        if (typeof rapports === "boolean") patch.rapports = rapports;
        if (typeof progression === "boolean") patch.progression = progression;
        if (Object.keys(patch).length === 0) return json({ error: "Aucun champ à mettre à jour" }, 400);
        const { error } = await admin.from("plan_limits").update(patch).eq("plan", plan);
        if (error) throw error;
        return json({ ok: true });
      }

      /* ============ PLAN PRICES ============ */
      case "prices.list": {
        const { data, error } = await admin
          .from("plan_prices")
          .select("plan, periode, montant, devise, updated_at")
          .order("plan")
          .order("periode");
        if (error) throw error;
        return json({ prices: data ?? [] });
      }

      case "prices.update": {
        const { plan, periode, montant, devise } = payload;
        if (!["lite", "premium"].includes(plan)) return json({ error: "Plan invalide (lite ou premium)" }, 400);
        if (!["mensuelle", "trimestrielle", "annuelle"].includes(periode)) return json({ error: "Période invalide" }, 400);
        const n = Number(montant);
        if (!Number.isFinite(n) || n < 0) return json({ error: "Montant invalide" }, 400);
        const patch: Record<string, unknown> = {
          plan,
          periode,
          montant: Math.floor(n),
          devise: typeof devise === "string" && devise.trim() ? devise.trim().toUpperCase() : "XAF",
          updated_at: new Date().toISOString(),
          updated_by: uid,
        };
        const { error } = await admin.from("plan_prices").upsert(patch, { onConflict: "plan,periode" });
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);

    }

  } catch (e: any) {
    console.error("[admin-api]", action, e?.message ?? e);
    return json({ error: e?.message ?? String(e) }, 400);
  }
});
