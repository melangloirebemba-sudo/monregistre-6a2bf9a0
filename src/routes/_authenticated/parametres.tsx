import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2, Check, X, Sparkles, ArrowUpRight, Crown, Zap, Mail, Clock, AlertTriangle, History } from "lucide-react";
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
    onError: (e: Error) => toast.error(e.message),
  });

  const [newPeriode, setNewPeriode] = useState("");
  const addPeriode = useMutation({
    mutationFn: async () => {
      const label = newPeriode.trim();
      if (!label) throw new Error("Nom obligatoire");
      const user_id = await requireUserId();
      const ordre = periodes.length + 1;
      const { error } = await supabase.from("periodes").insert({
        user_id,
        label,
        ordre,
        annee_scolaire: annee || new Date().getFullYear() + "",
        active: periodes.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPeriode("");
      toast.success("Période ajoutée");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePeriode = useMutation({
    mutationFn: async (p: Periode) => {
      const uid = await requireUserId();
      const { error: e1 } = await supabase.from("periodes").update({ active: false }).eq("user_id", uid);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("periodes").update({ active: true }).eq("id", p.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periodes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delPeriode = useMutation({
    mutationFn: async (p: Periode) => {
      const { error } = await supabase.from("periodes").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Période supprimée");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPreset = useMutation({
    mutationFn: async (preset: "trimestres" | "semestres") => {
      const user_id = await requireUserId();
      const labels = preset === "trimestres"
        ? ["1er trimestre", "2ème trimestre", "3ème trimestre"]
        : ["1er semestre", "2ème semestre"];
      const anneeVal = annee || new Date().getFullYear() + "";
      const rows = labels.map((label, i) => ({
        user_id, label, ordre: i + 1, annee_scolaire: anneeVal, active: i === 0,
      }));
      const { error } = await supabase.from("periodes").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Périodes créées");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
    </div>
  );
}


const PLAN_BADGE: Record<PlanCapabilities["plan"], string> = {
  gratuit: "bg-muted text-muted-foreground",
  lite: "bg-gold/25 text-ink",
  premium: "bg-teal text-cream",
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
                ? "border-gold/50 bg-gold/10 text-ink"
                : "border-border bg-background/60 text-ink/80"
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
          <dd className="mt-1 font-serif text-base text-ink">{fmtLimit(caps.max_ecoles)}</dd>
        </div>

        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Classes/école</dt>
          <dd className="mt-1 font-serif text-base text-ink">{fmtLimit(caps.max_classes_par_ecole)}</dd>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Élèves</dt>
          <dd className="mt-1 font-serif text-base text-ink">{fmtLimit(caps.max_eleves)}</dd>
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
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-ink/80">
          <div className="flex items-center gap-1.5 font-semibold text-ink">
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



function UpgradeDialog({ currentPlan, variant = "header" }: { currentPlan: PlanCapabilities["plan"]; variant?: "header" | "inline" }) {
  const { data: profil } = useQuery(profilQueryOptions());
  const ecoleNom = profil?.etablissement?.trim() ?? "";
  const waHref = upgradeWhatsAppHref(ecoleNom, PLAN_LABEL[currentPlan]);

  const trigger =
    variant === "header" ? (
      <Button size="sm" className="bg-teal text-cream hover:bg-teal/90">
        <ArrowUpRight className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Mettre à niveau
      </Button>
    ) : (
      <Button size="sm" className="bg-teal text-cream hover:bg-teal/90">
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
            Vous êtes actuellement sur le plan <strong>{PLAN_LABEL[currentPlan]}</strong>. Débloquez plus de capacité et toutes les fonctionnalités avancées.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <UpgradeTier
            icon={<Zap className="h-4 w-4 text-gold" aria-hidden="true" />}
            title="Lite"
            tagline="Pour élargir votre suivi"
            benefits={[
              "Jusqu'à 2 écoles & 2 classes par école",
              "Nombre d'élèves illimité",
              "Export PDF des bulletins & rapports",
              "Rapports détaillés (moyennes, distribution)",
            ]}
          />
          <UpgradeTier
            icon={<Crown className="h-4 w-4 text-teal" aria-hidden="true" />}
            title="Premium"
            highlight
            tagline="Tout, sans limite"
            benefits={[
              "Écoles, classes et élèves illimités",
              "Export PDF illimité",
              "Rapports & suivi de progression avancé",
              "Support prioritaire",
            ]}
          />
        </div>

        <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-ink/80">
          <p className="font-semibold text-ink">Comment mettre à niveau ?</p>
          <p className="mt-1">
            Contactez-nous pour activer votre nouveau plan. Nous vous accompagnons pour choisir la formule adaptée à votre établissement.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-teal px-3 py-2 text-sm font-medium text-cream hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Nous contacter sur WhatsApp
          </a>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

function UpgradeTier({
  icon,
  title,
  tagline,
  benefits,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  benefits: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-teal/60 bg-teal/5" : "border-border bg-background/60"}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <h3 className="font-serif text-base text-ink">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">{tagline}</p>
      <ul className="mt-2 space-y-1">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-xs text-ink/80">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
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
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-teal" aria-hidden="true" />
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Historique des activations</h2>
          <p className="text-xs text-muted-foreground">Toutes les activations de plan effectuées sur votre compte.</p>
        </div>
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
                    <span className="text-ink/80">{PERIODE_LABEL[r.periode]}</span>
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


