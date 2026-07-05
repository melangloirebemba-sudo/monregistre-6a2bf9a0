import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { Loader2, AlertTriangle, ArrowLeft, Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/queries/data";
import { profilQueryOptions } from "@/lib/queries/profil";
import { Button } from "@/components/ui/button";
import type { RecuPaiementContext } from "@/lib/pdf/recu-paiement";
import {
  downloadCachedRecu,
  ensureRecuPDF,
  invalidateRecu,
  useRecuEntry,
} from "@/lib/pdf/recu-cache";

export const Route = createFileRoute("/_authenticated/facturation/$id/pdf")({
  head: () => ({
    meta: [
      { title: "Téléchargement du reçu — MonRegistre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecuPdfPage,
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

function RecuPdfPage() {
  const { id } = Route.useParams();
  const { data: profil } = useQuery(profilQueryOptions());

  const { data: paiement, isLoading, error } = useQuery({
    queryKey: ["paiement", id],
    staleTime: 30_000,
    queryFn: async (): Promise<Paiement | null> => {
      const uid = await requireUserId();
      const { data, error } = await supabase
        .from("paiements")
        .select("id, plan, periode, montant, devise, numero_recu, paye_le, plan_expires_at, moyen_paiement, note, pdf_path")
        .eq("user_id", uid)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Paiement | null;
    },
  });

  const pdfCtx: RecuPaiementContext | null = useMemo(() => {
    if (!paiement) return null;
    return {
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
    };
  }, [paiement, profil?.nom_affiche, profil?.email]);

  const entry = useRecuEntry(id);
  const autoDownloaded = useRef(false);

  // Generate on mount and auto-trigger the browser download once ready.
  useEffect(() => {
    if (!pdfCtx) return;
    ensureRecuPDF(id, pdfCtx).catch(() => {
      /* status flows through the store */
    });
  }, [id, pdfCtx]);

  useEffect(() => {
    if (entry.status === "ready" && !autoDownloaded.current) {
      autoDownloaded.current = true;
      downloadCachedRecu(id);
    }
  }, [entry.status, id]);

  function handleManual() {
    if (entry.status === "ready") {
      downloadCachedRecu(id);
    } else if (pdfCtx) {
      invalidateRecu(id);
      autoDownloaded.current = false;
      ensureRecuPDF(id, pdfCtx).catch(() => {});
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Link
        to="/facturation/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au détail
      </Link>

      <div className="card-elevated space-y-4 p-6 text-center">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-6 w-6 animate-spin text-teal" />
            <p className="text-sm text-muted-foreground">Chargement du reçu…</p>
          </div>
        ) : error || !paiement ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">
              Reçu introuvable ou accès refusé.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/facturation">Retour à la facturation</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-lg font-semibold text-foreground">
              Téléchargement du reçu
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {paiement.numero_recu}
            </p>

            {entry.status === "ready" ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <CheckCircle2 className="h-8 w-8 text-teal" />
                <p className="text-sm text-foreground">
                  Le téléchargement a démarré automatiquement.
                </p>
                <p className="text-xs text-muted-foreground">
                  S'il ne démarre pas, utilisez le bouton ci-dessous.
                </p>
                <Button onClick={handleManual} className="gap-2">
                  <Download className="h-4 w-4" />
                  Télécharger à nouveau
                </Button>
              </div>
            ) : entry.status === "error" ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">{entry.error}</p>
                <Button onClick={handleManual} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Réessayer
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <Loader2 className="h-8 w-8 animate-spin text-teal" />
                <p className="text-sm text-foreground">
                  {entry.status === "generating"
                    ? "Génération du PDF en cours…"
                    : "Préparation du PDF…"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
