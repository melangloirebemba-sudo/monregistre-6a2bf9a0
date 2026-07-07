import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, FileDown, Trophy, TrendingDown, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ecolesQO,
  classesQO,
  elevesQO,
  notesQO,
  periodesQO,
} from "@/lib/queries/data";
import { profilQueryOptions, planCapabilitiesQO } from "@/lib/queries/profil";
import { moyennePonderee, noteColorClass } from "@/lib/format";
import { generateBulletinPDF } from "@/lib/pdf/bulletin";
import { generateClasseRapportPDF } from "@/lib/pdf/classe-rapport";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { ListSkeleton, NoResults } from "@/components/ui/list-states";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { EcoleFilter, EcoleGroupHeader } from "@/components/app/ecole-filter";

export const Route = createFileRoute("/_authenticated/rapports")({
  head: () => ({ meta: [{ title: "Rapports — MonRegistre" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(ecolesQO());
    void context.queryClient.prefetchQuery(classesQO());
    void context.queryClient.prefetchQuery(periodesQO());
    void context.queryClient.prefetchQuery(planCapabilitiesQO());
  },
  component: RapportsPage,
});

function RapportsPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: caps } = useQuery(planCapabilitiesQO());
  const canPdf = caps?.bulletins_pdf ?? false;
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: periodes = [] } = useQuery(periodesQO());


  const [ecoleId, setEcoleId] = useState<string>("");
  const [classeId, setClasseId] = useState<string>("");
  const [periodeId, setPeriodeId] = useState<string>("");

  const { data: classes = [] } = useQuery(classesQO(ecoleId || undefined));
  const { data: eleves = [] } = useQuery(elevesQO(classeId || undefined));
  const { data: notes = [], isLoading: notesLoading } = useQuery(
    notesQO({ classeId: classeId || undefined, periodeId: periodeId || undefined }),
  );

  const echelle = profil?.echelle_notation ?? 20;
  const ecole = ecoles.find((e) => e.id === ecoleId);
  const classe = classes.find((c) => c.id === classeId);
  const periode = periodes.find((p) => p.id === periodeId);

  const stats = useMemo(() => {
    const byEleve = new Map<string, { valeur: number; coefficient: number }[]>();
    for (const n of notes) {
      const arr = byEleve.get(n.eleve_id) ?? [];
      arr.push({ valeur: n.valeur, coefficient: n.coefficient });
      byEleve.set(n.eleve_id, arr);
    }
    const moyennes = eleves
      .map((el) => ({
        eleve: el,
        moyenne: moyennePonderee(byEleve.get(el.id) ?? []),
        nbNotes: (byEleve.get(el.id) ?? []).length,
      }))
      .filter((x) => x.moyenne !== null) as { eleve: typeof eleves[number]; moyenne: number; nbNotes: number }[];

    const moyClasse =
      moyennes.length > 0
        ? moyennes.reduce((a, m) => a + m.moyenne, 0) / moyennes.length
        : null;

    const sorted = [...moyennes].sort((a, b) => b.moyenne - a.moyenne);
    const top3 = sorted.slice(0, 3);
    const bottom3 = sorted.slice(-3).reverse();

    // Distribution histogram (buckets of 2 on scale 20)
    const step = echelle / 10;
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${(i * step).toFixed(0)}-${((i + 1) * step).toFixed(0)}`,
      count: 0,
      min: i * step,
    }));
    for (const m of moyennes) {
      let idx = Math.floor(m.moyenne / step);
      if (idx >= 10) idx = 9;
      buckets[idx].count += 1;
    }

    return { moyennes, moyClasse, top3, bottom3, buckets, sorted };
  }, [notes, eleves, echelle]);

  function handleExport(eleveId: string) {
    if (!canPdf) {
      toast.error("Export PDF réservé aux plans Lite et Premium.");
      return;
    }
    const el = eleves.find((e) => e.id === eleveId);
    if (!el) return;
    const eleveNotes = notes.filter((n) => n.eleve_id === eleveId);
    if (!eleveNotes.length) {
      toast.error("Aucune note pour cet élève sur la période.");
      return;
    }
    generateBulletinPDF({
      ecole,
      classe,
      periode,
      eleve: el,
      notes: eleveNotes,
      enseignant: profil?.nom_affiche ?? undefined,
      echelle,
      moyenneClasse: stats.moyClasse,
    });
  }

  function handleExportAll() {
    if (!canPdf) {
      toast.error("Export PDF réservé aux plans Lite et Premium.");
      return;
    }
    if (!eleves.length) {
      toast.error("Aucun élève à exporter.");
      return;
    }
    generateClasseRapportPDF({
      ecole,
      classe,
      periode,
      eleves,
      notes,
      enseignant: profil?.nom_affiche ?? undefined,
      telephone: profil?.telephone ?? undefined,
      anneeScolaire: profil?.annee_active ?? undefined,
      echelle,
    });

    toast.success("Rapport de classe généré");

  }


  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Rapports</h1>
        <p className="text-sm text-foreground/60">Moyennes, statistiques et bulletins PDF.</p>
        {ecole && (
          <div className="mt-2">
            <EcoleGroupHeader name={ecole.nom} count={classes.length} />
          </div>
        )}
      </header>

      {/* Filters */}
      <div className="card-elevated p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>École</Label>
            <EcoleFilter
              value={ecoleId}
              ecoles={ecoles}
              emptyLabel={null}
              placeholder="Toutes"
              onValueChange={(v) => { setEcoleId(v); setClasseId(""); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Classe</Label>
            <Select value={classeId} onValueChange={setClasseId} disabled={!classes.length}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Période</Label>
            <Select value={periodeId} onValueChange={setPeriodeId}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                {periodes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!ecoleId ? (
        <div className="card-elevated p-8 text-center text-foreground/60">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-teal/60" />
          Sélectionne d'abord une école pour afficher les statistiques.
        </div>
      ) : !classeId ? (
        <div className="card-elevated p-8 text-center text-foreground/60">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-teal/60" />
          Sélectionne une classe de <strong>{ecole?.nom ?? "l'école"}</strong> pour afficher les statistiques.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              icon={<Users className="h-5 w-5" />}
              label="Élèves notés"
              value={`${stats.moyennes.length} / ${eleves.length}`}
            />
            <KpiCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Moyenne classe"
              value={stats.moyClasse !== null ? `${stats.moyClasse.toFixed(2)} / ${echelle}` : "—"}
              accent
            />
            <KpiCard
              icon={<FileDown className="h-5 w-5" />}
              label="Notes saisies"
              value={String(notes.length)}
            />
          </div>

          {/* Distribution */}
          <div className="card-elevated p-4">
            <h2 className="font-serif text-lg text-foreground mb-1">Distribution des moyennes</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Répartition des élèves par tranche de moyenne — teinte selon le niveau.
            </p>
            {/* Légende palette or/sarcelle — cohérente clair / sombre */}
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-teal" />
                Bien ({(echelle * 0.7).toFixed(0)}+/{echelle})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-gold" />
                Moyen ({(echelle * 0.5).toFixed(0)}–{(echelle * 0.7).toFixed(0)})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive" />
                À accompagner (&lt; {(echelle * 0.5).toFixed(0)})
              </span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.buckets}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    stroke="var(--border)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    contentStyle={{
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      boxShadow: "var(--shadow-card)",
                    }}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.buckets.map((b, i) => (
                      <Cell
                        key={i}
                        fill={
                          b.min >= echelle * 0.7
                            ? "var(--teal)"
                            : b.min >= echelle * 0.5
                              ? "var(--gold)"
                              : "var(--destructive)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>


          {/* Top / Bottom */}
          <div className="grid gap-3 sm:grid-cols-2">
            <RankList
              title="Top 3"
              icon={<Trophy className="h-4 w-4 text-gold" />}
              items={stats.top3}
              echelle={echelle}
            />
            <RankList
              title="À accompagner"
              icon={<TrendingDown className="h-4 w-4 text-destructive" />}
              items={stats.bottom3}
              echelle={echelle}
            />
          </div>

          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h2 className="font-serif text-lg text-foreground">Bulletins PDF</h2>
              <Button
                size="sm"
                onClick={handleExportAll}
                disabled={!canPdf}
                aria-disabled={!canPdf}
                title={!canPdf ? "Export PDF réservé aux plans Lite et Premium" : undefined}
                className="bg-teal text-ink-foreground hover:bg-teal/90 disabled:opacity-60"
              >
                <FileDown className="h-4 w-4 mr-1.5" />
                Tout exporter
              </Button>
            </div>
            {!canPdf && (
              <p className="mb-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-foreground/80">
                L'export PDF des bulletins est disponible à partir du plan <strong>Lite</strong>. Votre plan actuel est <strong>{caps?.plan ?? "gratuit"}</strong>.
              </p>
            )}
            <BulletinsList
              sorted={stats.sorted}
              echelle={echelle}
              canPdf={canPdf}
              isLoading={notesLoading}
              onExport={handleExport}
            />
          </div>


        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card-elevated p-4 ${accent ? "bg-teal text-ink-foreground" : ""}`}>
      <div className={`flex items-center gap-2 text-xs ${accent ? "text-ink-foreground/80" : "text-foreground/60"}`}>
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-2xl font-serif ${accent ? "text-ink-foreground" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function RankList({
  title,
  icon,
  items,
  echelle,
}: {
  title: string;
  icon: React.ReactNode;
  items: { eleve: { nom: string; prenom: string; id: string }; moyenne: number }[];
  echelle: number;
}) {
  return (
    <div className="card-elevated p-4">
      <h3 className="font-serif text-base text-foreground mb-2 flex items-center gap-2">{icon}{title}</h3>
      <ul className="space-y-1.5">
        {items.map((m, i) => (
          <li key={m.eleve.id} className="flex items-center justify-between text-sm">
            <span className="text-foreground truncate">
              <span className="text-foreground/50 mr-1.5">#{i + 1}</span>
              {m.eleve.prenom} {m.eleve.nom}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${noteColorClass(m.moyenne, echelle)}`}>
              {m.moyenne.toFixed(2)}
            </span>
          </li>
        ))}
        {!items.length && <li className="text-sm text-foreground/50">—</li>}
      </ul>
    </div>
  );
}

type BulletinEntry = {
  eleve: { id: string; nom: string; prenom: string };
  moyenne: number;
  nbNotes: number;
};

function BulletinsList({
  sorted,
  echelle,
  canPdf,
  isLoading,
  onExport,
}: {
  sorted: BulletinEntry[];
  echelle: number;
  canPdf: boolean;
  isLoading: boolean;
  onExport: (id: string) => void;
}) {
  const pq = usePaginatedQuery({ data: sorted, sortKey: sorted.length });
  const paged = pq.items;

  if (isLoading) {
    return <ListSkeleton rows={4} className="mt-1" />;
  }
  if (pq.isEmpty) {
    return (
      <NoResults
        title="Aucun élève noté"
        description="Aucun élève n'a de note calculable pour cette sélection."
      />
    );
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-ink/10">
        {paged.map(({ eleve, moyenne, nbNotes }) => (
          <li key={eleve.id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{eleve.prenom} {eleve.nom}</p>
              <p className="text-xs text-foreground/60">{nbNotes} note{nbNotes > 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${noteColorClass(moyenne, echelle)}`}>
                {moyenne.toFixed(2)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onExport(eleve.id)}
                disabled={!canPdf}
                aria-disabled={!canPdf}
                title={!canPdf ? "Export PDF réservé aux plans Lite et Premium" : `Exporter le bulletin de ${eleve.prenom} ${eleve.nom}`}
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <DataPagination
        page={pq.page}
        totalPages={pq.totalPages}
        pageSize={pq.pageSize}
        totalCount={pq.totalCount}
        start={pq.start}
        end={pq.end}
        onPageChange={pq.setPage}
        onPageSizeChange={pq.setPageSize}
        itemLabel="bulletins"
      />
    </div>
  );
}
