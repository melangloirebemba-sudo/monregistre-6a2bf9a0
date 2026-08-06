import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload, Pencil, Trash2, History, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toFrench } from "@/lib/errors";
import {
  analyzeCatalogueImport,
  buildCatalogueExport,
  catalogueHistoryQO,
  catalogueQO,
  parseCatalogueImport,
  useApplyCatalogueImport,
  useDeleteCatalogueEntry,
  useUpdateCatalogueEntry,
  type CatalogueEntry,
  type CatalogueType,
  type ImportAnalysis,
  type ImportStrategy,
} from "@/lib/queries/catalogue";

export const Route = createFileRoute("/_authenticated/catalogues")({
  head: () => ({
    meta: [
      { title: "Mes catalogues — MonRegistre" },
      {
        name: "description",
        content:
          "Gérez vos cycles, classes et matières personnalisés : modification, suppression, import et export.",
      },
      { property: "og:title", content: "Mes catalogues — MonRegistre" },
      {
        property: "og:description",
        content: "Modifiez, supprimez, importez et exportez vos cycles, classes et matières.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CataloguesPage,
});

const SECTIONS: Array<{ type: CatalogueType; label: string }> = [
  { type: "cycle", label: "Cycles" },
  { type: "classe", label: "Classes" },
  { type: "matiere", label: "Matières" },
];

function CataloguesPage() {
  const { data: entries = [], isLoading } = useQuery(catalogueQO());
  const { data: history = [] } = useQuery(catalogueHistoryQO());
  const update = useUpdateCatalogueEntry();
  const remove = useDeleteCatalogueEntry();
  const applyImport = useApplyCatalogueImport();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<CatalogueEntry | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>("fusionner");

  const grouped = useMemo(() => {
    const map: Record<CatalogueType, CatalogueEntry[]> = {
      cycle: [],
      classe: [],
      matiere: [],
    };
    for (const e of entries) map[e.type]?.push(e);
    return map;
  }, [entries]);

  const exportCatalogues = () => {
    if (entries.length === 0) {
      toast.error("Aucune valeur personnalisée à exporter.");
      return;
    }
    const blob = new Blob([JSON.stringify(buildCatalogueExport(entries), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalogues-monregistre-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Catalogues exportés");
  };

  const importCatalogues = async (file: File) => {
    try {
      const items = parseCatalogueImport(await file.text());
      if (items.length === 0) {
        toast.error("Aucune valeur exploitable dans ce fichier.");
        return;
      }
      const result = analyzeCatalogueImport(items, entries);
      if (result.total === 0) {
        toast.error("Aucune valeur exploitable dans ce fichier.");
        return;
      }
      setStrategy(result.conflits.length > 0 ? "fusionner" : "fusionner");
      setAnalysis(result);
    } catch (e) {
      toast.error(toFrench(e as Error));
    }
  };

  const confirmImport = () => {
    if (!analysis) return;
    applyImport.mutate(
      { analysis, strategy },
      {
        onSuccess: (r) => {
          toast.success(
            `${r.ajoutes} ajout(s), ${r.remplaces} remplacement(s), ${r.ignores} ignoré(s)`,
          );
          setAnalysis(null);
        },
        onError: (err) => toast.error(toFrench(err as Error)),
      },
    );
  };


  return (
    <div className="px-5 pb-10 pt-5">
      <div className="mb-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Personnalisation
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
          Mes catalogues
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cycles, classes et matières que vous avez créés. Modifiez-les, supprimez-les ou
          transférez-les vers un autre appareil.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportCatalogues}>
          <Download className="mr-2 h-4 w-4" /> Exporter
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Importer
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
          <History className="mr-2 h-4 w-4" />
          {showHistory ? "Masquer l'historique" : "Historique"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importCatalogues(f);
            e.target.value = "";
          }}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-5">
          {SECTIONS.map(({ type, label }) => {
            const list = grouped[type];
            return (
              <section key={type} className="card-elevated p-4">
                <h2 className="font-display text-sm font-semibold text-foreground">
                  {label}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({list.length})
                  </span>
                </h2>
                {list.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Aucune valeur personnalisée. Elles apparaîtront ici dès que vous en
                    créerez depuis un formulaire.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {list.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2"
                      >
                        {editing === e.id ? (
                          <>
                            <Input
                              value={draft}
                              autoFocus
                              onChange={(ev) => setDraft(ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") {
                                  update.mutate(
                                    { id: e.id, valeur: draft },
                                    {
                                      onSuccess: () => {
                                        toast.success("Valeur modifiée");
                                        setEditing(null);
                                      },
                                      onError: (err) => toast.error(toFrench(err as Error)),
                                    },
                                  );
                                }
                                if (ev.key === "Escape") setEditing(null);
                              }}
                              className="h-9"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              onClick={() =>
                                update.mutate(
                                  { id: e.id, valeur: draft },
                                  {
                                    onSuccess: () => {
                                      toast.success("Valeur modifiée");
                                      setEditing(null);
                                    },
                                    onError: (err) => toast.error(toFrench(err as Error)),
                                  },
                                )
                              }
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              onClick={() => setEditing(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 truncate text-sm text-foreground">
                              {e.valeur}
                              {e.cycle ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  · {e.cycle}
                                </span>
                              ) : null}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              aria-label={`Modifier ${e.valeur}`}
                              onClick={() => {
                                setEditing(e.id);
                                setDraft(e.valeur);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-destructive"
                              aria-label={`Supprimer ${e.valeur}`}
                              onClick={() => setToDelete(e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {showHistory && (
            <section className="card-elevated p-4">
              <h2 className="font-display text-sm font-semibold text-foreground">
                Historique des modifications
              </h2>
              {history.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Aucun événement.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {h.action === "ajout"
                          ? "Ajout"
                          : h.action === "modification"
                            ? "Modification"
                            : "Suppression"}
                      </span>{" "}
                      · {h.type} ·{" "}
                      {h.action === "modification"
                        ? `${h.ancienne_valeur} → ${h.nouvelle_valeur}`
                        : (h.nouvelle_valeur ?? h.ancienne_valeur)}{" "}
                      · {new Date(h.created_at).toLocaleString("fr-FR")}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette valeur ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {toDelete?.valeur} » ne sera plus proposée dans les formulaires. Les classes
              déjà enregistrées ne sont pas modifiées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toDelete) return;
                remove.mutate(toDelete.id, {
                  onSuccess: () => toast.success("Valeur supprimée"),
                  onError: (err) => toast.error(toFrench(err as Error)),
                });
                setToDelete(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!analysis} onOpenChange={(o) => !o && setAnalysis(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importer des catalogues</DialogTitle>
            <DialogDescription>
              {analysis?.total} valeur(s) lues · {analysis?.nouveaux.length} nouvelle(s) ·{" "}
              {analysis?.conflits.length} déjà présente(s).
            </DialogDescription>
          </DialogHeader>

          {analysis && analysis.conflits.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Que faire des valeurs en conflit ?
              </Label>
              <div className="space-y-2">
                {(
                  [
                    {
                      v: "fusionner" as const,
                      t: "Fusionner",
                      d: "Ajoute les nouvelles valeurs et conserve celles déjà enregistrées.",
                    },
                    {
                      v: "remplacer" as const,
                      t: "Remplacer",
                      d: "Écrase l'orthographe des valeurs existantes par celle du fichier.",
                    },
                    {
                      v: "ignorer" as const,
                      t: "Ignorer",
                      d: "N'importe que les valeurs totalement nouvelles.",
                    },
                  ]
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setStrategy(o.v)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      strategy === o.v
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted/50"
                    }`}
                  >
                    <div className="text-sm font-medium text-foreground">{o.t}</div>
                    <div className="text-xs text-muted-foreground">{o.d}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <div className="text-xs font-medium text-foreground">
                  Conflits détectés
                </div>
                <ul className="mt-2 space-y-1">
                  {analysis.conflits.slice(0, 30).map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      <span className="text-foreground">{c.existing.valeur}</span>
                      {c.differentSpelling ? ` → ${c.incoming.valeur}` : " (identique)"} ·{" "}
                      {c.existing.type}
                      {c.existing.cycle ? ` · ${c.existing.cycle}` : ""}
                    </li>
                  ))}
                  {analysis.conflits.length > 30 && (
                    <li className="text-xs text-muted-foreground">
                      … et {analysis.conflits.length - 30} autre(s)
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysis(null)}>
              Annuler
            </Button>
            <Button onClick={confirmImport} disabled={applyImport.isPending}>
              {applyImport.isPending ? "Import…" : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
