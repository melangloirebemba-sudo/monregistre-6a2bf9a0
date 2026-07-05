import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bell,
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { supportConfig } from "@/config/support";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});

type PlanRow = {
  user_id: string;
  nom_affiche: string | null;
  email: string | null;
  telephone: string | null;
  plan: "gratuit" | "lite" | "premium";
  plan_periode: "mensuelle" | "trimestrielle" | "annuelle" | null;
  plan_expires_at: string | null;
};

const SOON_DAYS = 7;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysDiff(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    staleTime: 30_000,
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["admin", "plans-usage"],
    staleTime: 60_000,
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase
        .from("profils_enseignant")
        .select("user_id, nom_affiche, email, telephone, plan, plan_periode, plan_expires_at")
        .in("plan", ["lite", "premium"])
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });

  const { actifs, bientot, expires } = useMemo(() => {
    const actifs: PlanRow[] = [];
    const bientot: PlanRow[] = [];
    const expires: PlanRow[] = [];
    const now = Date.now();
    const soon = now + SOON_DAYS * 86_400_000;
    for (const p of plans) {
      if (!p.plan_expires_at) {
        actifs.push(p);
        continue;
      }
      const t = new Date(p.plan_expires_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t <= now) expires.push(p);
      else if (t <= soon) bientot.push(p);
      else actifs.push(p);
    }
    const byDate = (a: PlanRow, b: PlanRow) =>
      new Date(a.plan_expires_at ?? 0).getTime() - new Date(b.plan_expires_at ?? 0).getTime();
    bientot.sort(byDate);
    expires.sort(byDate);
    return { actifs, bientot, expires };
  }, [plans]);




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

          {/* État des abonnements — actifs / à renouveler / expirés */}
          <PlansStatusSection
            actifs={actifs}
            bientot={bientot}
            expires={expires}
            loading={loadingPlans}
          />



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
              <QuickLink to="/admin/facturation" icon={Receipt} title="Facturation & paiements" desc="Voir toutes les factures et paiements" />
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

const PLAN_LABEL_UI: Record<PlanRow["plan"], string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};

function buildReminderMessage(p: PlanRow, tone: "renouvellement" | "expire"): string {
  const nom = p.nom_affiche || "cher enseignant";
  const planLabel = PLAN_LABEL_UI[p.plan];
  const dateStr = fmtDate(p.plan_expires_at);
  if (tone === "expire") {
    return [
      `Bonjour ${nom},`,
      "",
      `Votre abonnement MonRegistre (plan ${planLabel}) a expiré le ${dateStr}.`,
      "Pour continuer à profiter de toutes les fonctionnalités, merci de procéder au renouvellement.",
      "",
      "L'équipe MonRegistre.",
    ].join("\n");
  }
  return [
    `Bonjour ${nom},`,
    "",
    `Votre abonnement MonRegistre (plan ${planLabel}) arrive à échéance le ${dateStr}.`,
    "Pensez à le renouveler pour éviter toute interruption de service.",
    "",
    "L'équipe MonRegistre.",
  ].join("\n");
}

function whatsappHrefFor(phone: string | null, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function mailtoHrefFor(email: string | null, message: string, subject: string): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}

function PlansStatusSection({
  actifs,
  bientot,
  expires,
  loading,
}: {
  actifs: PlanRow[];
  bientot: PlanRow[];
  expires: PlanRow[];
  loading: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        État des abonnements
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={CheckCircle2} label="En cours" value={actifs.length} tone="teal" />
        <Kpi
          icon={Clock}
          label={`Bientôt (< ${SOON_DAYS} j)`}
          value={bientot.length}
          tone={bientot.length > 0 ? "gold" : undefined}
        />
        <Kpi
          icon={AlertTriangle}
          label="Expirés"
          value={expires.length}
          tone={expires.length > 0 ? "warn" : undefined}
        />
      </div>

      {loading ? (
        <div className="card-elevated mt-3 p-4 text-sm text-muted-foreground">
          Chargement des abonnements…
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <PlanList
            title={`À renouveler bientôt (< ${SOON_DAYS} jours)`}
            icon={Clock}
            tone="gold"
            emptyLabel="Aucun abonnement n'expire dans les 7 prochains jours."
            items={bientot}
            reminderTone="renouvellement"
          />
          <PlanList
            title="Abonnements expirés"
            icon={AlertTriangle}
            tone="warn"
            emptyLabel="Aucun abonnement expiré."
            items={expires}
            reminderTone="expire"
          />
        </div>
      )}
    </section>
  );
}

function PlanList({
  title,
  icon: Icon,
  tone,
  emptyLabel,
  items,
  reminderTone,
}: {
  title: string;
  icon: typeof Bell;
  tone: "gold" | "warn";
  emptyLabel: string;
  items: PlanRow[];
  reminderTone: "renouvellement" | "expire";
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);
  const chip =
    tone === "warn"
      ? "bg-destructive/10 text-destructive"
      : "bg-gold/20 text-ink";
  return (
    <div className="card-elevated p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${chip}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="flex-1 font-display text-sm font-semibold text-foreground">
          {title}
        </h3>
        <span className="text-xs font-semibold text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => {
            const diff = daysDiff(p.plan_expires_at);
            const message = buildReminderMessage(p, reminderTone);
            const subject =
              reminderTone === "expire"
                ? "Renouvellement de votre abonnement MonRegistre"
                : "Rappel : votre abonnement MonRegistre expire bientôt";
            const wa = whatsappHrefFor(p.telephone, message);
            const mail = mailtoHrefFor(p.email, message, subject);
            const supportWa = `https://wa.me/${supportConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
            return (
              <li
                key={p.user_id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {p.nom_affiche || "—"}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {PLAN_LABEL_UI[p.plan]}
                    </span>
                  </div>
                  {p.email && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {p.email}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {reminderTone === "expire" ? "Expiré le " : "Expire le "}
                    <span className="font-medium text-foreground">{fmtDate(p.plan_expires_at)}</span>
                    {diff !== null && (
                      <span className={tone === "warn" ? "ml-1 text-destructive" : "ml-1 text-ink"}>
                        ({diff >= 0 ? `dans ${diff} j` : `il y a ${Math.abs(diff)} j`})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 px-2"
                    aria-label={`Rappeler par WhatsApp ${p.nom_affiche ?? ""}`}
                    title={wa ? "Envoyer par WhatsApp" : "Envoyer via le support (numéro non renseigné)"}
                  >
                    <a href={wa ?? supportWa} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  </Button>
                  {mail && (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2"
                      aria-label={`Rappeler par e-mail ${p.nom_affiche ?? ""}`}
                      title="Envoyer par e-mail"
                    >
                      <a href={mail}>
                        <Mail className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">E-mail</span>
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Réduire
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Voir les {items.length - 5} autres
            </>
          )}
        </button>
      )}
    </div>
  );
}

