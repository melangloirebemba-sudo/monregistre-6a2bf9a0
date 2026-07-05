import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Receipt, CalendarClock, Wallet, CreditCard, FileText, RotateCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/queries/data";
import { profilQueryOptions } from "@/lib/queries/profil";
import { Button } from "@/components/ui/button";
import { generateRecuPaiementPDF, formatMontantXAF } from "@/lib/pdf/recu-paiement";

export const Route = createFileRoute("/_authenticated/facturation/$id")({
  head: () => ({ meta: [{ title: "Détails du reçu — MonRegistre" }] }),
  component: RecuDetailsPage,
});

type Paiement = {
  id: string;
  plan: "gratuit" | "lite" | "premium";
  periode: "mensuelle" | "trimestrielle" | "annuelle" | null;
  montant: number;
  devise: string;
  numero_recu: string;
  paye_le: string;
  plan_expires_at: string | null;
  moyen_paiement: string;
  note: string | null;
};

const PLAN_LABEL: Record<Paiement["plan"], string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};
const PLAN_BADGE: Record<Paiement["plan"], string> = {
  gratuit: "bg-muted text-muted-foreground",
  lite: "bg-gold/25 text-ink",
  premium: "bg-teal text-cream",
};
const PERIODE_LABEL: Record<NonNullable<Paiement["periode"]>, string> = {
  mensuelle: "Mensuelle",
  trimestrielle: "Trimestrielle",
  annuelle: "Annuelle",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function RecuDetailsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: profil } = useQuery(profilQueryOptions());

  const { data: paiement, isLoading, error } = useQuery({
    queryKey: ["paiement", id],
    staleTime: 30_000,
    queryFn: async (): Promise<Paiement | null> => {
      const uid = await requireUserId();
      const { data, error } = await supabase
        .from("paiements")
        .select("id, plan, periode, montant, devise, numero_recu, paye_le, plan_expires_at, moyen_paiement, note")
        .eq("user_id", uid)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Paiement | null;
    },
  });

  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!paiement || downloading) return;
    setDownloading(true);
    try {
      await new Promise((res) => setTimeout(res, 30));
      generateRecuPaiementPDF({
        numero_recu: paiement.numero_recu,
        paye_le: paiement.paye_le,
        plan: paiement.plan,
        periode: paiement.periode,
        montant: paiement.montant,
        devise: paiement.devise,
        moyen_paiement: paiement.moyen_paiement,
        plan_expires_at: paiement.plan_expires_at,
        note: paiement.note,
        utilisateur: {
          nom_affiche: profil?.nom_affiche ?? null,
          email: profil?.email ?? null,
        },
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="px-4 pb-6 pt-5 sm:px-5">
      <header className="mb-5">
        <Link
          to="/facturation"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à la facturation
        </Link>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Paiement</div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">
          <Receipt className="h-6 w-6 text-teal" />
          Détails du reçu
        </h1>
      </header>

      {isLoading ? (
        <div className="card-elevated p-6 text-sm text-muted-foreground">Chargement…</div>
      ) : error ? (
        <div className="card-elevated p-6 text-sm text-destructive">Erreur de chargement.</div>
      ) : !paiement ? (
        <div className="card-elevated p-6">
          <p className="text-sm text-muted-foreground">Ce reçu est introuvable ou ne vous appartient pas.</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => navigate({ to: "/facturation" })}>
            Retour à la liste
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card-elevated p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PLAN_BADGE[paiement.plan]}`}
                >
                  Plan {PLAN_LABEL[paiement.plan]}
                </span>
                {paiement.periode && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/80">
                    {PERIODE_LABEL[paiement.periode]}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs text-muted-foreground">{paiement.numero_recu}</span>
            </div>

            <div className="mt-4 rounded-xl bg-teal/10 p-4">
              <div className="text-[11px] uppercase tracking-wide text-teal/80">Montant payé</div>
              <div className="font-display text-3xl font-semibold text-teal">
                {formatMontantXAF(paiement.montant, paiement.devise)}
              </div>
            </div>
          </div>

          <div className="card-elevated p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Informations</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <InfoRow icon={<Wallet className="h-4 w-4 text-teal" />} label="Date de paiement" value={fmtDate(paiement.paye_le)} />
              <InfoRow icon={<CalendarClock className="h-4 w-4 text-teal" />} label="Date de renouvellement" value={fmtDate(paiement.plan_expires_at)} />
              <InfoRow icon={<CreditCard className="h-4 w-4 text-teal" />} label="Moyen de paiement" value={paiement.moyen_paiement || "manuel"} valueClassName="capitalize" />
              <InfoRow icon={<Receipt className="h-4 w-4 text-teal" />} label="N° de reçu" value={paiement.numero_recu} valueClassName="font-mono text-xs" />
            </dl>
            {paiement.note && (
              <div className="mt-4 border-t border-border/60 pt-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> Note
                </div>
                <p className="text-sm italic text-ink/80">{paiement.note}</p>
              </div>
            )}
          </div>

          <div className="sticky bottom-3 z-10">
            <Button
              onClick={handleDownload}
              disabled={downloading}
              size="lg"
              className="w-full gap-2 shadow-lg"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération du PDF…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Télécharger le reçu PDF
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className={`text-sm font-medium text-foreground ${valueClassName ?? ""}`}>{value}</dd>
      </div>
    </div>
  );
}
