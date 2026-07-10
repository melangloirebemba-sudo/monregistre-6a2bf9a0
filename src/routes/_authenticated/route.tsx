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

    const readAnchor = () => {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(OFFLINE_SESSION_KEY) : null;
      return raw ? Number(raw) : 0;
    };
    const writeAnchor = () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(OFFLINE_SESSION_KEY, String(Date.now()));
      }
    };
    const bounce = () =>
      redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });

    // Toujours consulter la session locale d'abord : elle est persistée par
    // Supabase (localStorage) et suffit à maintenir l'espace protégé.
    const { data: sessionData } = await supabase.auth.getSession();
    const localUser = sessionData.session?.user ?? null;

    // Si on a une session locale, ancre la fenêtre de 72h dès maintenant
    // (utile au tout premier chargement avant même un getUser() réussi).
    if (localUser && readAnchor() === 0) writeAnchor();

    const anchor = readAnchor();
    const withinGrace = anchor > 0 && Date.now() - anchor < OFFLINE_GRACE_MS;

    // 1) Hors ligne : on reste dans l'espace protégé tant que la session
    //    locale existe et que la fenêtre de 72h n'est pas dépassée.
    if (isOffline) {
      if (localUser && withinGrace) return { user: localUser };
      throw bounce();
    }

    // 2) En ligne : validation forte via l'API Auth, avec repli hors ligne
    //    en cas d'erreur réseau transitoire (Wi-Fi qui coupe, 5xx, timeout).
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) {
        // Vraie déconnexion serveur : on nettoie l'ancrage.
        if (typeof localStorage !== "undefined") localStorage.removeItem(OFFLINE_SESSION_KEY);
        throw bounce();
      }
      writeAnchor();
      return { user: data.user };
    } catch (err) {
      // Redirection : on la laisse passer.
      if (err && typeof err === "object" && "to" in (err as object)) throw err;
      // Erreur réseau : on retombe sur la session locale si dispo.
      if (localUser && withinGrace) return { user: localUser };
      throw bounce();
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
