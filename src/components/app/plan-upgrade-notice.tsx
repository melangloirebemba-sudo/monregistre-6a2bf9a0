import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { planCapabilitiesQO } from "@/lib/queries/profil";

const PLAN_LABEL: Record<string, string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};

const PERIODE_LABEL: Record<string, string> = {
  mensuelle: "mensuelle",
  trimestrielle: "trimestrielle",
  annuelle: "annuelle",
};

const PLAN_RANK: Record<string, number> = { gratuit: 0, lite: 1, premium: 2 };

/**
 * Notifie l'utilisateur, à l'ouverture de l'application, lorsqu'un plan
 * supérieur vient d'être activé pour son compte (par un admin).
 * On se base sur `plan_started_at` mémorisé côté client pour ne notifier
 * qu'une seule fois par activation.
 */
export function PlanUpgradeNotice() {
  const { data: caps } = useQuery(planCapabilitiesQO());

  useEffect(() => {
    if (!caps) return;
    if (caps.isAdmin) return;
    if (caps.isExpired) return;
    if (caps.storedPlan === "gratuit") return;
    if (!caps.startedAt) return;

    const key = "plan-upgrade-seen";
    let seen: { plan?: string; startedAt?: string } = {};
    try {
      seen = JSON.parse(sessionStorage.getItem(key) || "{}");
    } catch {
      seen = {};
    }

    const sameActivation =
      seen.plan === caps.storedPlan && seen.startedAt === caps.startedAt;
    if (sameActivation) return;

    const previousRank = seen.plan ? PLAN_RANK[seen.plan] ?? 0 : 0;
    const currentRank = PLAN_RANK[caps.storedPlan] ?? 0;
    const isUpgrade = !seen.startedAt || currentRank > previousRank;

    const planLabel = PLAN_LABEL[caps.storedPlan] ?? caps.storedPlan;
    const periodeLabel = caps.periode ? PERIODE_LABEL[caps.periode] : null;

    toast.success(
      isUpgrade
        ? `Votre plan a été mis à niveau vers ${planLabel} 🎉`
        : `Votre plan ${planLabel} a été activé`,
      {
        description: periodeLabel
          ? `Période ${periodeLabel}${
              caps.expiresAt
                ? ` — valide jusqu'au ${new Date(caps.expiresAt).toLocaleDateString("fr-FR")}`
                : ""
            }`
          : undefined,
        icon: <Sparkles className="h-4 w-4" />,
        duration: 8000,
      },
    );

    sessionStorage.setItem(
      key,
      JSON.stringify({ plan: caps.storedPlan, startedAt: caps.startedAt }),
    );
  }, [caps]);

  return null;
}
