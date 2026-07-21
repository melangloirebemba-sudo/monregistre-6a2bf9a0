import { createFileRoute, Link } from "@tanstack/react-router";
import { toFrench } from "@/lib/errors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2, Check, X, Sparkles, ArrowUpRight, Crown, Zap, Mail, Clock, AlertTriangle, History, ShieldAlert } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { profilQueryOptions, planCapabilitiesQO, type Profil, type PlanCapabilities } from "@/lib/queries/profil";
import { periodesQO, requireUserId, type Periode } from "@/lib/queries/data";
import { supabase } from "@/integrations/supabase/client";
import { enqueueWrite } from "@/lib/offline-queue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PLAN_LABEL, upgradeWhatsAppHref } from "@/config/support";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SyncStatusCard } from "@/components/app/sync-status-card";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — MonRegistre" }] }),
  component: ParametresPage,
});

function ParametresPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: caps } = useQuery(planCapabilitiesQO());
  const { data: periodes = [] } = useQuery(periodesQO());
  const qc = useQueryClient();


  const [nom, setNom] = useState("");
  const [initiales, setInitiales] = useState("");
  const [annee, setAnnee] = useState("");
  const [echelle, setEchelle] = useState("20");

  useEffect(() => {
    if (!profil) return;
    setNom(profil.nom_affiche ?? "");
    setInitiales(profil.initiales ?? "");
    setAnnee(profil.annee_active ?? "");
    setEchelle(String(profil.echelle_notation ?? 20));
  }, [profil]);

  const save = useMutation({
    mutationFn: async () => {
      const uid = await requireUserId();
      const patch: Partial<Profil> = {
        nom_affiche: nom.trim(),
        initiales: initiales.trim().slice(0, 2).toUpperCase() || "EM",
        annee_active: annee.trim(),
        echelle_notation: Number(echelle),
      };
      const { error } = await supabase
        .from("profils_enseignant")
        .update(patch)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enregistré");
      qc.invalidateQueries({ queryKey: ["profil"] });
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const [newPeriode, setNewPeriode] = useState("");
  const addPeriode = useMutation({
    mutationFn: async () => {
      const label = newPeriode.trim();
      if (!label) throw new Error("Nom obligatoire");
      const user_id = await requireUserId();
      const ordre = periodes.length + 1;
      await enqueueWrite({
        table: "periodes",
        op: "insert",
        payload: {
          id: crypto.randomUUID(),
          user_id,
          label,
          ordre,
          annee_scolaire: annee || new Date().getFullYear() + "",
          active: periodes.length === 0,
        },
        label: `Ajouter la période ${label}`,
      });
    },
    onSuccess: () => {
      setNewPeriode("");
      toast.success("Période ajoutée");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const togglePeriode = useMutation({
    mutationFn: async (p: Periode) => {
      // Désactive individuellement chaque période actuellement active (par id)
      // pour que le miroir local hors-ligne reflète correctement chaque ligne.
      for (const other of periodes) {
        if (other.active && other.id !== p.id) {
          await enqueueWrite({
            table: "periodes",
            op: "update",
            payload: { active: false },
            match: { id: other.id },
            label: `Désactiver ${other.label}`,
          });
        }
      }
      await enqueueWrite({
        table: "periodes",
        op: "update",
        payload: { active: true },
        match: { id: p.id },
        label: `Activer ${p.label}`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periodes"] }),
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const delPeriode = useMutation({
    mutationFn: async (p: Periode) => {
      await enqueueWrite({
        table: "periodes",
        op: "delete",
        match: { id: p.id },
        label: `Supprimer ${p.label}`,
      });
    },
    onSuccess: () => {
      toast.success("Période supprimée");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const addPreset = useMutation({
    mutationFn: async (preset: "trimestres" | "semestres") => {
      const user_id = await requireUserId();
      const labels = preset === "trimestres"
        ? ["1er trimestre", "2ème trimestre", "3ème trimestre"]
        : ["1er semestre", "2ème semestre"];
      const anneeVal = annee || new Date().getFullYear() + "";
      const rows = labels.map((label, i) => ({
        id: crypto.randomUUID(),
        user_id, label, ordre: i + 1, annee_scolaire: anneeVal, active: i === 0,
      }));
      for (const row of rows) {
        await enqueueWrite({
          table: "periodes",
          op: "insert",
          payload: row,
          label: `Ajouter la période ${row.label}`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Périodes créées");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  return (
    <div className="px-5 pb-24 pt-5">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Compte</div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Paramètres</h1>
      </div>

      {caps && <PlanCard caps={caps} />}
      {caps && !caps.isAdmin && <PlanActivationsHistory />}


      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="card-elevated space-y-5 p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="nom">Nom affiché</Label>
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="init">Initiales</Label>
            <Input id="init" value={initiales} maxLength={2} onChange={(e) => setInitiales(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ech">Échelle</Label>
            <Select value={echelle} onValueChange={setEchelle}>
              <SelectTrigger id="ech"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">/10</SelectItem>
                <SelectItem value="20">/20</SelectItem>
                <SelectItem value="100">/100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="annee">Année scolaire active</Label>
          <Input id="annee" placeholder="2025-2026" value={annee} onChange={(e) => setAnnee(e.target.value)} />
        </div>
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>

      <section className="card-elevated mt-6 space-y-3 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Apparence</h2>
          <p className="text-xs text-muted-foreground">
            Choisissez un thème clair, sombre, ou suivez les préférences de votre appareil.
          </p>
        </div>
        <ThemeToggle />
      </section>

      <section className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Aide & tour guidé</h2>
            <p className="text-xs text-muted-foreground">
              Relancez la visite interactive pour redécouvrir les fonctionnalités clés.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              const { startTour } = await import("@/lib/tour");
              startTour({ persist: true });
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Relancer le tour guidé
          </Button>
        </div>
      </section>


      <section className="mt-6 space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Synchronisation</h2>
          <p className="text-xs text-muted-foreground">
            État de la file hors-ligne, dernière synchronisation et erreurs éventuelles.
          </p>
        </div>
        <SyncStatusCard />
      </section>

      <Link
        to="/parametres/rappels"
        className="card-elevated mt-6 flex items-center justify-between gap-3 p-5 transition-colors hover:bg-cream-deep/50"
      >
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Rappels</h2>
          <p className="text-xs text-muted-foreground">
            Activez chaque type d'alerte et ajustez les seuils.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">→</span>
      </Link>

      <Link
        to="/parametres/notifications"
        className="card-elevated mt-3 flex items-center justify-between gap-3 p-5 transition-colors hover:bg-cream-deep/50"
      >
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Notifications</h2>
          <p className="text-xs text-muted-foreground">
            Choisissez les types de notifications et la fréquence des rappels.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">→</span>
      </Link>





      <section className="card-elevated mt-6 space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Périodes scolaires</h2>
          <p className="text-xs text-muted-foreground">
            Utilisées pour organiser les notes et générer les bulletins.
          </p>
        </div>

        {periodes.length === 0 && (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => addPreset.mutate("trimestres")}>
              Créer 3 trimestres
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addPreset.mutate("semestres")}>
              Créer 2 semestres
            </Button>
          </div>
        )}

        <ul className="space-y-2">
          {periodes.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
              <button
                type="button"
                onClick={() => !p.active && togglePeriode.mutate(p)}
                aria-label="Rendre active"
                className={p.active ? "text-teal" : "text-muted-foreground hover:text-foreground"}
              >
                {p.active ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-[10px] text-muted-foreground">{p.annee_scolaire}</div>
              </div>
              <button
                type="button"
                onClick={() => delPeriode.mutate(p)}
                aria-label="Supprimer"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <Input
            value={newPeriode}
            onChange={(e) => setNewPeriode(e.target.value)}
            placeholder="Nouvelle période"
          />
          <Button type="button" onClick={() => addPeriode.mutate()} disabled={addPeriode.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <DeleteAccountSection />
    </div>
  );
}


const PLAN_BADGE: Record<PlanCapabilities["plan"], string> = {
  gratuit: "bg-muted text-muted-foreground",
  lite: "bg-gold/25 text-foreground",
  premium: "bg-teal text-ink-foreground",
};

function fmtLimit(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (n <= 0) return "Illimité";
  return String(n);
}

const PERIODE_LABEL: Record<"mensuelle" | "trimestrielle" | "annuelle", string> = {
  mensuelle: "Mensuelle (30 j)",
  trimestrielle: "Trimestrielle (90 j)",
  annuelle: "Annuelle (300 j)",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function PlanCard({ caps }: { caps: PlanCapabilities }) {
  const isFree = caps.plan === "gratuit" && !caps.isAdmin;
  const features: { label: string; enabled: boolean; note?: string }[] = [
    { label: "Export PDF des bulletins & rapports de classe", enabled: caps.bulletins_pdf },
    { label: "Rapports détaillés (moyennes, distribution, classements)", enabled: caps.rapports },
    { label: "Suivi de progression dans le temps", enabled: caps.progression },
  ];

  // Notification d'expiration (une fois par session)
  useEffect(() => {
    if (caps.isAdmin) return;
    const key = "plan-expiry-toast";
    if (sessionStorage.getItem(key)) return;
    if (caps.isExpired && caps.storedPlan !== "gratuit") {
      toast.error(`Votre plan ${PLAN_LABEL[caps.storedPlan]} a expiré. Vous êtes revenu au plan Gratuit.`);
      sessionStorage.setItem(key, "1");
    } else if (caps.isExpiringSoon && caps.daysRemaining !== null) {
      toast.warning(
        `Votre plan ${PLAN_LABEL[caps.storedPlan]} expire dans ${caps.daysRemaining} jour${caps.daysRemaining > 1 ? "s" : ""}.`,
      );
      sessionStorage.setItem(key, "1");
    }
  }, [caps.isAdmin, caps.isExpired, caps.isExpiringSoon, caps.daysRemaining, caps.storedPlan]);

  return (
    <section className="card-elevated mb-6 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Votre plan</div>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {PLAN_LABEL[caps.plan]}
            </h2>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PLAN_BADGE[caps.plan]}`}>
              {caps.isAdmin ? "Admin" : PLAN_LABEL[caps.plan]}
            </span>
          </div>
        </div>
        {caps.plan !== "premium" && !caps.isAdmin && <UpgradeDialog currentPlan={caps.plan} />}
      </div>

      {/* Statut d'abonnement */}
      {!caps.isAdmin && caps.storedPlan !== "gratuit" && caps.expiresAt && (
        <div
          className={`mt-4 rounded-lg border p-3 text-xs ${
            caps.isExpired
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : caps.isExpiringSoon
                ? "border-gold/50 bg-gold/10 text-foreground"
                : "border-border bg-background/60 text-foreground/80"
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {caps.isExpired ? (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : caps.isExpiringSoon ? (
              <AlertTriangle className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
            )}
            {caps.isExpired
              ? "Abonnement expiré"
              : caps.isExpiringSoon
                ? `Expire dans ${caps.daysRemaining} jour${(caps.daysRemaining ?? 0) > 1 ? "s" : ""}`
                : `${caps.daysRemaining} jour${(caps.daysRemaining ?? 0) > 1 ? "s" : ""} restants`}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {caps.periode && (
              <>
                <dt className="text-muted-foreground">Période</dt>
                <dd className="text-right font-medium">{PERIODE_LABEL[caps.periode]}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Activé le</dt>
            <dd className="text-right font-medium">{fmtDate(caps.startedAt)}</dd>
            <dt className="text-muted-foreground">Expire le</dt>
            <dd className="text-right font-medium">{fmtDate(caps.expiresAt)}</dd>
          </dl>
          {caps.isExpiringSoon && (
            <div className="mt-2">
              <UpgradeDialog currentPlan={caps.storedPlan} variant="inline" />
            </div>
          )}
        </div>
      )}


      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Écoles</dt>
          <dd className="mt-1 font-serif text-base text-foreground">{fmtLimit(caps.max_ecoles)}</dd>
        </div>

        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Classes/école</dt>
          <dd className="mt-1 font-serif text-base text-foreground">{fmtLimit(caps.max_classes_par_ecole)}</dd>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Élèves</dt>
          <dd className="mt-1 font-serif text-base text-foreground">{fmtLimit(caps.max_eleves)}</dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f.label} className="flex items-start gap-2 text-sm">
            {f.enabled ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            )}
            <span className={f.enabled ? "text-foreground" : "text-muted-foreground line-through"}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {isFree && (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground/80">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            Plan Gratuit — fonctionnalités limitées
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            <li>1 école, 1 classe par école, 25 élèves maximum.</li>
            <li>Pas d'export PDF des bulletins ni des rapports de classe.</li>
            <li>Rapports avancés et suivi de progression indisponibles.</li>
          </ul>
          <div className="mt-3">
            <UpgradeDialog currentPlan={caps.plan} variant="inline" />
          </div>
        </div>
      )}
    </section>
  );
}



type UpgradePlan = "lite" | "premium";
type UpgradePeriode = "mensuelle" | "trimestrielle" | "annuelle";

const UPGRADE_PERIODE_LABEL: Record<UpgradePeriode, string> = {
  mensuelle: "Mensuel",
  trimestrielle: "Trimestriel",
  annuelle: "Annuel",
};

const PERIODE_SUFFIX: Record<UpgradePeriode, string> = {
  mensuelle: "/ mois",
  trimestrielle: "/ trimestre",
  annuelle: "/ an",
};

const PLAN_TIERS: Record<UpgradePlan, { title: string; tagline: string; benefits: string[]; highlight?: boolean }> = {
  lite: {
    title: "Lite",
    tagline: "Pour élargir votre suivi",
    benefits: [
      "Jusqu'à 2 écoles & 2 classes par école",
      "Nombre d'élèves illimité",
      "Export PDF des bulletins & rapports",
      "Rapports détaillés (moyennes, distribution)",
    ],
  },
  premium: {
    title: "Premium",
    tagline: "Tout, sans limite",
    highlight: true,
    benefits: [
      "Écoles, classes et élèves illimités",
      "Export PDF illimité",
      "Rapports & suivi de progression avancé",
      "Support prioritaire",
    ],
  },
};

function formatFcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function UpgradeDialog({ currentPlan, variant = "header" }: { currentPlan: PlanCapabilities["plan"]; variant?: "header" | "inline" }) {
  const { data: profil } = useQuery(profilQueryOptions());
  const ecoleNom = profil?.etablissement?.trim() ?? "";

  const allPlans: UpgradePlan[] = ["lite", "premium"];
  const isPlanDisabled = (p: UpgradePlan) =>
    currentPlan === "premium" || (currentPlan === "lite" && p === "lite");
  const defaultPlan: UpgradePlan =
    currentPlan === "gratuit" ? "lite" : "premium";

  const [selectedPlan, setSelectedPlan] = useState<UpgradePlan>(defaultPlan);

  const [selectedPeriode, setSelectedPeriode] = useState<UpgradePeriode>("mensuelle");

  const { data: prices = [] } = useQuery({
    queryKey: ["plan-prices-public"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_prices")
        .select("plan, periode, montant, devise")
        .in("plan", ["lite", "premium"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const priceOf = (plan: UpgradePlan, periode: UpgradePeriode): number | null => {
    const row = prices.find((p) => p.plan === plan && p.periode === periode);
    return row ? Number(row.montant) : null;
  };

  const tier = PLAN_TIERS[selectedPlan];
  const currentPrice = priceOf(selectedPlan, selectedPeriode);

  const waHref = upgradeWhatsAppHref({
    planLabel: PLAN_LABEL[currentPlan],
    targetPlanLabel: `${PLAN_LABEL[selectedPlan]} (${UPGRADE_PERIODE_LABEL[selectedPeriode].toLowerCase()}${
      currentPrice !== null ? ` — ${formatFcfa(currentPrice)}` : ""
    })`,
    ecole: ecoleNom,
    userName: profil?.nom_affiche ?? undefined,
    telephone: profil?.telephone ?? undefined,
  });

  const trigger =
    variant === "header" ? (
      <Button size="sm" className="bg-teal text-ink-foreground hover:bg-teal/90">
        <ArrowUpRight className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Mettre à niveau
      </Button>
    ) : (
      <Button size="sm" className="bg-teal text-ink-foreground hover:bg-teal/90">
        <ArrowUpRight className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Voir les plans supérieurs
      </Button>
    );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-gold" aria-hidden="true" />
            Passez à la vitesse supérieure
          </DialogTitle>
          <DialogDescription>
            Vous êtes actuellement sur le plan <strong>{PLAN_LABEL[currentPlan]}</strong>. Choisissez un plan supérieur puis la fréquence qui vous convient.
          </DialogDescription>
        </DialogHeader>

        {/* Sélection du plan */}
        <div className="grid gap-3 sm:grid-cols-2">
          {allPlans.map((p) => {
            const t = PLAN_TIERS[p];
            const active = selectedPlan === p;
            const disabled = isPlanDisabled(p);
            const fromPrice = priceOf(p, "mensuelle");
            return (
              <button
                key={p}
                type="button"
                onClick={() => !disabled && setSelectedPlan(p)}
                aria-pressed={active}
                disabled={disabled}
                className={`text-left rounded-lg border p-3 transition ${
                  disabled
                    ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                    : active
                    ? "border-teal ring-2 ring-teal/40 bg-teal/5"
                    : t.highlight
                    ? "border-teal/60 bg-teal/5 hover:border-teal"
                    : "border-border bg-background/60 hover:border-foreground/30"
                }`}
              >

                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {p === "premium" ? (
                      <Crown className="h-4 w-4 text-teal" aria-hidden="true" />
                    ) : (
                      <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
                    )}
                    <h3 className="font-serif text-base text-foreground">{t.title}</h3>
                  </div>
                  {currentPlan === p && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Actuel</span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">{t.tagline}</p>
                {fromPrice !== null && (
                  <p className="mt-1.5 text-xs font-semibold text-foreground">
                    À partir de {formatFcfa(fromPrice)} <span className="font-normal text-muted-foreground">/ mois</span>
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Détails du plan choisi */}
        <div className={`rounded-lg border p-3 ${tier.highlight ? "border-teal/60 bg-teal/5" : "border-border bg-background/60"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {selectedPlan === "premium" ? (
                <Crown className="h-4 w-4 text-teal" aria-hidden="true" />
              ) : (
                <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
              )}
              <h3 className="font-serif text-base text-foreground">Plan {tier.title}</h3>
            </div>
            {currentPrice !== null && (
              <div className="text-right">
                <div className="text-base font-semibold text-foreground">{formatFcfa(currentPrice)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{PERIODE_SUFFIX[selectedPeriode]}</div>
              </div>
            )}
          </div>
          <ul className="mt-2 space-y-1">
            {tier.benefits.map((b) => (
              <li key={b} className="flex items-start gap-1.5 text-xs text-foreground/80">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Choix de la fréquence */}
        <div>
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fréquence d'abonnement</div>
          <div className="grid grid-cols-3 gap-2">
            {(["mensuelle", "trimestrielle", "annuelle"] as UpgradePeriode[]).map((per) => {
              const price = priceOf(selectedPlan, per);
              const active = selectedPeriode === per;
              return (
                <button
                  key={per}
                  type="button"
                  onClick={() => setSelectedPeriode(per)}
                  aria-pressed={active}
                  className={`rounded-lg border p-2 text-center transition ${
                    active
                      ? "border-teal ring-2 ring-teal/40 bg-teal/5"
                      : "border-border bg-background/60 hover:border-foreground/30"
                  }`}
                >
                  <div className="text-xs font-semibold text-foreground">{UPGRADE_PERIODE_LABEL[per]}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {price !== null ? formatFcfa(price) : "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-foreground/80">
          <p className="font-semibold text-foreground">Récapitulatif</p>
          <p className="mt-1">
            Vous souhaitez passer au plan <strong>{tier.title}</strong> en formule{" "}
            <strong>{UPGRADE_PERIODE_LABEL[selectedPeriode].toLowerCase()}</strong>
            {currentPrice !== null ? (
              <> pour <strong>{formatFcfa(currentPrice)}</strong> {PERIODE_SUFFIX[selectedPeriode]}</>
            ) : null}
            . Contactez-nous sur WhatsApp pour activer votre abonnement.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-teal px-3 py-2 text-sm font-medium text-ink-foreground hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Nous contacter sur WhatsApp
          </a>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}


type PlanActivationRow = {
  id: string;
  plan: "gratuit" | "lite" | "premium";
  periode: "mensuelle" | "trimestrielle" | "annuelle" | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  created_at: string;
  activated_by_email: string | null;
};

function PlanActivationsHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ["mes-plan-activations"],
    staleTime: 30_000,
    queryFn: async (): Promise<PlanActivationRow[]> => {
      const uid = await requireUserId();
      const { data, error } = await supabase
        .from("plan_activations")
        .select("id, plan, periode, plan_started_at, plan_expires_at, created_at, activated_by_email")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PlanActivationRow[];
    },
  });

  const rows = data ?? [];

  return (
    <section className="card-elevated mb-6 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-teal" aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Historique des activations</h2>
            <p className="text-xs text-muted-foreground">Toutes les activations de plan effectuées sur votre compte.</p>
          </div>
        </div>
        <Link
          to="/facturation"
          className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-3 py-1.5 text-xs font-medium text-teal hover:bg-teal/15"
        >
          Voir factures & reçus
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>


      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune activation enregistrée pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border bg-background/60 p-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PLAN_BADGE[r.plan]}`}
                  >
                    {PLAN_LABEL[r.plan]}
                  </span>
                  {r.periode && (
                    <span className="text-foreground/80">{PERIODE_LABEL[r.periode]}</span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground" title={r.id}>
                  #{r.id.slice(0, 8)}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Début</dt>
                <dd className="text-right font-medium">{fmtDate(r.plan_started_at ?? r.created_at)}</dd>
                <dt className="text-muted-foreground">Expiration</dt>
                <dd className="text-right font-medium">{fmtDate(r.plan_expires_at)}</dd>
                {r.activated_by_email && (
                  <>
                    <dt className="text-muted-foreground">Activé par</dt>
                    <dd className="truncate text-right font-medium">{r.activated_by_email}</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DeleteAccountSection() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: caps } = useQuery(planCapabilitiesQO());
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [raison, setRaison] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (caps?.isAdmin) return null;

  const submit = async () => {
    const reason = raison.trim();
    if (reason.length < 10) {
      toast.error("Merci d'indiquer une raison (10 caractères minimum).");
      return;
    }
    if (!confirm) {
      toast.error("Veuillez cocher la case de confirmation.");
      return;
    }
    setSubmitting(true);
    try {
      const uid = await requireUserId();
      const { data: userRes } = await supabase.auth.getUser();
      const email = userRes.user?.email ?? null;

      const { error: insErr } = await supabase
        .from("account_deletion_requests")
        .insert({
          user_id: uid,
          user_email: email,
          user_nom: profil?.nom_affiche ?? null,
          raison: reason,
        });
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from("profils_enseignant")
        .update({ statut: "suspendu" })
        .eq("user_id", uid);
      if (updErr) throw updErr;

      toast.success("Compte suspendu. Un administrateur a été notifié.");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (e) {
      toast.error(toFrench(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold text-destructive">Zone sensible</h2>
          <p className="mt-1 text-xs text-foreground/80">
            La suspension désactive l'accès à votre compte. Un administrateur peut le
            réactiver sur demande — vos données ne sont pas supprimées immédiatement.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-3"
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Supprimer mon compte
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  Suppression de compte
                </DialogTitle>
                <DialogDescription>
                  Votre compte sera immédiatement suspendu et vous serez déconnecté.
                  Un administrateur sera notifié et pourra le réactiver en cas
                  d'erreur. Vos données restent conservées pendant la période
                  d'examen.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="del-raison">
                    Pourquoi souhaitez-vous supprimer votre compte ?
                  </Label>
                  <Textarea
                    id="del-raison"
                    value={raison}
                    onChange={(e) => setRaison(e.target.value)}
                    placeholder="Expliquez brièvement la raison (obligatoire, min. 10 caractères)"
                    rows={4}
                    maxLength={1000}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {raison.trim().length}/1000 — ce message sera transmis à l'administrateur.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-xs text-foreground/80">
                  <input
                    type="checkbox"
                    checked={confirm}
                    onChange={(e) => setConfirm(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Je comprends que mon compte sera immédiatement suspendu et
                    que je devrai contacter un administrateur pour le réactiver.
                  </span>
                </label>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={submit}
                  disabled={submitting || raison.trim().length < 10 || !confirm}
                >
                  {submitting ? "Envoi…" : "Confirmer la suppression"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}



