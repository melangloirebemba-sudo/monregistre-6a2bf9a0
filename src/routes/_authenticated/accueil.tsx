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
  MapPin,
  Bell,
  CalendarX,
  AlertTriangle,
} from "lucide-react";
import { useMemo } from "react";
import { countsQueryOptions, profilQueryOptions } from "@/lib/queries/profil";
import { creneauxQO, classesQO, notesQO, absencesQO, periodesQO } from "@/lib/queries/data";
import { SyncStatusCard } from "@/components/app/sync-status-card";
import { useReminderPrefs } from "@/lib/reminders-prefs";
import { useReminderNotifications } from "@/lib/notifications";

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
  const { data: creneaux = [] } = useQuery(creneauxQO());
  const { data: classes = [] } = useQuery(classesQO());
  const { data: notes = [] } = useQuery(notesQO());
  const { data: absences = [] } = useQuery(absencesQO());
  const { data: periodes = [] } = useQuery(periodesQO());

  const reminderPrefs = useReminderPrefs();

  const reminders = useMemo(() => {
    const list: Array<{ id: string; label: string; to: string; tone: "warn" | "info" }> = [];
    const now = Date.now();
    const DAY = 86400000;

    // Aucune période définie
    if (reminderPrefs.noPeriodes && periodes.length === 0) {
      list.push({
        id: "no-periodes",
        label: "Aucune période définie — configurez trimestres ou semestres.",
        to: "/parametres",
        tone: "info",
      });
    }

    // Classes sans note (jamais) ou sans note récente
    if (reminderPrefs.noNotes || reminderPrefs.staleNotes) {
      const lastNoteByClasse = new Map<string, number>();
      for (const n of notes) {
        const cid = n.eleve?.classe_id;
        if (!cid) continue;
        const t = new Date(n.date).getTime();
        const prev = lastNoteByClasse.get(cid) ?? 0;
        if (t > prev) lastNoteByClasse.set(cid, t);
      }
      for (const c of classes) {
        const last = lastNoteByClasse.get(c.id);
        if (last === undefined) {
          if (reminderPrefs.noNotes) {
            list.push({
              id: `nonotes-${c.id}`,
              label: `${c.nom} — aucune note enregistrée.`,
              to: "/notes",
              tone: "warn",
            });
          }
        } else if (reminderPrefs.staleNotes) {
          const days = Math.floor((now - last) / DAY);
          if (days >= reminderPrefs.staleNotesDays) {
            list.push({
              id: `stale-${c.id}`,
              label: `${c.nom} — pas de note depuis ${days} jours.`,
              to: "/notes",
              tone: "warn",
            });
          }
        }
      }
    }

    // Absences non justifiées sur la fenêtre configurée
    if (reminderPrefs.absencesUnj) {
      const cutoff = now - reminderPrefs.absencesWindowDays * DAY;
      const recentUnj = absences.filter(
        (a) => !a.justifiee && new Date(a.date).getTime() >= cutoff,
      ).length;
      if (recentUnj > 0) {
        list.push({
          id: "absences-unj",
          label: `${recentUnj} absence(s) non justifiée(s) sur ${reminderPrefs.absencesWindowDays} j.`,
          to: "/absences",
          tone: "warn",
        });
      }
    }

    return list.slice(0, 5);
  }, [classes, notes, absences, periodes, reminderPrefs]);



  const nom = profil?.nom_affiche?.split(" ")[0] || "Enseignant";
  const annee = profil?.annee_active || "Aucune année active";

  // ISO day: Mon=1 ... Sun=7
  const jsDay = new Date().getDay();
  const todayIso = jsDay === 0 ? 7 : jsDay;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const todayCreneaux = creneaux
    .filter((c) => c.jour_semaine === todayIso)
    .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));

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

      {/* Aujourd'hui */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Aujourd'hui
            </span>
          </div>
          <Link to="/emploi-du-temps" className="text-xs text-teal hover:underline">
            Voir tout →
          </Link>
        </div>
        {todayCreneaux.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun créneau prévu aujourd'hui.
          </p>
        ) : (
          <ul className="space-y-2">
            {todayCreneaux.map((c) => {
              const isNow =
                toMin(c.heure_debut) <= nowMinutes && nowMinutes < toMin(c.heure_fin);
              const isPast = toMin(c.heure_fin) <= nowMinutes;
              return (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                    isNow
                      ? "border-teal bg-teal/10"
                      : isPast
                        ? "border-border bg-card opacity-50"
                        : "border-border bg-card"
                  }`}
                >
                  <div className="shrink-0 w-14 text-center">
                    <div className="text-sm font-semibold text-ink">
                      {c.heure_debut.slice(0, 5)}
                    </div>
                    <div className="text-[10px] text-ink/50">
                      {c.heure_fin.slice(0, 5)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {c.classe?.nom ?? "—"}
                      {c.matiere && (
                        <span className="text-ink/60 font-normal"> · {c.matiere}</span>
                      )}
                    </p>
                    <p className="text-xs text-ink/60 truncate">
                      {c.ecole?.nom}
                      {c.salle && (
                        <span className="inline-flex items-center gap-0.5 ml-1">
                          <MapPin className="h-3 w-3" />
                          {c.salle}
                        </span>
                      )}
                    </p>
                  </div>
                  {isNow && (
                    <span className="shrink-0 rounded-full bg-teal px-2 py-0.5 text-[10px] font-semibold text-cream">
                      En cours
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Rappels */}
      {reminders.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-gold">
            <Bell className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Rappels</span>
          </div>
          <ul className="space-y-2">
            {reminders.map((r) => {
              const Icon =
                r.id.startsWith("absences") ? CalendarX : r.tone === "warn" ? AlertTriangle : Bell;
              return (
                <li key={r.id}>
                  <Link
                    to={r.to}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:bg-cream-deep/50 ${
                      r.tone === "warn"
                        ? "border-gold/30 bg-gold/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        r.tone === "warn" ? "bg-gold/20 text-gold-foreground" : "bg-teal/15 text-teal"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm text-foreground">{r.label}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <SyncStatusCard className="mt-6" />

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
