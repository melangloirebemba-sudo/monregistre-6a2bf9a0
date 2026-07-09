import type { ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Crown,
  CalendarClock,
  Receipt,
  Shield,
  LogOut,
  MoreHorizontal,
  ShieldCheck,
  BellRing,
  ArrowLeft,
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
import { NotificationsBell } from "@/components/app/notifications-bell";
import { toast } from "sonner";

interface AdminShellProps {
  children: ReactNode;
}

const adminNav = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/admin/notifications", label: "Notifications", icon: BellRing },
  { to: "/admin/facturation", label: "Facturation", icon: Receipt },
  { to: "/admin/annees-scolaires", label: "Années", icon: CalendarClock },
  { to: "/admin/plans", label: "Plans", icon: Crown },
] as const;

// Navigation mobile compacte : les rubriques secondaires sont regroupées sous « Plus ».
const mobileNav = [
  { to: "/admin", label: "Accueil", icon: LayoutDashboard },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { to: "/admin/notifications", label: "Notifs", icon: BellRing },
  { to: "/admin/plus", label: "Plus", icon: MoreHorizontal },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/admin") return pathname === "/admin";
  return pathname === to || pathname.startsWith(to + "/");
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: profil } = useQuery(profilQueryOptions());
  const navigate = useNavigate();

  const initiales = profil?.initiales?.slice(0, 2).toUpperCase() ?? "AD";
  const nom = profil?.nom_affiche || "Administrateur";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-dvh bg-background lg:flex">
      {/* Sidebar desktop — palette identique aux enseignants */}
      <aside aria-label="Navigation admin" className="topbar-ink hidden shrink-0 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:flex-col xl:w-72">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal text-ink-foreground shadow-soft">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="font-display text-lg font-semibold">Console admin</div>
            <div className="truncate text-[10px] uppercase tracking-[0.22em] text-ink-foreground/60">
              MonRegistre — Backoffice
            </div>
          </div>
        </div>
        <nav aria-label="Sections admin" className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {adminNav.map((t) => {
            const active = isActive(pathname, t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
                  active
                    ? "bg-teal/25 text-gold-soft"
                    : "text-ink-foreground/80 hover:bg-white/5 hover:text-ink-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Compte : ${nom}`}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink-foreground/80 hover:bg-white/5 hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal font-display text-xs font-semibold text-ink-foreground">
                  {initiales}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{nom}</span>
                  <span className="block truncate text-[10px] text-ink-foreground/60">
                    Administrateur
                  </span>
                </span>
                <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{nom}</DropdownMenuLabel>
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
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Topbar desktop — accès rapide aux notifications */}
        <header className="topbar-ink sticky top-0 z-30 hidden items-center justify-end gap-2 border-b border-white/10 px-6 py-2 lg:flex">
          <NotificationsBell variant="topbar" />
        </header>

        {/* Topbar mobile/tablet */}
        <header className="topbar-ink sticky top-0 z-30 flex items-center justify-between px-5 py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            {pathname !== "/admin" && (
              <button
                type="button"
                aria-label="Retour"
                onClick={() => {
                  if (window.history.length > 1) window.history.back();
                  else navigate({ to: "/admin" });
                }}
                className="shrink-0 rounded-full p-2 text-ink-foreground/80 hover:bg-white/10 hover:text-ink-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal font-semibold text-ink-foreground shadow-soft">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="font-display text-lg font-semibold">Console admin</div>
              <div className="truncate text-[10px] uppercase tracking-[0.22em] text-ink-foreground/60">
                {nom}
              </div>
            </div>
          </div>


          <div className="flex items-center gap-1">
            <NotificationsBell variant="topbar" />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Ouvrir le menu du compte"
                className="shrink-0 rounded-full p-2 text-ink-foreground/80 hover:bg-white/5 hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{nom}</DropdownMenuLabel>
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
          <div className="mx-auto w-full max-w-2xl px-1 sm:px-0 lg:max-w-5xl xl:max-w-6xl">
            {children}
          </div>
        </main>

        {/* Bottom nav mobile */}
        <nav aria-label="Navigation admin mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
          <ul className="mx-auto grid max-w-2xl grid-cols-4">
            {mobileNav.map((t) => {
              const active = isActive(pathname, t.to);
              const Icon = t.icon;
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    aria-current={active ? "page" : undefined}
                    aria-label={t.label}
                    className={[
                      "flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-2 text-[10.5px] font-medium leading-tight transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal",
                      active ? "text-teal" : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className={["h-5 w-5", active ? "scale-110" : ""].join(" ")} aria-hidden="true" />
                    <span className="truncate">{t.label}</span>
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
