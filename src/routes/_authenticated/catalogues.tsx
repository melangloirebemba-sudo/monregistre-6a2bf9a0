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
import { toFrench } from "@/lib/errors";
import {
  buildCatalogueExport,
  catalogueHistoryQO,
  catalogueQO,
  parseCatalogueImport,
  useDeleteCatalogueEntry,
  useSaveCatalogue,
  useUpdateCatalogueEntry,
  type CatalogueEntry,
  type CatalogueType,
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
  const save = useSaveCatalogue();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toDelete, setToDelete] = useState<CatalogueEntry | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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
      await save.mutateAsync(items);
      toast.success(`${items.length} valeur(s) importée(s) — doublons ignorés`);
    } catch (e) {
      toast.error(toFrench(e as Error));
    }
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
    </div>
  );
}
