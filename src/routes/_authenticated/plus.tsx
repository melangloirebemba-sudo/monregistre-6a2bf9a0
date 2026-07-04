import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  BarChart3,
  CalendarDays,
  BookOpen,
  Settings,
  ChevronRight,
  UserCircle2,
  CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/plus")({
  head: () => ({ meta: [{ title: "Plus — MonRegistre" }] }),
  component: PlusPage,
});

const items = [
  { to: "/mon-profil", label: "Mon profil", desc: "Informations personnelles", icon: UserCircle2 },
  { to: "/annees-scolaires", label: "Années scolaires", desc: "Créer, activer, archiver", icon: CalendarClock },
  { to: "/notes", label: "Notes", desc: "Saisie et suivi des notes", icon: ClipboardList },
  { to: "/rapports", label: "Rapports & bulletins", desc: "Moyennes, classements, PDF", icon: BarChart3 },
  { to: "/emploi-du-temps", label: "Emploi du temps", desc: "Créneaux par classe et école", icon: CalendarDays },
  { to: "/progression", label: "Progression pédagogique", desc: "Séquences par trimestre", icon: BookOpen },
  { to: "/parametres", label: "Paramètres", desc: "Année scolaire, notation, périodes", icon: Settings },
] as const;


function PlusPage() {
  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Menu
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Plus</h1>
      </div>
      <ul className="space-y-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className="card-elevated flex items-center gap-3 p-4 transition-colors hover:bg-cream-deep/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-ink">
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
