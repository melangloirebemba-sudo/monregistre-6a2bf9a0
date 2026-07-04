import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { AnneeScolaireGate } from "@/components/app/annee-scolaire-gate";
import { SuspendedGate } from "@/components/app/suspended-gate";

// Porte d'authentification. `ssr: false` car la session Supabase vit dans
// localStorage — indisponible côté serveur.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { next: location.pathname + location.searchStr },
      });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <SuspendedGate />
      <AnneeScolaireGate />
      <Outlet />
    </AppShell>
  );
}
