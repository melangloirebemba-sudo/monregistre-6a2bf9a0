import { supabase } from "@/integrations/supabase/client";

/**
 * Retourne `true` si l'utilisateur `userId` possède le rôle `admin`.
 * Renvoie `false` en cas d'erreur (défaut sûr : espace enseignant).
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

/**
 * Détermine la page d'atterrissage après connexion en fonction du rôle.
 * - Si un `next` explicite non-défaut est fourni, il est respecté.
 * - Sinon : `/admin` pour les admins, `/accueil` pour les enseignants.
 */
export async function resolveLandingPath(
  userId: string,
  requestedNext?: string,
): Promise<string> {
  const admin = await isUserAdmin(userId);
  const hasExplicitTarget =
    requestedNext &&
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//") &&
    requestedNext !== "/accueil" &&
    requestedNext !== "/";
  if (hasExplicitTarget) return requestedNext!;
  return admin ? "/admin" : "/accueil";
}
