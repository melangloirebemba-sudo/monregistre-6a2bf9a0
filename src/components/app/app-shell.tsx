import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  School,
  Users,
  GraduationCap,
  MoreHorizontal,
  LogOut,
  ClipboardList,
  BarChart3,
  CalendarDays,
  BookOpen,
  Settings,
  BookMarked,
  Shield,
  CalendarX,
  ArrowLeft,
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { profilQueryOptions } from "@/lib/queries/profil";
import { currentUserRolesQO } from "@/lib/queries/admin";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { OfflineIndicator } from "@/components/app/offline-indicator";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { toast } from "sonner";

interface AppShellProps {
  children: ReactNode;
}

const bottomTabs = [
  { to: "/accueil", label: "Accueil", icon: Home },
  { to: "/ecoles", label: "Écoles", icon: School },
  { to: "/classes", label: "Classes", icon: GraduationCap },
  { to: "/eleves", label: "Élèves", icon: Users },
  { to: "/plus", label: "Plus", icon: MoreHorizontal },
] as const;

const sideNav = [
  { to: "/accueil", label: "Accueil", icon: Home },
  { to: "/ecoles", label: "Écoles", icon: School },
  { to: "/classes", label: "Classes", icon: GraduationCap },
  { to: "/eleves", label: "Élèves", icon: Users },
  { to: "/notes", label: "Notes", icon: ClipboardList },
  { to: "/absences", label: "Absences", icon: CalendarX },
  { to: "/rapports", label: "Rapports", icon: BarChart3 },
  { to: "/emploi-du-temps", label: "Emploi du temps", icon: CalendarDays },
  { to: "/progression", label: "Progression", icon: BookOpen },
  { to: "/parametres", label: "Paramètres", icon: Settings },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/accueil") return pathname === "/accueil" || pathname === "/";
  return pathname === to || pathname.startsWith(to + "/");
}

export function AppShell({ children }: AppShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: roles } = useQuery(currentUserRolesQO());
  const isAdmin = (roles ?? []).includes("admin");
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
    <div className="min-h-screen bg-background lg:flex">
      {/* Sidebar desktop */}
      <aside className="topbar-ink hidden shrink-0 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:flex-col xl:w-72">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground shadow-soft">
            <BookMarked className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="font-display text-lg font-semibold">MonRegistre</div>
            <div className="truncate text-[10px] uppercase tracking-[0.22em] text-ink-foreground/60">
              {annee}
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {sideNav.map((t) => {
            const active = isActive(pathname, t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-gold-soft"
                    : "text-ink-foreground/70 hover:bg-white/5 hover:text-ink-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className={[
                "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(pathname, "/admin")
                  ? "bg-teal/30 text-gold-soft"
                  : "bg-teal/15 text-ink-foreground/90 hover:bg-teal/25",
              ].join(" ")}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span className="truncate">Espace admin</span>
            </Link>
          )}
        </nav>
        <div className="border-t border-white/10 p-3 space-y-1">
          <NotificationsBell variant="sidebar" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink-foreground/80 hover:bg-white/5 hover:text-ink-foreground">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold font-display text-xs font-semibold text-gold-foreground">
                  {initiales}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{nom}</span>
                  <span className="block truncate text-[10px] text-ink-foreground/60">
                    Compte
                  </span>
                </span>
                <MoreHorizontal className="h-4 w-4 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{nom}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/mon-profil">Mon profil</Link>
              </DropdownMenuItem>
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
        </div>
      </aside>


      {/* Zone principale */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Top bar mobile/tablet */}
        <header className="topbar-ink sticky top-0 z-30 flex items-center justify-between px-5 py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            {(() => {
              const rootRoutes = ["/accueil", "/", "/ecoles", "/classes", "/eleves", "/plus", "/admin"];
              const showBack = !rootRoutes.includes(pathname);
              if (!showBack) return null;
              return (
                <button
                  type="button"
                  aria-label="Retour"
                  onClick={() => {
                    if (window.history.length > 1) window.history.back();
                    else navigate({ to: "/accueil" });
                  }}
                  className="shrink-0 rounded-full p-2 text-ink-foreground/80 hover:bg-white/10 hover:text-ink-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              );
            })()}
            <Link
              to="/mon-profil"
              aria-label="Mon profil"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold font-semibold text-gold-foreground shadow-soft transition-transform hover:scale-105"
            >
              {initiales}
            </Link>
            <div className="min-w-0 leading-tight">
              <div className="font-display text-lg font-semibold">MonRegistre</div>
              <div className="truncate text-[10px] uppercase tracking-[0.22em] text-ink-foreground/60">
                {annee}
              </div>
            </div>
          </div>


          <div className="flex items-center gap-1">
            <NotificationsBell variant="topbar" />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Menu du profil"
                className="shrink-0 rounded-full p-2 text-ink-foreground/70 hover:bg-white/5 hover:text-ink-foreground"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{nom}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/mon-profil">Mon profil</Link>
              </DropdownMenuItem>
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
          </div>
        </header>


        {/* Contenu */}
        <main className="flex-1 pb-24 lg:pb-10">
          <div className="mx-auto w-full max-w-[440px] sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl">
            {children}
          </div>
        </main>

        {/* Bottom nav mobile/tablet */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
          <ul className="mx-auto grid max-w-2xl grid-cols-5">
            {bottomTabs.map((t) => {
              const active = isActive(pathname, t.to);
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
      <OfflineIndicator />
    </div>
  );
}
