/**
 * Convertit un message d'erreur (généralement en anglais) en français.
 * Couvre les erreurs Auth Supabase, PostgREST/Postgres, réseau et Zod.
 */
export function toFrench(input: unknown): string {
  const raw =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : input && typeof input === "object" && "message" in input
          ? String((input as { message: unknown }).message)
          : "";
  const msg = (raw || "").trim();
  if (!msg) return "Une erreur est survenue. Réessayez.";
  const m = msg.toLowerCase();

  // --- Auth ---
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.";
  if (m.includes("email not confirmed"))
    return "Adresse e-mail non confirmée. Vérifiez votre boîte de réception.";
  if (m.includes("user not found") || m.includes("no user found"))
    return "Aucun compte ne correspond à ces informations.";
  if (m.includes("email address") && m.includes("invalid"))
    return "Adresse e-mail invalide.";
  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("already exists") ||
    m.includes("user already")
  )
    return "Cette adresse e-mail est déjà utilisée.";
  if (m.includes("same as") || m.includes("should be different"))
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (
    m.includes("weak password") ||
    m.includes("pwned") ||
    m.includes("compromised") ||
    m.includes("breach")
  )
    return "Ce mot de passe est trop faible ou compromis. Choisissez-en un autre.";
  if (m.includes("password should be at least") || m.includes("password is too short"))
    return "Mot de passe trop court (8 caractères minimum).";
  if (m.includes("token") && (m.includes("expired") || m.includes("invalid")))
    return "Lien ou code expiré. Veuillez recommencer.";
  if (m.includes("otp") && (m.includes("expired") || m.includes("invalid")))
    return "Code de vérification invalide ou expiré.";
  if (m.includes("session") && (m.includes("missing") || m.includes("expired")))
    return "Session expirée. Reconnectez-vous.";
  if (m.includes("unauthorized") || m.includes("not authorized") || m.includes("jwt"))
    return "Non autorisé. Reconnectez-vous.";
  if (m.includes("forbidden") || m.includes("permission denied") || m.includes("rls"))
    return "Action non autorisée.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "Ce mode de connexion n'est pas activé.";

  // --- Réseau / débit ---
  if (m.includes("rate limit") || m.includes("too many"))
    return "Trop de tentatives. Veuillez patienter quelques minutes.";
  if (
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed")
  )
    return "Connexion interrompue. Vérifiez votre réseau et réessayez.";
  if (m.includes("timeout") || m.includes("timed out"))
    return "Délai dépassé. Réessayez.";
  if (m.includes("offline"))
    return "Vous êtes hors ligne. Les modifications seront synchronisées plus tard.";

  // --- Base de données (PostgREST / Postgres) ---
  if (m.includes("duplicate key") || m.includes("unique constraint") || m.includes("already exists"))
    return "Cet enregistrement existe déjà.";
  if (m.includes("foreign key") || m.includes("violates foreign key"))
    return "Impossible : cet élément est utilisé ailleurs.";
  if (m.includes("not null") || m.includes("null value"))
    return "Un champ obligatoire est manquant.";
  if (m.includes("check constraint"))
    return "Valeur invalide pour ce champ.";
  if (m.includes("no rows") || m.includes("not found"))
    return "Introuvable.";

  // --- Génériques HTTP ---
  if (/\b(500|502|503|504)\b/.test(m) || m.includes("internal server"))
    return "Le serveur a rencontré un problème. Réessayez dans un instant.";
  if (/\b400\b/.test(m) || m.includes("bad request"))
    return "Requête invalide.";
  if (/\b404\b/.test(m))
    return "Ressource introuvable.";
  if (/\b409\b/.test(m) || m.includes("conflict"))
    return "Conflit : la ressource a été modifiée entre-temps.";

  // Déjà en français probable : contient un accent ou un mot FR courant
  if (/[àâäéèêëïîôöùûüç]/i.test(msg)) return msg;
  if (/\b(erreur|impossible|aucun|veuillez|échec|réessayez)\b/i.test(msg)) return msg;

  return msg;
}
