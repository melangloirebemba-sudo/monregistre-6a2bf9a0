import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Archive, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  listAnneesGlobal,
  bulkArchiveAnnee,
  bulkDeleteAnnee,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/annees-scolaires")({
  head: () => ({ meta: [{ title: "Années scolaires — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAnneesPage,
});

interface AnneeAggregate {
  libelle: string;
  active: number;
  archivee: number;
  a_venir: number;
  enseignants: number;
}

function AdminAnneesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAnneesGlobal);
  const archiveFn = useServerFn(bulkArchiveAnnee);
  const deleteFn = useServerFn(bulkDeleteAnnee);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-annees"],
    queryFn: () => listFn() as Promise<AnneeAggregate[]>,
    staleTime: 15_000,
  });

  const [archiveTarget, setArchiveTarget] = useState<AnneeAggregate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnneeAggregate | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-annees"] });

  const archive = useMutation({
    mutationFn: (libelle: string) => archiveFn({ data: { libelle } }),
    onSuccess: (r) => {
      toast.success(`Année clôturée pour ${r.archived} enseignant(s)`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (libelle: string) => deleteFn({ data: { libelle } }),
    onSuccess: (r) => {
      toast.success(`${r.deleted} entrée(s) supprimée(s)`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 px-5 py-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Backoffice
        </div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold text-foreground">
          <CalendarClock className="h-7 w-7 text-teal" /> Années scolaires
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue globale des années utilisées sur la plateforme. L'admin peut clôturer
          une année pour tous les enseignants en fin de cycle.
        </p>
      </header>

      {isLoading && (
        <div className="card-elevated p-6 text-sm text-muted-foreground">Chargement…</div>
      )}
      {error && (
        <div className="card-elevated p-6 text-sm text-destructive">
          Erreur : {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && data.length === 0 && (
        <div className="card-elevated p-6 text-sm text-muted-foreground">
          Aucune année scolaire enregistrée.
        </div>
      )}

      {data.length > 0 && (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.libelle} className="card-elevated p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold text-foreground">
                      {a.libelle}
                    </span>
                    {a.active > 0 && (
                      <Badge className="bg-teal/15 text-teal hover:bg-teal/20">
                        {a.active} active{a.active > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {a.a_venir > 0 && (
                      <Badge className="bg-gold/25 text-ink hover:bg-gold/30">
                        {a.a_venir} à venir
                      </Badge>
                    )}
                    {a.archivee > 0 && (
                      <Badge variant="secondary">{a.archivee} archivée{a.archivee > 1 ? "s" : ""}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {a.enseignants} enseignant{a.enseignants > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={a.active === 0 || archive.isPending}
                    onClick={() => setArchiveTarget(a)}
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" /> Clôturer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={remove.isPending}
                    onClick={() => setDeleteTarget(a)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={(v) => !v && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer l'année {archiveTarget?.libelle} ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'année sera archivée pour <strong>{archiveTarget?.active} enseignant(s)</strong>.
              Ils devront choisir une nouvelle année à la prochaine connexion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!archiveTarget) return;
                archive.mutate(archiveTarget.libelle);
                setArchiveTarget(null);
              }}
            >
              Clôturer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'année {deleteTarget?.libelle} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. Toutes les entrées
              ({deleteTarget?.active ?? 0} active + {deleteTarget?.archivee ?? 0} archivée + {deleteTarget?.a_venir ?? 0} à venir)
              seront supprimées pour l'ensemble des enseignants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                remove.mutate(deleteTarget.libelle);
                setDeleteTarget(null);
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
