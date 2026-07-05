// Server functions for OTP-based flows:
//   - Password reset (public, phone-based)
//   - Phone verification (authenticated)
//   - Phone change (authenticated)
//
// Rate limits and expiry are enforced server-side. Never trust the client.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OTP_LENGTH = 6;
const EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;

type Purpose = "password_reset" | "phone_verification" | "phone_change";

// ---------- Shared helpers (loaded lazily to keep client bundle clean) ----------

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getServerHelpers() {
  const mod = await import("./otp.server");
  return mod;
}

async function checkAndLogSendAttempt(phone: string, purpose: Purpose) {
  const admin = await getAdmin();
  const nowIso = new Date().toISOString();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Rate: max sends per hour
  const { count } = await admin
    .from("otp_send_log")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
    throw new Error(
      `Trop de demandes récentes. Réessayez dans une heure.`,
    );
  }

  // Cooldown: last send < 60s ago
  const cooldownStart = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from("otp_send_log")
    .select("id")
    .eq("phone", phone)
    .gte("created_at", cooldownStart)
    .limit(1);
  if (recent && recent.length > 0) {
    throw new Error(`Merci de patienter ${COOLDOWN_SECONDS} s avant un nouvel envoi.`);
  }

  // Insert log row (status=queued; updated by caller if needed)
  await admin.from("otp_send_log").insert({
    phone,
    purpose,
    status: "queued",
    created_at: nowIso,
  });
}

async function insertOtp(params: {
  phone: string;
  purpose: Purpose;
  userId: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { generateOtpCode, hashOtpCode } = await getServerHelpers();
  const admin = await getAdmin();
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();
  // Invalidate previous unused codes for same phone+purpose
  await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("phone", params.phone)
    .eq("purpose", params.purpose)
    .is("consumed_at", null);
  const { error } = await admin.from("otp_codes").insert({
    phone: params.phone,
    purpose: params.purpose,
    user_id: params.userId,
    code_hash: hashOtpCode(code),
    max_attempts: MAX_ATTEMPTS,
    expires_at: expiresAt,
    metadata: (params.metadata ?? {}) as never,
  });
  if (error) throw new Error(error.message);
  return code;
}

async function verifyOtp(params: {
  phone: string;
  purpose: Purpose;
  code: string;
}): Promise<{ userId: string | null; metadata: Record<string, unknown> }> {
  const { hashOtpCode } = await getServerHelpers();
  const admin = await getAdmin();

  const { data, error } = await admin
    .from("otp_codes")
    .select("id, code_hash, attempts, max_attempts, expires_at, consumed_at, user_id, metadata")
    .eq("phone", params.phone)
    .eq("purpose", params.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Aucun code en attente. Demandez un nouvel envoi.");

  if (new Date(data.expires_at).getTime() < Date.now()) {
    await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", data.id);
    throw new Error("Ce code a expiré. Demandez un nouvel envoi.");
  }
  if (data.attempts >= data.max_attempts) {
    await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", data.id);
    throw new Error("Trop de tentatives incorrectes. Demandez un nouvel envoi.");
  }

  const submitted = hashOtpCode(params.code.trim());
  if (submitted !== data.code_hash) {
    await admin.from("otp_codes").update({ attempts: data.attempts + 1 }).eq("id", data.id);
    const remaining = data.max_attempts - (data.attempts + 1);
    throw new Error(
      remaining > 0
        ? `Code incorrect. ${remaining} tentative${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}.`
        : "Trop de tentatives incorrectes. Demandez un nouvel envoi.",
    );
  }

  // Success — mark consumed
  await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", data.id);
  return {
    userId: data.user_id,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}

// =============================================================================
// PUBLIC — Password reset by phone
// =============================================================================

export const requestPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => z.object({ phone: z.string().min(4) }).parse(d))
  .handler(async ({ data }) => {
    const { normalizePhone, isValidPhone, sendSms } = await getServerHelpers();
    if (!isValidPhone(data.phone)) throw new Error("Numéro invalide.");
    const phone = normalizePhone(data.phone);

    // Look up matching user via profile phone (must be unique to proceed)
    const admin = await getAdmin();
    const { data: profils } = await admin
      .from("profils_enseignant")
      .select("user_id, telephone")
      .not("telephone", "is", null);
    const matches =
      profils?.filter((p) => normalizePhone(p.telephone ?? "") === phone) ?? [];
    // We ALWAYS return ok=true to avoid phone enumeration.
    if (matches.length !== 1) {
      // still log a fake send attempt to consume rate limit
      await admin.from("otp_send_log").insert({
        phone,
        purpose: "password_reset",
        status: "skipped_no_user",
      });
      return { ok: true as const };
    }

    await checkAndLogSendAttempt(phone, "password_reset");
    const code = await insertOtp({
      phone,
      purpose: "password_reset",
      userId: matches[0].user_id,
    });
    const sent = await sendSms({ phone, code, purpose: "password_reset" });
    if (!sent.ok) {
      await admin.from("otp_send_log").insert({
        phone,
        purpose: "password_reset",
        status: "failed",
        error: sent.error,
      });
      throw new Error(sent.error);
    }
    return { ok: true as const };
  });

export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; newPassword: string }) =>
    z
      .object({
        phone: z.string().min(4),
        code: z.string().length(OTP_LENGTH),
        newPassword: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { normalizePhone } = await getServerHelpers();
    const phone = normalizePhone(data.phone);
    const { userId } = await verifyOtp({ phone, purpose: "password_reset", code: data.code });
    if (!userId) throw new Error("Code invalide.");
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);

    // Audit (best-effort — do not fail the reset if audit insert errors)
    await admin
      .from("admin_password_changes")
      .insert({
        user_id: userId,
        changed_by: userId,
        source: "reset",
      })
      .then(() => undefined, () => undefined);

    return { ok: true as const };
  });

// =============================================================================
// AUTHENTICATED — Phone verification (current profile phone)
// =============================================================================

export const requestPhoneVerificationOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { normalizePhone, isValidPhone, sendSms } = await getServerHelpers();
    const admin = await getAdmin();
    const { data: prof } = await admin
      .from("profils_enseignant")
      .select("telephone, telephone_verifie")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prof?.telephone) throw new Error("Aucun numéro dans votre profil.");
    if (prof.telephone_verifie) throw new Error("Numéro déjà vérifié.");
    if (!isValidPhone(prof.telephone)) throw new Error("Numéro invalide dans votre profil.");
    const phone = normalizePhone(prof.telephone);
    await checkAndLogSendAttempt(phone, "phone_verification");
    const code = await insertOtp({
      phone,
      purpose: "phone_verification",
      userId: context.userId,
    });
    const sent = await sendSms({ phone, code, purpose: "phone_verification" });
    if (!sent.ok) {
      await admin.from("otp_send_log").insert({
        phone,
        purpose: "phone_verification",
        status: "failed",
        error: sent.error,
      });
      throw new Error(sent.error);
    }
    return { ok: true as const };
  });

export const confirmPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) =>
    z.object({ code: z.string().length(OTP_LENGTH) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdmin();
    const { normalizePhone } = await getServerHelpers();
    const { data: prof } = await admin
      .from("profils_enseignant")
      .select("telephone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prof?.telephone) throw new Error("Aucun numéro à vérifier.");
    const phone = normalizePhone(prof.telephone);
    const res = await verifyOtp({ phone, purpose: "phone_verification", code: data.code });
    if (res.userId && res.userId !== context.userId) {
      throw new Error("Code non associé à ce compte.");
    }
    const { error } = await admin
      .from("profils_enseignant")
      .update({ telephone_verifie: true, telephone_verifie_le: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// =============================================================================
// AUTHENTICATED — Phone change (new phone, OTP on the new number)
// =============================================================================

export const requestPhoneChangeOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { newPhone: string }) =>
    z.object({ newPhone: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { normalizePhone, isValidPhone, sendSms } = await getServerHelpers();
    if (!isValidPhone(data.newPhone)) throw new Error("Numéro invalide.");
    const phone = normalizePhone(data.newPhone);
    await checkAndLogSendAttempt(phone, "phone_change");
    const code = await insertOtp({
      phone,
      purpose: "phone_change",
      userId: context.userId,
      metadata: { newPhone: data.newPhone.trim() },
    });
    const sent = await sendSms({ phone, code, purpose: "phone_change" });
    if (!sent.ok) {
      const admin = await getAdmin();
      await admin.from("otp_send_log").insert({
        phone,
        purpose: "phone_change",
        status: "failed",
        error: sent.error,
      });
      throw new Error(sent.error);
    }
    return { ok: true as const };
  });

export const confirmPhoneChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { newPhone: string; code: string }) =>
    z
      .object({ newPhone: z.string().min(4), code: z.string().length(OTP_LENGTH) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { normalizePhone } = await getServerHelpers();
    const phone = normalizePhone(data.newPhone);
    const res = await verifyOtp({ phone, purpose: "phone_change", code: data.code });
    if (res.userId && res.userId !== context.userId) {
      throw new Error("Code non associé à ce compte.");
    }
    const admin = await getAdmin();
    const { error } = await admin
      .from("profils_enseignant")
      .update({
        telephone: data.newPhone.trim(),
        telephone_verifie: true,
        telephone_verifie_le: new Date().toISOString(),
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
