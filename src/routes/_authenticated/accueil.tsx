import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  School,
  GraduationCap,
  Users,
  ClipboardList,
  BarChart3,
  Plus,
  CalendarDays,
  BookOpen,
} from "lucide-react";
import { countsQueryOptions, profilQueryOptions } from "@/lib/queries/profil";

export const Route = createFileRoute("/_authenticated/accueil")({
  head: () => ({
    meta: [
      { title: "Accueil — MonRegistre" },
      { name: "description", content: "Tableau de bord de votre registre enseignant." },
    ],
  }),
  component: AccueilPage,
});

function AccueilPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: counts } = useQuery(countsQueryOptions());

  const nom = profil?.nom_affiche?.split(" ")[0] || "Enseignant";
  const annee = profil?.annee_active || "Aucune année active";

  const badges = [
    { label: "Écoles", value: counts?.ecoles ?? 0 },
    { label: "Classes", value: counts?.classes ?? 0 },
    { label: "Élèves", value: counts?.eleves ?? 0 },
  ];

  const quickActions = [
    { to: "/ecoles", label: "École", icon: School },
    { to: "/classes", label: "Classe", icon: GraduationCap },
    { to: "/eleves", label: "Élève", icon: Users },
    { to: "/notes", label: "Note", icon: ClipboardList },
    { to: "/rapports", label: "Rapport", icon: BarChart3 },
  ] as const;

  const menu = [
    {
      to: "/ecoles",
      label: "Écoles",
      count: counts?.ecoles ?? 0,
      icon: "🏫",
      tint: "bg-gold/15 text-ink",
    },
    {
      to: "/classes",
      label: "Classes",
      count: counts?.classes ?? 0,
      icon: "🎓",
      tint: "bg-teal/15 text-ink",
    },
    {
      to: "/eleves",
      label: "Élèves",
      count: counts?.eleves ?? 0,
      icon: "🧑‍🎓",
      tint: "bg-cream-deep text-ink",
    },
    {
      to: "/notes",
      label: "Notes",
      count: counts?.notes ?? 0,
      icon: "📝",
      tint: "bg-gold-soft/50 text-ink",
    },
    {
      to: "/rapports",
      label: "Rapports",
      count: null,
      icon: "📊",
      tint: "bg-teal-soft/25 text-ink",
    },
    {
      to: "/emploi-du-temps",
      label: "Emploi du temps",
      count: null,
      icon: "📅",
      tint: "bg-cream-deep text-ink",
    },
  ] as const;

  return (
    <div className="px-5 pb-6 pt-5">
      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 shadow-[var(--shadow-hero)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.2em] text-ink-foreground/60">
            Bonjour
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink-foreground">
            {nom}
          </h1>
          <div className="mt-1 text-sm text-ink-foreground/70">{annee}</div>

          <div className="mt-5 flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-ink-foreground/90 backdrop-blur"
              >
                <span className="font-display text-sm font-semibold text-gold-soft">
                  {b.value}
                </span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Actions rapides */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">
            Actions rapides
          </h2>
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to}
                className="group flex min-w-[92px] snap-start flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-center text-xs font-medium shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-ink">
                  <Icon className="h-5 w-5" />
                  <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-teal text-[10px] text-teal-foreground">
                    <Plus className="h-3 w-3" />
                  </span>
                </span>
                {a.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Aujourd'hui — placeholder */}
      <section className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 p-5">
        <div className="mb-2 flex items-center gap-2 text-teal">
          <CalendarDays className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Aujourd'hui
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Vos créneaux du jour apparaîtront ici dès que vous aurez configuré votre emploi du
          temps.
        </p>
      </section>

      {/* Grille menu */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-base font-semibold text-foreground">
          Mon registre
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {menu.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group card-elevated flex flex-col justify-between p-4 transition-transform hover:-translate-y-0.5"
            >
              <div
                className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg ${m.tint}`}
              >
                <span>{m.icon}</span>
              </div>
              <div>
                <div className="font-display text-sm font-semibold text-foreground">
                  {m.label}
                </div>
                {m.count !== null ? (
                  <div className="mt-0.5 font-display text-2xl font-semibold text-teal">
                    {m.count}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-muted-foreground">Ouvrir</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Progression — placeholder */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center gap-2 text-gold">
          <BookOpen className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Où j'en suis
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Le suivi de progression par trimestre s'affichera ici une fois vos séquences
          programmées.
        </p>
      </section>
    </div>
  );
}
