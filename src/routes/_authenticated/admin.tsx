import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Layout de la console admin. Vérifie le rôle avant de laisser passer.
 * Sans admin → redirection vers l'accueil enseignant.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Console admin — MonRegistre" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/accueil" });
  },
  component: () => <Outlet />,
});
