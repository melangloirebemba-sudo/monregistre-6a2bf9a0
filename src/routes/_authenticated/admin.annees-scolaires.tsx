import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Archive,
  Trash2,
  Users,
  Plus,
  Pencil,
  Play,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminAnneeAggregate } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/admin/annees-scolaires")({
  head: () => ({ meta: [{ title: "Années scolaires — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminAnneesPage,
});

function AdminAnneesPage() {
  const qc = useQueryClient();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["admin-annees"],
    queryFn: () => adminApi.anneesList(),
    staleTime: 15_000,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newLibelle, setNewLibelle] = useState("");
  const [newDebut, setNewDebut] = useState("");
  const [newFin, setNewFin] = useState("");

  const [renameTarget, setRenameTarget] = useState<AdminAnneeAggregate | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [archiveTarget, setArchiveTarget] = useState<AdminAnneeAggregate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAnneeAggregate | null>(null);
  const [activateTarget, setActivateTarget] = useState<AdminAnneeAggregate | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-annees"] });
  const err = (e: Error) => toast.error(e.message);

  const create = useMutation({
    mutationFn: (v: { libelle: string; date_debut?: string; date_fin?: string }) =>
      adminApi.anneesCreate({
        libelle: v.libelle,
        date_debut: v.date_debut || null,
        date_fin: v.date_fin || null,
        statut: "a_venir",
      }),
    onSuccess: (r) => {
      toast.success(`Année créée pour ${r.created} enseignant(s)`);
      invalidate();
    },
    onError: err,
  });

  const rename = useMutation({
    mutationFn: (v: { oldLibelle: string; newLibelle: string }) =>
      adminApi.anneesRename(v.oldLibelle, v.newLibelle),
    onSuccess: (r) => {
      toast.success(`${r.updated} entrée(s) renommée(s)`);
      invalidate();
    },
    onError: err,
  });

  const setStatus = useMutation({
    mutationFn: (v: { libelle: string; statut: "active" | "archivee" | "a_venir" }) =>
      adminApi.anneesSetStatus(v.libelle, v.statut),
    onSuccess: (r) => {
      toast.success(`${r.updated} entrée(s) mise(s) à jour`);
      invalidate();
    },
    onError: err,
  });

  const archive = useMutation({
    mutationFn: (libelle: string) => adminApi.anneesArchive(libelle),
    onSuccess: (r) => {
      toast.success(`Année clôturée pour ${r.archived} enseignant(s)`);
      invalidate();
    },
    onError: err,
  });

  const remove = useMutation({
    mutationFn: (libelle: string) => adminApi.anneesDelete(libelle),
    onSuccess: (r) => {
      toast.success(`${r.deleted} entrée(s) supprimée(s)`);
      invalidate();
    },
    onError: err,
  });

  return (
    <div className="space-y-5 px-4 py-5 sm:px-5 sm:py-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Backoffice
          </div>
          <h1 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
            <CalendarClock className="h-6 w-6 shrink-0 text-teal sm:h-7 sm:w-7" />
            <span className="truncate">Années scolaires</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion globale : créez, renommez, activez, clôturez ou supprimez les années
            pour l'ensemble des enseignants.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setNewLibelle("");
            setNewDebut("");
            setNewFin("");
            setCreateOpen(true);
          }}
          className="shrink-0 sm:size-default"
        >
          <Plus className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Nouvelle année</span>
        </Button>
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
          Aucune année scolaire enregistrée. Cliquez sur « Nouvelle année ».
        </div>
      )}

      {data.length > 0 && (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.libelle} className="card-elevated p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-base font-semibold text-foreground sm:text-lg">
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
                      <Badge variant="secondary">
                        {a.archivee} archivée{a.archivee > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {a.enseignants} enseignant{a.enseignants > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRenameTarget(a);
                      setRenameValue(a.libelle);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Renommer
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setStatus.isPending}
                    onClick={() => setActivateTarget(a)}
                    title="Rendre cette année active pour tous"
                  >
                    <Play className="mr-1 h-3.5 w-3.5" /> Activer
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={a.active === 0 || archive.isPending}
                    onClick={() => setArchiveTarget(a)}
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" /> Clôturer
                  </Button>

                  {a.archivee > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setStatus.mutate({ libelle: a.libelle, statut: "a_venir" })
                      }
                      title="Réouvrir (statut à venir)"
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" /> Réouvrir
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="col-span-2 text-destructive hover:bg-destructive/10 hover:text-destructive sm:col-span-1"
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-teal" /> Nouvelle année scolaire
            </DialogTitle>
            <DialogDescription>
              Créée en statut « à venir » pour tous les enseignants existants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lib">Libellé</Label>
              <Input
                id="lib"
                value={newLibelle}
                onChange={(e) => setNewLibelle(e.target.value)}
                placeholder="Ex. 2026-2027"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="deb">Début</Label>
                <Input id="deb" type="date" value={newDebut} onChange={(e) => setNewDebut(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="fin">Fin</Label>
                <Input id="fin" type="date" value={newFin} onChange={(e) => setNewFin(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              disabled={!newLibelle.trim() || create.isPending}
              onClick={() => {
                create.mutate({
                  libelle: newLibelle.trim(),
                  date_debut: newDebut || undefined,
                  date_fin: newFin || undefined,
                });
                setCreateOpen(false);
              }}
            >
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-teal" /> Renommer l'année
            </DialogTitle>
            <DialogDescription>
              Applique le nouveau libellé pour tous les enseignants.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="rn">Nouveau libellé</Label>
            <Input id="rn" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Annuler</Button>
            <Button
              disabled={!renameValue.trim() || renameValue.trim() === renameTarget?.libelle}
              onClick={() => {
                if (!renameTarget) return;
                rename.mutate({ oldLibelle: renameTarget.libelle, newLibelle: renameValue.trim() });
                setRenameTarget(null);
              }}
            >
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate confirm */}
      <AlertDialog open={!!activateTarget} onOpenChange={(v) => !v && setActivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activer l'année {activateTarget?.libelle} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les autres années actives seront automatiquement archivées afin
              d'éviter les conflits. Les enseignants basculeront sur cette année.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!activateTarget) return;
                setStatus.mutate({ libelle: activateTarget.libelle, statut: "active" });
                setActivateTarget(null);
              }}
            >
              Activer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirm */}
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'année {deleteTarget?.libelle} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. Toutes les entrées
              ({deleteTarget?.active ?? 0} active + {deleteTarget?.archivee ?? 0} archivée
              + {deleteTarget?.a_venir ?? 0} à venir) seront supprimées pour tous les enseignants.
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
