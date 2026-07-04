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
import { profilQueryOptions } from "@/lib/queries/profil";
import { moyennePonderee, noteColorClass } from "@/lib/format";
import { generateBulletinPDF } from "@/lib/pdf/bulletin";
import { generateClasseRapportPDF } from "@/lib/pdf/classe-rapport";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rapports")({
  head: () => ({ meta: [{ title: "Rapports — MonRegistre" }] }),
  component: RapportsPage,
});

function RapportsPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: periodes = [] } = useQuery(periodesQO());

  const [ecoleId, setEcoleId] = useState<string>("");
  const [classeId, setClasseId] = useState<string>("");
  const [periodeId, setPeriodeId] = useState<string>("");

  const { data: classes = [] } = useQuery(classesQO(ecoleId || undefined));
  const { data: eleves = [] } = useQuery(elevesQO(classeId || undefined));
  const { data: notes = [] } = useQuery(
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
    if (!stats.moyennes.length) {
      toast.error("Aucun bulletin à générer.");
      return;
    }
    stats.moyennes.forEach((m, i) => {
      setTimeout(() => handleExport(m.eleve.id), i * 150);
    });
    toast.success(`${stats.moyennes.length} bulletin(s) en cours de génération`);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl font-serif text-ink">Rapports</h1>
        <p className="text-sm text-ink/60">Moyennes, statistiques et bulletins PDF.</p>
      </header>

      {/* Filters */}
      <div className="card-elevated p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>École</Label>
            <Select value={ecoleId} onValueChange={(v) => { setEcoleId(v); setClasseId(""); }}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                {ecoles.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {!classeId ? (
        <div className="card-elevated p-8 text-center text-ink/60">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 text-teal/60" />
          Sélectionne une classe pour afficher les statistiques.
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
            <h2 className="font-serif text-lg text-ink mb-3">Distribution des moyennes</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.buckets}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#1a1a2e" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#1a1a2e" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#f5f0e8",
                      border: "1px solid #1a1a2e",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.buckets.map((b, i) => (
                      <Cell
                        key={i}
                        fill={
                          b.min >= echelle * 0.7
                            ? "#1a7a6e"
                            : b.min >= echelle * 0.5
                              ? "#c9a84c"
                              : "#c94c4c"
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

          {/* Bulletins */}
          <div className="card-elevated p-4">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h2 className="font-serif text-lg text-ink">Bulletins PDF</h2>
              <Button size="sm" onClick={handleExportAll} className="bg-teal text-cream hover:bg-teal/90">
                <FileDown className="h-4 w-4 mr-1.5" />
                Tout exporter
              </Button>
            </div>
            <ul className="divide-y divide-ink/10">
              {stats.sorted.map(({ eleve, moyenne, nbNotes }) => (
                <li key={eleve.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink truncate">{eleve.prenom} {eleve.nom}</p>
                    <p className="text-xs text-ink/60">{nbNotes} note{nbNotes > 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${noteColorClass(moyenne, echelle)}`}>
                      {moyenne.toFixed(2)}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => handleExport(eleve.id)}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
              {!stats.sorted.length && (
                <li className="py-6 text-center text-sm text-ink/60">Aucun élève noté.</li>
              )}
            </ul>
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
    <div className={`card-elevated p-4 ${accent ? "bg-teal text-cream" : ""}`}>
      <div className={`flex items-center gap-2 text-xs ${accent ? "text-cream/80" : "text-ink/60"}`}>
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-2xl font-serif ${accent ? "text-cream" : "text-ink"}`}>{value}</p>
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
      <h3 className="font-serif text-base text-ink mb-2 flex items-center gap-2">{icon}{title}</h3>
      <ul className="space-y-1.5">
        {items.map((m, i) => (
          <li key={m.eleve.id} className="flex items-center justify-between text-sm">
            <span className="text-ink truncate">
              <span className="text-ink/50 mr-1.5">#{i + 1}</span>
              {m.eleve.prenom} {m.eleve.nom}
            </span>
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${noteColorClass(m.moyenne, echelle)}`}>
              {m.moyenne.toFixed(2)}
            </span>
          </li>
        ))}
        {!items.length && <li className="text-sm text-ink/50">—</li>}
      </ul>
    </div>
  );
}
