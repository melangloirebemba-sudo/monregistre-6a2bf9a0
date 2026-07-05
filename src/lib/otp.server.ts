// Server-only helpers for OTP: code generation, hashing, SMS sending via GatewayAPI.
// Never import from client/route/component files.

import { createHash, randomInt } from "crypto";

export const OTP_CONFIG = {
  length: 6,
  expiryMinutes: 10,
  maxAttempts: 5,
  cooldownSeconds: 60,        // minimum delay between two sends for the same phone/purpose
  maxSendsPerHour: 5,         // hard cap per phone (any purpose) per rolling hour
};

/** Génère un code OTP numérique. */
export function generateOtpCode(): string {
  const digits: string[] = [];
  for (let i = 0; i < OTP_CONFIG.length; i++) {
    digits.push(String(randomInt(0, 10)));
  }
  return digits.join("");
}

/** Hachage SHA-256 (avec pepper) pour stocker le code de manière irréversible. */
export function hashOtpCode(code: string): string {
  const pepper = process.env.OTP_PEPPER ?? process.env.SUPABASE_JWKS ?? "monregistre-otp";
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

/** Normalise un numéro pour GatewayAPI : chiffres uniquement, sans '+'. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/** Valide un numéro E.164-ish (7 à 15 chiffres, indicatif inclus). */
export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return n.length >= 7 && n.length <= 15;
}

export type OtpPurpose = "password_reset" | "phone_verification" | "phone_change";

const PURPOSE_LABEL: Record<OtpPurpose, string> = {
  password_reset: "réinitialisation de mot de passe",
  phone_verification: "vérification de numéro",
  phone_change: "changement de numéro",
};

/**
 * Envoie un SMS via GatewayAPI (REST /rest/mtsms).
 * https://gatewayapi.com/docs/apis/rest/
 *
 * Authentification : Basic auth où le login = token API, mot de passe = vide.
 */
export async function sendSms(params: {
  phone: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.GATEWAYAPI_TOKEN;
  const sender = process.env.GATEWAYAPI_SENDER ?? "MonRegistre";

  if (!token) {
    return {
      ok: false,
      error: "SMS non configuré (GATEWAYAPI_TOKEN manquant). Contactez le support.",
    };
  }

  const msisdn = Number(normalizePhone(params.phone));
  if (!Number.isFinite(msisdn) || msisdn <= 0) {
    return { ok: false, error: "Numéro invalide" };
  }

  const purposeLabel = PURPOSE_LABEL[params.purpose];
  const message =
    `MonRegistre — Code de ${purposeLabel} : ${params.code}\n` +
    `Valide ${OTP_CONFIG.expiryMinutes} min. Ne le partagez avec personne.`;

  const auth = Buffer.from(`${token}:`).toString("base64");

  try {
    const res = await fetch("https://gatewayapi.com/rest/mtsms", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        message,
        recipients: [{ msisdn }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `GatewayAPI ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau SMS" };
  }
}
