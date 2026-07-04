import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Receipt, Download, ArrowLeft, Wallet, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/queries/data";
import { profilQueryOptions } from "@/lib/queries/profil";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPagination } from "@/components/ui/data-pagination";
import { ListSkeleton, NoResults } from "@/components/ui/list-states";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { generateRecuPaiementPDF, formatMontantXAF } from "@/lib/pdf/recu-paiement";

export const Route = createFileRoute("/_authenticated/facturation")({
  head: () => ({ meta: [{ title: "Facturation & paiements — MonRegistre" }] }),
  component: FacturationPage,
});

type PaiementRow = {
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

const PLAN_LABEL: Record<PaiementRow["plan"], string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};
const PLAN_BADGE: Record<PaiementRow["plan"], string> = {
  gratuit: "bg-muted text-muted-foreground",
  lite: "bg-gold/25 text-ink",
  premium: "bg-teal text-cream",
};
const PERIODE_LABEL: Record<NonNullable<PaiementRow["periode"]>, string> = {
  mensuelle: "Mensuelle",
  trimestrielle: "Trimestrielle",
  annuelle: "Annuelle",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function FacturationPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ["mes-paiements"],
    staleTime: 30_000,
    queryFn: async (): Promise<PaiementRow[]> => {
      const uid = await requireUserId();
      const { data, error } = await supabase
        .from("paiements")
        .select("id, plan, periode, montant, devise, numero_recu, paye_le, plan_expires_at, moyen_paiement, note")
        .eq("user_id", uid)
        .order("paye_le", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PaiementRow[];
    },
  });

  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | PaiementRow["plan"]>("all");

  const pq = usePaginatedQuery<PaiementRow>({
    data: paiements,
    search: q,
    searchFields: (r) => [r.numero_recu, r.moyen_paiement, r.note ?? ""],
    filters: [(r) => planFilter === "all" || r.plan === planFilter],
    sort: (a, b) => new Date(b.paye_le).getTime() - new Date(a.paye_le).getTime(),
    sortKey: planFilter,
  });

  const totalPaye = paiements.reduce((s, r) => s + (r.montant || 0), 0);

  function handleDownload(r: PaiementRow) {
    generateRecuPaiementPDF({
      numero_recu: r.numero_recu,
      paye_le: r.paye_le,
      plan: r.plan,
      periode: r.periode,
      montant: r.montant,
      devise: r.devise,
      moyen_paiement: r.moyen_paiement,
      plan_expires_at: r.plan_expires_at,
      note: r.note,
      utilisateur: {
        nom_affiche: profil?.nom_affiche ?? null,
        email: profil?.email ?? null,
      },
    });
  }

  const hasQuery = q.trim().length > 0 || planFilter !== "all";

  return (
    <div className="px-4 pb-6 pt-5 sm:px-5">
      <header className="mb-5">
        <Link
          to="/parametres"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour aux paramètres
        </Link>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Mon compte</div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold text-foreground sm:text-3xl">
          <Receipt className="h-6 w-6 text-teal" />
          Facturation & paiements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tous vos paiements et reçus téléchargeables.
        </p>
      </header>

      {/* Résumé */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="card-elevated flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal/15 text-teal">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total payé</div>
            <div className="font-display text-lg font-semibold text-foreground">
              {formatMontantXAF(totalPaye)}
            </div>
          </div>
        </div>
        <div className="card-elevated flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/20 text-ink">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Prochain renouvellement</div>
            <div className="font-display text-lg font-semibold text-foreground">
              {fmtDate(profil?.plan_expires_at ?? null)}
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Rechercher un reçu (n°, note, moyen…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as typeof planFilter)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Tous les plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            <SelectItem value="lite">Lite</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : pq.isEmpty ? (
        <NoResults
          query={hasQuery ? q : ""}
          onReset={hasQuery ? () => { setQ(""); setPlanFilter("all"); } : undefined}
          message={paiements.length === 0 ? "Aucun paiement pour le moment." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {pq.items.map((r) => (
            <li key={r.id} className="card-elevated p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PLAN_BADGE[r.plan]}`}
                    >
                      {PLAN_LABEL[r.plan]}
                    </span>
                    {r.periode && (
                      <span className="text-xs text-ink/80">{PERIODE_LABEL[r.periode]}</span>
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.numero_recu}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Payé le</dt>
                    <dd className="text-right font-medium">{fmtDate(r.paye_le)}</dd>
                    <dt className="text-muted-foreground">Expire le</dt>
                    <dd className="text-right font-medium">{fmtDate(r.plan_expires_at)}</dd>
                    <dt className="text-muted-foreground">Moyen</dt>
                    <dd className="text-right font-medium capitalize">{r.moyen_paiement}</dd>
                  </dl>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="font-display text-base font-semibold text-teal">
                    {formatMontantXAF(r.montant, r.devise)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(r)}
                    className="gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Reçu PDF
                  </Button>
                </div>
              </div>
              {r.note && (
                <p className="mt-2 border-t border-border/60 pt-2 text-xs italic text-muted-foreground">
                  {r.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <DataPagination
        page={pq.page}
        totalPages={pq.totalPages}
        onPageChange={pq.setPage}
        totalCount={paiements.length}
        filteredCount={pq.filteredCount}
        itemLabel="paiements"
      />
    </div>
  );
}
