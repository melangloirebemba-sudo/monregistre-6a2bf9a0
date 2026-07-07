import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Receipt, Wallet, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPagination } from "@/components/ui/data-pagination";
import { ListSkeleton, NoResults } from "@/components/ui/list-states";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { formatMontantXAF } from "@/lib/pdf/recu-paiement-shared";

export const Route = createFileRoute("/_authenticated/admin/facturation")({
  head: () => ({
    meta: [
      { title: "Facturation & paiements — Console admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFacturationPage,
});

type PaiementRow = {
  id: string;
  user_id: string;
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

type ProfilRow = {
  user_id: string;
  nom_affiche: string | null;
  email: string | null;
};

type Enriched = PaiementRow & {
  user_nom: string;
  user_email: string;
};

const PLAN_LABEL: Record<PaiementRow["plan"], string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};
const PLAN_BADGE: Record<PaiementRow["plan"], string> = {
  gratuit: "bg-muted text-muted-foreground",
  lite: "bg-gold/25 text-foreground",
  premium: "bg-teal text-ink-foreground",
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

function AdminFacturationPage() {
  const { data: paiements = [], isLoading: loadingP } = useQuery({
    queryKey: ["admin", "paiements"],
    staleTime: 30_000,
    queryFn: async (): Promise<PaiementRow[]> => {
      const { data, error } = await supabase
        .from("paiements")
        .select("id, user_id, plan, periode, montant, devise, numero_recu, paye_le, plan_expires_at, moyen_paiement, note")
        .order("paye_le", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as PaiementRow[];
    },
  });

  const { data: profils = [], isLoading: loadingU } = useQuery({
    queryKey: ["admin", "profils-min"],
    staleTime: 60_000,
    queryFn: async (): Promise<ProfilRow[]> => {
      const { data, error } = await supabase
        .from("profils_enseignant")
        .select("user_id, nom_affiche, email")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ProfilRow[];
    },
  });

  const isLoading = loadingP || loadingU;

  const rows: Enriched[] = useMemo(() => {
    const map = new Map<string, ProfilRow>();
    for (const p of profils) map.set(p.user_id, p);
    return paiements.map((r) => {
      const p = map.get(r.user_id);
      return {
        ...r,
        user_nom: p?.nom_affiche ?? "—",
        user_email: p?.email ?? "—",
      };
    });
  }, [paiements, profils]);

  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | PaiementRow["plan"]>("all");
  const [moyenFilter, setMoyenFilter] = useState<string>("all");

  const moyens = useMemo(() => {
    const s = new Set<string>();
    for (const r of paiements) if (r.moyen_paiement) s.add(r.moyen_paiement);
    return Array.from(s).sort();
  }, [paiements]);

  const pq = usePaginatedQuery<Enriched>({
    data: rows,
    search: q,
    searchFields: (r) => [r.numero_recu, r.user_nom, r.user_email, r.moyen_paiement, r.note ?? ""],
    filters: [
      (r) => planFilter === "all" || r.plan === planFilter,
      (r) => moyenFilter === "all" || r.moyen_paiement === moyenFilter,
    ],
    sort: (a, b) => new Date(b.paye_le).getTime() - new Date(a.paye_le).getTime(),
    sortKey: `${planFilter}|${moyenFilter}`,
  });

  const totalMontant = pq.filtered.reduce((s, r) => s + (r.montant || 0), 0);
  const totalPayeurs = new Set(pq.filtered.map((r) => r.user_id)).size;

  const hasQuery = q.trim().length > 0 || planFilter !== "all" || moyenFilter !== "all";

  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:px-5 sm:py-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Backoffice
        </div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
          <Receipt className="h-6 w-6 shrink-0 text-teal sm:h-7 sm:w-7" />
          <span className="truncate">Facturation & paiements</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tous les paiements enregistrés sur la plateforme — vérification et suivi.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi icon={Receipt} label="Paiements" value={String(pq.filteredCount)} />
        <Kpi icon={Wallet} label="Total encaissé" value={formatMontantXAF(totalMontant)} tone="teal" />
        <Kpi icon={Users} label="Payeurs uniques" value={String(totalPayeurs)} tone="gold" />
      </section>

      {/* Filtres */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (n°, nom, email, moyen…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as typeof planFilter)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tous les plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            <SelectItem value="lite">Lite</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="gratuit">Gratuit</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moyenFilter} onValueChange={setMoyenFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tous les moyens" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les moyens</SelectItem>
            {moyens.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : pq.isEmpty ? (
        <NoResults
          query={hasQuery ? q : ""}
          onReset={hasQuery ? () => { setQ(""); setPlanFilter("all"); setMoyenFilter("all"); } : undefined}
          description={rows.length === 0 ? "Aucun paiement enregistré." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {pq.items.map((r) => (
            <li key={r.id} className="card-elevated p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PLAN_BADGE[r.plan]}`}>
                      {PLAN_LABEL[r.plan]}
                    </span>
                    {r.periode && (
                      <span className="text-xs text-foreground/80">{PERIODE_LABEL[r.periode]}</span>
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {r.numero_recu}
                    </span>
                  </div>
                  <div className="mt-1.5 truncate text-sm font-semibold text-foreground">
                    {r.user_nom}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.user_email}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:max-w-md">
                    <dt className="text-muted-foreground">Payé le</dt>
                    <dd className="text-right font-medium">{fmtDate(r.paye_le)}</dd>
                    <dt className="text-muted-foreground">Expire le</dt>
                    <dd className="text-right font-medium">{fmtDate(r.plan_expires_at)}</dd>
                    <dt className="text-muted-foreground">Moyen</dt>
                    <dd className="text-right font-medium capitalize">{r.moyen_paiement}</dd>
                  </dl>
                  {r.note && (
                    <p className="mt-2 border-t border-border/60 pt-2 text-xs italic text-muted-foreground">
                      {r.note}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-semibold text-teal">
                    {formatMontantXAF(r.montant, r.devise)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DataPagination
        page={pq.page}
        totalPages={pq.totalPages}
        onPageChange={pq.setPage}
        pageSize={pq.pageSize}
        onPageSizeChange={pq.setPageSize}
        start={pq.start}
        end={pq.end}
        totalCount={rows.length}
        filteredCount={pq.filteredCount}
        itemLabel="paiements"
      />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
  tone?: "teal" | "gold";
}) {
  const iconCls =
    tone === "teal"
      ? "bg-teal/15 text-teal"
      : tone === "gold"
        ? "bg-gold/20 text-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <div className="card-elevated p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 truncate font-display text-lg font-semibold sm:text-xl">{value}</div>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconCls}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

