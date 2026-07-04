import { createFileRoute } from "@tanstack/react-router";
import { Crown, Check, X, School, GraduationCap, Users, FileText, Calendar, BookOpen } from "lucide-react";
import { PLAN_LABELS, type AppPlan } from "@/lib/queries/admin";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({ meta: [{ title: "Plans & tarifs — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: PlansPage,
});

interface Feature {
  label: string;
  icon: typeof Check;
  values: Record<AppPlan, string | boolean>;
}

const FEATURES: Feature[] = [
  {
    label: "Écoles",
    icon: School,
    values: { gratuit: "1", lite: "2", premium: "Illimité" },
  },
  {
    label: "Classes par école",
    icon: GraduationCap,
    values: { gratuit: "1", lite: "2", premium: "Illimité" },
  },
  {
    label: "Élèves",
    icon: Users,
    values: { gratuit: "25 max", lite: "Illimité", premium: "Illimité" },
  },
  {
    label: "Saisie des notes",
    icon: Check,
    values: { gratuit: true, lite: true, premium: true },
  },
  {
    label: "Emploi du temps",
    icon: Calendar,
    values: { gratuit: true, lite: true, premium: true },
  },
  {
    label: "Rapports & bulletins PDF",
    icon: FileText,
    values: { gratuit: false, lite: true, premium: true },
  },
  {
    label: "Progression pédagogique",
    icon: BookOpen,
    values: { gratuit: false, lite: false, premium: true },
  },
];

const PLAN_TONE: Record<AppPlan, string> = {
  gratuit: "border-muted",
  lite: "border-gold/50",
  premium: "border-teal/60",
};

const PLAN_BADGE: Record<AppPlan, string> = {
  gratuit: "bg-muted text-muted-foreground",
  lite: "bg-gold/25 text-ink",
  premium: "bg-teal text-cream",
};

function PlansPage() {
  const plans: AppPlan[] = ["gratuit", "lite", "premium"];

  return (
    <div className="space-y-5 px-5 py-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Backoffice
        </div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold text-foreground">
          <Crown className="h-7 w-7 text-gold" /> Plans & tarifs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Limites appliquées côté serveur pour chaque plan. L'attribution est
          manuelle depuis l'écran Utilisateurs.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p} className={`card-elevated border-2 p-5 ${PLAN_TONE[p]}`}>
            <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${PLAN_BADGE[p]}`}>
              {PLAN_LABELS[p]}
            </div>
            <ul className="mt-4 space-y-2.5">
              {FEATURES.map((f) => {
                const v = f.values[p];
                const enabled = v !== false;
                const Icon = f.icon;
                return (
                  <li key={f.label} className="flex items-start gap-2 text-sm">
                    {enabled ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                    )}
                    <span className={enabled ? "text-foreground" : "text-muted-foreground line-through"}>
                      <Icon className="mr-1 -mt-0.5 inline h-3.5 w-3.5 text-muted-foreground" />
                      {f.label}
                      {typeof v === "string" && (
                        <span className="ml-1 font-medium text-foreground">— {v}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="card-elevated p-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Application stricte :</strong> les
          limites sont vérifiées par des déclencheurs Postgres. Un enseignant qui
          dépasse la limite reçoit un message explicite et l'opération est refusée.
        </p>
      </div>
    </div>
  );
}
