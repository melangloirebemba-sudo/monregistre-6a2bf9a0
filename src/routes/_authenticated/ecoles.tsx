import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, Plus, School as SchoolIcon, MapPin, Phone, Pencil, Trash2, Lock, Sparkles, GraduationCap, Users } from "lucide-react";
import { toast } from "sonner";
import { enqueueWrite } from "@/lib/offline-queue";
import { ecolesQO, classesQO, elevesQO, requireUserId, type Ecole } from "@/lib/queries/data";
import { planCapabilitiesQO } from "@/lib/queries/profil";
import { PLAN_LABEL, type PlanKey } from "@/config/support";
import { PlanUpgradeDialog } from "@/components/app/plan-limit";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { ListSkeleton, NoResults } from "@/components/ui/list-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_authenticated/ecoles")({
  head: () => ({ meta: [{ title: "Écoles — MonRegistre" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(ecolesQO());
    void context.queryClient.prefetchQuery(planCapabilitiesQO());
  },
  component: EcolesPage,
});

function EcolesPage() {
  const { data: ecoles = [], isLoading } = useQuery(ecolesQO());
  const { data: caps } = useQuery(planCapabilitiesQO());
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Ecole | null>(null);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Ecole | null>(null);
  const [viewing, setViewing] = useState<Ecole | null>(null);

  const pq = usePaginatedQuery({
    data: ecoles,
    search: q,
    searchFields: (e) => [e.nom, e.numero, e.adresse],
  });
  const paged = pq.items;

  const maxEcoles = caps?.max_ecoles ?? 0;
  const atLimit = !caps?.isAdmin && maxEcoles > 0 && ecoles.length >= maxEcoles;
  const currentPlan: PlanKey = caps?.plan ?? "gratuit";
  const planLabel = PLAN_LABEL[currentPlan];

  const handleAdd = () => {
    if (atLimit) {
      setUpgradeOpen(true);
      return;
    }
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="px-5 pb-24 pt-5">
      <header className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Registre</div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Écoles</h1>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
            {ecoles.length}
          </span>
        </div>
      </header>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une école…"
          className="pl-9"
        />
      </div>

      {atLimit && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              Limite atteinte — plan {planLabel}
            </div>
            <p className="mt-0.5 text-foreground/80">
              Le plan {planLabel} autorise {maxEcoles} école{maxEcoles > 1 ? "s" : ""}. Passez à un plan supérieur pour en ajouter davantage.
            </p>
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="mt-1 inline-flex items-center gap-1 text-teal underline-offset-2 hover:underline"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Mettre à niveau
            </button>
          </div>
        </div>
      )}


      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : pq.isEmpty ? (
        ecoles.length === 0 ? (
          <EmptyState onAdd={handleAdd} locked={atLimit} />
        ) : (
          <NoResults query={q} onReset={() => setQ("")} resetLabel="Effacer la recherche" />
        )
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {paged.map((e) => (
              <li
                key={e.id}
                className="card-elevated cursor-pointer p-4 transition hover:bg-cream-deep/40"
                onClick={() => setViewing(e)}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setViewing(e);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-foreground">
                    <SchoolIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-base font-semibold text-foreground">
                        {e.nom}
                      </h3>
                      {e.numero && (
                        <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[10px] font-semibold text-teal">
                          {e.numero}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {e.adresse && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" /> {e.adresse}
                        </div>
                      )}
                      {e.telephone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3" /> {e.telephone}
                        </div>
                      )}
                      {e.directeur_etudes && <div>Directeur : {e.directeur_etudes}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setEditing(e); setOpen(true); }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setToDelete(e); }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <DataPagination
            page={pq.page}
            totalPages={pq.totalPages}
            pageSize={pq.pageSize}
            totalCount={pq.totalCount}
            filteredCount={pq.filteredCount}
            start={pq.start}
            end={pq.end}
            onPageChange={pq.setPage}
            onPageSizeChange={pq.setPageSize}
            itemLabel="écoles"
          />
        </div>
      )}

      <FloatingAdd onClick={handleAdd} locked={atLimit} />


      <EcoleDialog
        open={open}
        onOpenChange={setOpen}
        ecole={editing}
      />

      <DeleteDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        ecole={toDelete}
        onDone={() => setToDelete(null)}
      />

      <PlanUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={currentPlan}
        ecole={ecoles[0]?.nom ?? ""}
        ressource="Écoles"
        limitDescription={`${maxEcoles} école${maxEcoles > 1 ? "s" : ""}`}
      />

      <EcoleClassesDialog
        ecole={viewing}
        onOpenChange={(v) => !v && setViewing(null)}
      />
    </div>
  );
}


function EmptyState({ onAdd, locked }: { onAdd: () => void; locked?: boolean }) {
  return (
    <div className="card-elevated flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-foreground">
        {locked ? <Lock className="h-6 w-6" /> : <SchoolIcon className="h-6 w-6" />}
      </span>
      <div>
        <div className="font-display text-lg font-semibold">Aucune école</div>
        <p className="mt-1 text-sm text-muted-foreground">
          {locked
            ? "Ajout d'école bloqué : la limite de votre plan est atteinte."
            : "Commencez par ajouter l'école où vous enseignez."}
        </p>
      </div>
      <Button onClick={onAdd} className="mt-2" variant={locked ? "outline" : "default"}>
        {locked ? (
          <>
            <Sparkles className="mr-1 h-4 w-4" /> Débloquer avec un plan supérieur
          </>
        ) : (
          <>
            <Plus className="mr-1 h-4 w-4" /> Ajouter une école
          </>
        )}
      </Button>
    </div>
  );
}

function FloatingAdd({ onClick, locked }: { onClick: () => void; locked?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={locked ? "Limite atteinte — mettre à niveau" : "Ajouter"}
      className={`fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full shadow-[var(--shadow-hero)] transition-transform hover:scale-105 lg:bottom-8 ${
        locked
          ? "bg-muted text-muted-foreground ring-2 ring-gold/50"
          : "bg-teal text-teal-foreground"
      }`}
    >
      {locked ? <Lock className="h-5 w-5" /> : <Plus className="h-6 w-6" />}
    </button>
  );
}



function EcoleDialog({
  open,
  onOpenChange,
  ecole,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ecole: Ecole | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nom: "",
    numero: "",
    adresse: "",
    telephone: "",
    directeur_etudes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        nom: ecole?.nom ?? "",
        numero: ecole?.numero ?? "",
        adresse: ecole?.adresse ?? "",
        telephone: ecole?.telephone ?? "",
        directeur_etudes: ecole?.directeur_etudes ?? "",
      });
    }
  }, [open, ecole]);

  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      const payload = {
        nom: form.nom.trim(),
        numero: form.numero.trim() || null,
        adresse: form.adresse.trim() || null,
        telephone: form.telephone.trim() || null,
        directeur_etudes: form.directeur_etudes.trim() || null,
      };
      if (!payload.nom) throw new Error("Le nom est obligatoire");
      if (ecole) {
        await enqueueWrite({
          table: "ecoles",
          op: "update",
          payload,
          match: { id: ecole.id },
          label: `Modifier école ${payload.nom}`,
        });
      } else {
        await enqueueWrite({
          table: "ecoles",
          op: "insert",
          payload: { ...payload, id: crypto.randomUUID(), user_id },
          label: `Ajouter école ${payload.nom}`,
        });
      }
    },
    onSuccess: () => {
      toast.success(ecole ? "École modifiée" : "École ajoutée");
      qc.invalidateQueries({ queryKey: ["ecoles"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="font-display">
            {ecole ? "Modifier l'école" : "Nouvelle école"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nom">Nom *</Label>
            <Input id="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="numero">Numéro / code</Label>
            <Input id="numero" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adresse">Adresse</Label>
            <Input id="adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tel">Téléphone</Label>
            <Input id="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dir">Directeur des études</Label>
            <Input id="dir" value={form.directeur_etudes} onChange={(e) => setForm({ ...form, directeur_etudes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  ecole,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ecole: Ecole | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!ecole) return;
      await enqueueWrite({
        table: "ecoles",
        op: "delete",
        match: { id: ecole.id },
        label: `Supprimer école ${ecole.nom}`,
      });
    },
    onSuccess: () => {
      toast.success("École supprimée");
      qc.invalidateQueries({ queryKey: ["ecoles"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {ecole?.nom} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action supprimera aussi les classes, élèves et notes rattachés.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              del.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

