import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PLAN_LABEL,
  normalizeWhatsAppNumber,
  supportConfig,
  upgradeWhatsAppHref,
  type PlanKey,
  type UpgradeContext,
} from "@/config/support";

export function PlanLimitBanner({
  planLabel,
  message,
  onUpgrade,
}: {
  planLabel: string;
  message: string;
  onUpgrade: () => void;
}) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs text-ink">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Limite atteinte — plan {planLabel}</div>
        <p className="mt-0.5 text-ink/80">{message}</p>
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-1 inline-flex items-center gap-1 text-teal underline-offset-2 hover:underline"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Mettre à niveau
        </button>
      </div>
    </div>
  );
}

export function LockedEmptyState({
  icon,
  title,
  hint,
  lockedHint,
  onAdd,
  addLabel,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  lockedHint: string;
  onAdd: () => void;
  addLabel: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <div className="card-elevated flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-ink">
        {locked ? <Lock className="h-6 w-6" /> : icon}
      </span>
      <div>
        <div className="font-display text-lg font-semibold">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{locked ? lockedHint : hint}</p>
      </div>
      <Button onClick={onAdd} className="mt-2" variant={locked ? "outline" : "default"}>
        {locked ? (
          <>
            <Sparkles className="mr-1 h-4 w-4" /> Débloquer avec un plan supérieur
          </>
        ) : (
          addLabel
        )}
      </Button>
    </div>
  );
}

export function LockedFloatingAdd({
  onClick,
  locked,
  icon,
}: {
  onClick: () => void;
  locked?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={locked ? "Limite atteinte — mettre à niveau" : "Ajouter"}
      className={`fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full shadow-[var(--shadow-hero)] transition-transform hover:scale-105 lg:bottom-8 ${
        locked
          ? "bg-muted text-muted-foreground ring-2 ring-gold/50"
          : "bg-teal text-teal-foreground"
      }`}
    >
      {locked ? <Lock className="h-5 w-5" /> : icon}
    </button>
  );
}

const NEXT_PLAN: Record<PlanKey, PlanKey | null> = {
  gratuit: "lite",
  lite: "premium",
  premium: null,
};

const PLAN_HIGHLIGHTS: Record<PlanKey, string[]> = {
  gratuit: [],
  lite: [
    "Plus d'écoles et de classes",
    "Export PDF des bulletins",
    "Rapports détaillés par classe",
  ],
  premium: [
    "Quotas étendus (écoles, classes, élèves)",
    "Toutes les fonctionnalités Lite",
    "Suivi de progression avancé",
  ],
};

export function PlanUpgradeDialog({
  open,
  onOpenChange,
  currentPlan,
  contextName,
  limitDescription,
  ecole,
  classe,
  ressource,
  userName,
  telephone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlan: PlanKey;
  /** Kept for backward compat — used as fallback pour l'école. */
  contextName?: string;
  /** ex : "1 classe par école", "25 élèves" */
  limitDescription: string;
  ecole?: string;
  classe?: string;
  ressource?: string;
  userName?: string;
  telephone?: string;
}) {
  const qc = useQueryClient();
  const nextPlan = NEXT_PLAN[currentPlan];
  const currentLabel = PLAN_LABEL[currentPlan];
  const nextLabel = nextPlan ? PLAN_LABEL[nextPlan] : null;
  const upgradeContext: UpgradeContext = {
    planLabel: currentLabel,
    targetPlanLabel: nextLabel,
    ecole: ecole ?? contextName,
    classe,
    ressource,
    motif: limitDescription ? `Limite atteinte : ${limitDescription}` : undefined,
    userName,
    telephone,
  };
  const waHref = upgradeWhatsAppHref(upgradeContext);
  const highlights = nextPlan ? PLAN_HIGHLIGHTS[nextPlan] : [];

  // Après retour de WhatsApp (retour du focus / onglet redevient visible),
  // on rafraîchit les capacités du plan pour refléter un éventuel upgrade.
  const waClicked = useRef(false);
  useEffect(() => {
    const refresh = () => {
      if (!waClicked.current) return;
      waClicked.current = false;
      qc.invalidateQueries({ queryKey: ["plan-capabilities"] });
      qc.invalidateQueries({ queryKey: ["profil"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gold/20 text-ink">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center font-display">
            {nextLabel ? `Passez au plan ${nextLabel}` : "Limite atteinte"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-ink/80">
          <p className="text-center">
            Le plan <strong>{currentLabel}</strong> autorise{" "}
            <strong>{limitDescription}</strong>. Vous avez atteint cette limite.
          </p>

          {nextPlan && highlights.length > 0 && (
            <div className="rounded-xl border border-teal/30 bg-teal/5 p-3">
              <div className="mb-1.5 font-display text-sm font-semibold text-foreground">
                Avec le plan {nextLabel}
              </div>
              <ul className="space-y-1.5 text-xs">
                {highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Sparkles
                      className="mt-0.5 h-3 w-3 shrink-0 text-teal"
                      aria-hidden="true"
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!nextPlan && (
            <p className="text-center text-xs text-muted-foreground">
              Vous êtes déjà sur notre plan le plus complet. Contactez le support pour
              étendre vos quotas.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              waClicked.current = true;
              onOpenChange(false);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {nextLabel ? `Demander le plan ${nextLabel}` : "Contacter le support"}
          </a>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Plus tard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
