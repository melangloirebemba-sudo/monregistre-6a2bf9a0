import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { AdminShell } from "@/components/app/admin-shell";
import { AnneeScolaireGate } from "@/components/app/annee-scolaire-gate";
import { SuspendedGate } from "@/components/app/suspended-gate";
import { currentUserRolesQO } from "@/lib/queries/admin";

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
  const { data: roles, isLoading } = useQuery(currentUserRolesQO());
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isAdmin = (roles ?? []).includes("admin");

  // Un admin est confiné au backoffice ; il n'a pas à voir les données des enseignants.
  useEffect(() => {
    if (isLoading) return;
    if (isAdmin && !pathname.startsWith("/admin")) {
      navigate({ to: "/admin", replace: true });
    }
    if (!isAdmin && pathname.startsWith("/admin")) {
      navigate({ to: "/accueil", replace: true });
    }
  }, [isAdmin, isLoading, pathname, navigate]);

  if (isAdmin) {
    return (
      <AdminShell>
        <SuspendedGate />
        <Outlet />
      </AdminShell>
    );
  }

  return (
    <AppShell>
      <SuspendedGate />
      <AnneeScolaireGate />
      <Outlet />
    </AppShell>
  );
}
