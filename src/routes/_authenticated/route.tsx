import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { AdminShell } from "@/components/app/admin-shell";
import { AnneeScolaireGate } from "@/components/app/annee-scolaire-gate";
import { SuspendedGate } from "@/components/app/suspended-gate";
import { PlanUpgradeNotice } from "@/components/app/plan-upgrade-notice";
import { currentUserRolesQO } from "@/lib/queries/admin";

const OFFLINE_SESSION_KEY = "mr-offline-session-anchor";
const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000; // 72h

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

    // 1) Hors ligne : on s'appuie sur la session locale (persistée par Supabase
    //    dans localStorage) et sur un ancrage temporel de 72h max.
    if (isOffline) {
      const { data: sessionData } = await supabase.auth.getSession();
      const anchorRaw = typeof localStorage !== "undefined" ? localStorage.getItem(OFFLINE_SESSION_KEY) : null;
      const anchor = anchorRaw ? Number(anchorRaw) : 0;
      const withinGrace = anchor > 0 && Date.now() - anchor < OFFLINE_GRACE_MS;
      if (sessionData.session?.user && withinGrace) {
        return { user: sessionData.session.user };
      }
      throw redirect({
        to: "/auth",
        search: { next: location.pathname + location.searchStr },
      });
    }

    // 2) En ligne : validation forte via l'API Auth.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw redirect({
          to: "/auth",
          search: { next: location.pathname + location.searchStr },
        });
      }
      // Rafraîchit l'ancrage 72h à chaque succès en ligne.
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(OFFLINE_SESSION_KEY, String(Date.now()));
      }
      return { user: data.user };
    } catch (err) {
      // Erreur réseau alors que navigator.onLine mentait : on retente en mode offline.
      if (err && typeof err === "object" && "to" in (err as object)) throw err;
      const { data: sessionData } = await supabase.auth.getSession();
      const anchorRaw = typeof localStorage !== "undefined" ? localStorage.getItem(OFFLINE_SESSION_KEY) : null;
      const anchor = anchorRaw ? Number(anchorRaw) : 0;
      const withinGrace = anchor > 0 && Date.now() - anchor < OFFLINE_GRACE_MS;
      if (sessionData.session?.user && withinGrace) {
        return { user: sessionData.session.user };
      }
      throw redirect({
        to: "/auth",
        search: { next: location.pathname + location.searchStr },
      });
    }
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
      <PlanUpgradeNotice />
      <Outlet />
    </AppShell>
  );
}
