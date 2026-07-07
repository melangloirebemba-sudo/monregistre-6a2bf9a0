import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BellRing,
  Receipt,
  CalendarClock,
  Crown,
  Settings,
  ChevronRight,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/plus")({
  head: () => ({ meta: [{ title: "Plus — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminPlusPage,
});

const items = [
  { to: "/admin/notifications", label: "Notifications", desc: "Composer et programmer les notifications", icon: BellRing },
  { to: "/admin/facturation", label: "Facturation", desc: "Reçus, activations, historique", icon: Receipt },
  { to: "/admin/annees-scolaires", label: "Années scolaires", desc: "Gérer les années globales", icon: CalendarClock },
  { to: "/admin/plans", label: "Plans", desc: "Limites et tarifs des plans", icon: Crown },
  { to: "/admin/parametres", label: "Paramètres", desc: "Configuration de l'application", icon: Settings },
] as const;

function AdminPlusPage() {
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Console admin
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Plus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accès rapide aux autres sections de la console.
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                preload={false}
                className="card-elevated flex items-center gap-3 p-4 transition-colors hover:bg-cream-deep/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal/15 text-teal">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-sm font-semibold text-foreground">
                    {it.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{it.desc}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

}
