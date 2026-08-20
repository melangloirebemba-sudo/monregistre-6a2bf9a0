import { createFileRoute, Outlet } from "@tanstack/react-router";
import { verifyAdminAccess } from "@/lib/admin-guard.functions";

/**
 * Layout de la console admin. Le rôle est vérifié CÔTÉ SERVEUR via
 * `verifyAdminAccess` (RPC `has_role` en SECURITY DEFINER).
 *
 * IMPORTANT : en cas d'échec on NE redirige PAS vers `/accueil`. Le layout
 * `_authenticated` renvoie automatiquement les admins vers `/admin`, ce qui
 * créait une boucle de redirection (écran blanc). On affiche donc un écran
 * « accès refusé » stable à la place.
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
      return { adminOk: true };
    } catch {
      return { adminOk: false };
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { adminOk } = Route.useRouteContext();

  if (!adminOk) {
    return (
      <div className="px-4 py-10 text-center">
        <h1 className="font-display text-xl font-semibold text-foreground">
          Accès réservé aux administrateurs
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Votre session ne permet pas de vérifier vos droits. Reconnectez-vous
          puis réessayez.
        </p>
        <a
          href="/auth"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Se reconnecter
        </a>
      </div>
    );
  }

  return <Outlet />;
}
