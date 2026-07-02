import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  School,
  Users,
  GraduationCap,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profilQueryOptions } from "@/lib/queries/profil";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface AppShellProps {
  children: ReactNode;
}

const tabs = [
  { to: "/accueil", label: "Accueil", icon: Home },
  { to: "/ecoles", label: "Écoles", icon: School },
  { to: "/classes", label: "Classes", icon: GraduationCap },
  { to: "/eleves", label: "Élèves", icon: Users },
  { to: "/plus", label: "Plus", icon: MoreHorizontal },
] as const;

export function AppShell({ children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profil } = useQuery(profilQueryOptions());
  const navigate = useNavigate();

  const initiales = profil?.initiales?.slice(0, 2).toUpperCase() ?? "EM";
  const nom = profil?.nom_affiche || "Enseignant";
  const annee = profil?.annee_active || "Année scolaire";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col bg-background shadow-[0_0_60px_-30px_rgba(0,0,0,0.2)] md:max-w-lg lg:max-w-xl">
        {/* Top bar */}
        <header className="topbar-ink sticky top-0 z-30 flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gold font-semibold text-gold-foreground shadow-soft">
              {initiales}
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold">MonRegistre</div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-foreground/60">
                {annee}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Menu du profil"
                className="rounded-full p-2 text-ink-foreground/70 hover:bg-white/5 hover:text-ink-foreground"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{nom}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/parametres">Paramètres</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Contenu */}
        <main className="flex-1 pb-24">{children}</main>

        {/* Bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-border bg-card/95 backdrop-blur md:max-w-lg lg:max-w-xl">
          <ul className="grid grid-cols-5">
            {tabs.map((t) => {
              const active =
                t.to === "/accueil"
                  ? pathname === "/accueil" || pathname === "/"
                  : pathname.startsWith(t.to);
              const Icon = t.icon;
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={[
                      "flex flex-col items-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors",
                      active
                        ? "text-teal"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "h-5 w-5 transition-transform",
                        active ? "scale-110" : "",
                      ].join(" ")}
                    />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
