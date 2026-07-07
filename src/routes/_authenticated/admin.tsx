import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { verifyAdminAccess } from "@/lib/admin-guard.functions";

/**
 * Layout de la console admin. Le rôle est vérifié CÔTÉ SERVEUR via
 * `verifyAdminAccess` (RPC `has_role` en SECURITY DEFINER) afin qu'un
 * utilisateur ne puisse pas contourner le contrôle depuis le navigateur.
 * Toute la sous-arborescence `/admin/*` (dont `/admin/plus`) est protégée.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Console admin — MonRegistre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    try {
      await verifyAdminAccess();
    } catch {
      // Session absente, rôle manquant, ou erreur de vérification :
      // on redirige vers l'accueil enseignant. Le layout `_authenticated`
      // s'occupe déjà de rediriger vers `/auth` si la session manque.
      throw redirect({ to: "/accueil" });
    }
  },
  component: () => <Outlet />,
});
