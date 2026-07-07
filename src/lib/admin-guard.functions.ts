import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Vérifie côté serveur que l'utilisateur authentifié possède bien le rôle `admin`.
 * S'appuie sur la fonction SECURITY DEFINER `public.has_role(uuid, app_role)`
 * pour éviter toute manipulation depuis le client.
 *
 * Retourne `{ isAdmin: true, userId }` en cas de succès. Lance une erreur
 * `Forbidden` sinon (le middleware `requireSupabaseAuth` traite déjà l'absence
 * de session avec un 401).
 */
export const verifyAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) {
      throw new Error(`Impossible de vérifier le rôle: ${error.message}`);
    }
    if (data !== true) {
      throw new Error("Forbidden: admin only");
    }
    return { isAdmin: true as const, userId: context.userId };
  });
