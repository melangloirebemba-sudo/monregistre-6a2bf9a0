import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  School,
  GraduationCap,
  UserCog,
  Ban,
  Crown,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Activity,
  Settings2,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    staleTime: 30_000,
  });


  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:px-5 sm:py-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Backoffice
        </div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
          <ShieldCheck className="h-6 w-6 shrink-0 text-teal sm:h-7 sm:w-7" />
          <span className="truncate">Tableau de bord</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d'ensemble de la plateforme — comptes enseignants, plans et activité.
        </p>
      </header>

      {isLoading && (
        <div className="card-elevated p-6 text-sm text-muted-foreground">
          Chargement des statistiques…
        </div>
      )}
      {error && (
        <div className="card-elevated p-6 text-sm text-destructive">
          Erreur : {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          {/* KPI utilisateurs */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Comptes
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi icon={Users} label="Enseignants" value={data.totalUsers} tone="teal" />
              <Kpi icon={Activity} label="Actifs 30j" value={data.actifs30j} tone="gold" />
              <Kpi icon={UserCog} label="Administrateurs" value={data.admins} />
              <Kpi icon={Ban} label="Suspendus" value={data.suspendus} tone={data.suspendus > 0 ? "warn" : undefined} />
            </div>
          </section>

          {/* Répartition plans */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Répartition des plans
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <PlanCard name="Gratuit" count={data.planGratuit} total={data.totalUsers} accent="muted" />
              <PlanCard name="Lite" count={data.planLite} total={data.totalUsers} accent="gold" />
              <PlanCard name="Premium" count={data.planPremium} total={data.totalUsers} accent="teal" />
            </div>
          </section>

          {/* Données globales (agrégées, aucune donnée nominative) */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Activité de la plateforme
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Kpi icon={School} label="Écoles enregistrées" value={data.totalEcoles} />
              <Kpi icon={GraduationCap} label="Classes" value={data.totalClasses} />
              <Kpi icon={Users} label="Élèves" value={data.totalEleves} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Données agrégées — l'administrateur ne consulte pas le contenu pédagogique des enseignants.
            </p>
          </section>

          {/* Accès rapides */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Accès rapides
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickLink to="/admin/utilisateurs" icon={Users} title="Gérer les utilisateurs" desc="Plans, suspension, mot de passe, suppression" />
              <QuickLink to="/admin/plans" icon={Crown} title="Plans & tarifs" desc="Consulter les limites de chaque plan" />
              <QuickLink to="/admin/parametres" icon={Settings2} title="Paramètres" desc="Thème, support, e-mail et mot de passe admin" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone?: "teal" | "gold" | "warn";
}) {
  const toneCls =
    tone === "warn"
      ? "border-destructive/40 text-destructive"
      : tone === "teal"
        ? "border-teal/40"
        : tone === "gold"
          ? "border-gold/40"
          : "";
  const iconCls =
    tone === "warn"
      ? "bg-destructive/10 text-destructive"
      : tone === "teal"
        ? "bg-teal/15 text-teal"
        : tone === "gold"
          ? "bg-gold/20 text-ink"
          : "bg-muted text-muted-foreground";
  return (
    <div className={`card-elevated p-4 ${toneCls}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${iconCls}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  count,
  total,
  accent,
}: {
  name: string;
  count: number;
  total: number;
  accent: "muted" | "gold" | "teal";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const bar =
    accent === "teal" ? "bg-teal" : accent === "gold" ? "bg-gold" : "bg-muted-foreground/50";
  const chip =
    accent === "teal"
      ? "bg-teal/15 text-teal"
      : accent === "gold"
        ? "bg-gold/20 text-ink"
        : "bg-muted text-muted-foreground";
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${chip}`}>
          <Sparkles className="mr-1 -mt-0.5 inline h-3 w-3" />
          {name}
        </span>
        <span className="font-display text-2xl font-semibold text-foreground">{count}</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{pct}% des comptes</div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="card-elevated flex items-center gap-3 p-4 transition-colors hover:bg-cream-deep/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-teal/15 text-teal">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1">
        <span className="block font-display text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}
