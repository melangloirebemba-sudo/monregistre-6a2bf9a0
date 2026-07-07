import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Users, Plus, Pencil, Trash2, Search, Crown, Upload, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { enqueueWrite } from "@/lib/offline-queue";
import { parseCsvFile, downloadCsv } from "@/lib/csv";
import {
  classesQO,
  ecolesQO,
  elevesQO,
  notesQO,
  requireUserId,
  type Eleve,
} from "@/lib/queries/data";
import { moyennePonderee, noteColorClass, formatNote } from "@/lib/format";
import { profilQueryOptions, planCapabilitiesQO } from "@/lib/queries/profil";
import { PLAN_LABEL, type PlanKey } from "@/config/support";
import {
  PlanLimitBanner,
  LockedEmptyState,
  LockedFloatingAdd,
  PlanUpgradeDialog,
} from "@/components/app/plan-limit";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { ListSkeleton, NoResults } from "@/components/ui/list-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EcoleFilter, EcoleBadge, EcoleGroupHeader } from "@/components/app/ecole-filter";
import { VirtualList } from "@/components/ui/virtual-list";

export const Route = createFileRoute("/_authenticated/eleves")({
  head: () => ({ meta: [{ title: "Élèves — MonRegistre" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(elevesQO());
    void context.queryClient.prefetchQuery(classesQO());
    void context.queryClient.prefetchQuery(ecolesQO());
  },
  component: ElevesPage,
});

function ElevesPage() {
  const queryClient = useQueryClient();
  const { data: classes = [] } = useQuery(classesQO());
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: caps } = useQuery(planCapabilitiesQO());
  const { data: allEleves = [] } = useQuery(elevesQO());
  const [ecoleFilter, setEcoleFilter] = useState<string>("all");
  const [classeFilter, setClasseFilter] = useState<string>("all");
  const { data: eleves = [], isLoading } = useQuery(
    elevesQO(classeFilter === "all" ? undefined : classeFilter),
  );
  const { data: notes = [] } = useQuery(notesQO({ classeId: classeFilter === "all" ? undefined : classeFilter }));
  const echelle = profil?.echelle_notation ?? 20;

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Eleve | null>(null);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Eleve | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Eleve | null>(null);

  // Précharge les élèves/notes pour les classes voisines afin que le changement
  // de filtre soit instantané depuis le cache.
  useEffect(() => {
    for (const c of classes.slice(0, 8)) {
      void queryClient.prefetchQuery(elevesQO(c.id));
      void queryClient.prefetchQuery(notesQO({ classeId: c.id }));
    }
  }, [classes, queryClient]);

  const maxEleves = caps?.max_eleves ?? 0;
  const isAdmin = !!caps?.isAdmin;
  const atLimit = !isAdmin && maxEleves > 0 && allEleves.length >= maxEleves;
  const currentPlan: PlanKey = caps?.plan ?? "gratuit";
  const planLabel = PLAN_LABEL[currentPlan];
  const limitDescription = `${maxEleves} élève${maxEleves > 1 ? "s" : ""}`;
  const bannerMessage = `Le plan ${planLabel} autorise ${limitDescription}. Passez à un plan supérieur pour en ajouter davantage.`;

  const classesForEcole = useMemo(
    () => (ecoleFilter === "all" ? classes : classes.filter((c) => c.ecole_id === ecoleFilter)),
    [classes, ecoleFilter],
  );

  const pq = usePaginatedQuery({
    data: eleves,
    search: q,
    searchFields: (e) => [e.nom, e.prenom],
    filters: [(e) => ecoleFilter === "all" || e.ecole_id === ecoleFilter],
    sortKey: `${ecoleFilter}|${classeFilter}`,
  });
  const filtered = pq.filtered;
  const paged = pq.items;

  const moyennesByEleve = useMemo(() => {
    const map = new Map<string, number>();
    const byEleve = new Map<string, { valeur: number; coefficient: number }[]>();
    notes.forEach((n) => {
      const arr = byEleve.get(n.eleve_id) ?? [];
      arr.push({ valeur: n.valeur, coefficient: n.coefficient });
      byEleve.set(n.eleve_id, arr);
    });
    byEleve.forEach((arr, eleveId) => {
      const m = moyennePonderee(arr);
      if (m !== null) map.set(eleveId, m);
    });
    return map;
  }, [notes]);

  const classeById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const ecoleById = useMemo(() => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])), [ecoles]);
  const canAdd = classes.length > 0;

  const grouped = useMemo(() => {
    if (ecoleFilter !== "all") return null;
    const map = new Map<string, typeof paged>();
    paged.forEach((e) => {
      const list = map.get(e.ecole_id) ?? [];
      list.push(e);
      map.set(e.ecole_id, list);
    });
    return Array.from(map.entries()).sort((a, b) =>
      (ecoleById[a[0]] ?? "").localeCompare(ecoleById[b[0]] ?? ""),
    );
  }, [paged, ecoleFilter, ecoleById]);

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
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Élèves</h1>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">{eleves.length}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ImportElevesButton
            classes={classes}
            defaultClasseId={classeFilter !== "all" ? classeFilter : undefined}
          />
          <ExportElevesButton eleves={filtered} classeById={classeById} />
        </div>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <EcoleFilter
          value={ecoleFilter}
          ecoles={ecoles}
          onValueChange={(v) => {
            setEcoleFilter(v);
            const cls = classes.find((c) => c.id === classeFilter);
            if (v !== "all" && cls && cls.ecole_id !== v) setClasseFilter("all");
          }}
        />
        <Select value={classeFilter} onValueChange={setClasseFilter}>
          <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classesForEcole.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un élève…" className="pl-9" />
      </div>


      {canAdd && atLimit && (
        <PlanLimitBanner
          planLabel={planLabel}
          message={bannerMessage}
          onUpgrade={() => setUpgradeOpen(true)}
        />
      )}

      {!canAdd ? (
        <div className="card-elevated p-6 text-center text-sm text-muted-foreground">
          Ajoutez d'abord une classe pour inscrire vos élèves.
        </div>
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        eleves.length === 0 ? (
          <LockedEmptyState
            icon={<Users className="h-6 w-6" />}
            title="Aucun élève"
            hint="Ajoutez votre premier élève."
            lockedHint="Ajout d'élève bloqué : la limite de votre plan est atteinte."
            onAdd={handleAdd}
            addLabel={<><Plus className="mr-1 h-4 w-4" /> Ajouter un élève</>}
            locked={atLimit}
          />
        ) : (
          <NoResults
            query={q}
            onReset={() => {
              setQ("");
              setEcoleFilter("all");
              setClasseFilter("all");
            }}
          />
        )
      ) : (
        (() => {
          const renderItem = (e: Eleve) => {
            const moy = moyennesByEleve.get(e.id);
            const cls = classeById[e.classe_id];
            const isChef = cls?.chef_id === e.id;
            return (
              <div key={e.id} className="card-elevated p-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className={`relative grid h-10 w-10 place-items-center rounded-full font-display text-sm font-semibold ${e.sexe === "F" ? "bg-gold-soft/40 text-foreground" : "bg-teal/15 text-foreground"}`}>
                    {e.nom.charAt(0)}{e.prenom.charAt(0)}
                    {isChef && (
                      <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-foreground shadow" title="Chef de classe">
                        <Crown className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate font-display text-sm font-semibold text-foreground">
                        <span className="uppercase">{e.nom}</span> {e.prenom}
                      </div>
                      {isChef && (
                        <span className="rounded-full bg-gold/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground">Chef</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      <EcoleBadge name={ecoleById[e.ecole_id]} />
                      {" · "}{cls?.nom ?? "Classe inconnue"}
                      {e.numero_eleve ? ` · ${e.numero_eleve}` : ""}
                      {e.tuteur_numero ? ` · Tuteur ${e.tuteur_numero}` : ""}
                    </div>
                  </div>
                  {moy !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${noteColorClass(moy, echelle)}`}>
                      {formatNote(moy)}/{echelle}
                    </span>
                  )}
                  <button onClick={() => setViewing(e)} aria-label="Voir les détails" className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setEditing(e); setOpen(true); }} aria-label="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setToDelete(e)} aria-label="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          };
          const listView = grouped ? (
            <div className="space-y-4">
              {grouped.map(([ecoleId, list]) => (
                <section key={ecoleId}>
                  <EcoleGroupHeader name={ecoleById[ecoleId]} count={list.length} />
                  <ul className="space-y-2">{list.map((e) => <li key={e.id}>{renderItem(e)}</li>)}</ul>
                </section>
              ))}
            </div>
          ) : (
            <VirtualList
              items={paged}
              estimateSize={82}
              overscan={6}
              className="max-h-[70vh]"
              getItemKey={(e) => e.id}
              renderItem={renderItem}
            />
          );
          return (
            <div className="space-y-3">
              {listView}
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
                itemLabel="élèves"
              />
            </div>
          );
        })()
      )}



      {canAdd && (
        <LockedFloatingAdd
          onClick={handleAdd}
          locked={atLimit}
          icon={<Plus className="h-6 w-6" />}
        />
      )}

      <EleveDialog
        open={open}
        onOpenChange={setOpen}
        eleve={editing}
        classes={classes}
        ecoles={ecoles}
        defaultClasseId={classeFilter !== "all" ? classeFilter : classes[0]?.id}
      />
      <DeleteEleveDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)} eleve={toDelete} onDone={() => setToDelete(null)} />
      <EleveDetailsDialog
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        eleve={viewing}
        classe={viewing ? classeById[viewing.classe_id] : null}
        ecoleNom={viewing ? ecoleById[viewing.ecole_id] : undefined}
        moyenne={viewing ? moyennesByEleve.get(viewing.id) : undefined}
        echelle={echelle}
      />
      <PlanUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={currentPlan}
        ecole={
          ecoleFilter !== "all"
            ? ecoleById[ecoleFilter]
            : ecoles[0]?.nom ?? ""
        }
        classe={
          classeFilter !== "all" ? classeById[classeFilter]?.nom : undefined
        }
        ressource="Élèves"
        limitDescription={limitDescription}
      />
    </div>
  );
}

function EleveDialog({
  open, onOpenChange, eleve, classes, ecoles, defaultClasseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eleve: Eleve | null;
  classes: Array<{ id: string; nom: string; ecole_id: string; chef_id: string | null }>;
  ecoles: Array<{ id: string; nom: string }>;
  defaultClasseId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    sexe: "M",
    ecole_id: "",
    classe_id: "",
    numero_eleve: "",
    adresse: "",
    tuteur_nom: "",
    tuteur_numero: "",
    chef: false,
  });

  useEffect(() => {
    if (open) {
      const classeId = eleve?.classe_id ?? defaultClasseId ?? "";
      const cls = classes.find((c) => c.id === classeId);
      const ecoleId = eleve?.ecole_id ?? cls?.ecole_id ?? ecoles[0]?.id ?? "";
      setForm({
        nom: eleve?.nom ?? "",
        prenom: eleve?.prenom ?? "",
        sexe: eleve?.sexe ?? "M",
        ecole_id: ecoleId,
        classe_id: cls && cls.ecole_id === ecoleId ? classeId : "",
        numero_eleve: eleve?.numero_eleve ?? "",
        adresse: eleve?.adresse ?? "",
        tuteur_nom: eleve?.tuteur_nom ?? "",
        tuteur_numero: eleve?.tuteur_numero ?? "",
        chef: !!(eleve && cls && cls.chef_id === eleve.id),
      });
    }
  }, [open, eleve, defaultClasseId, classes, ecoles]);

  const classesForEcole = useMemo(
    () => classes.filter((c) => c.ecole_id === form.ecole_id),
    [classes, form.ecole_id],
  );

  const selectedClasse = useMemo(
    () => classes.find((c) => c.id === form.classe_id) ?? null,
    [classes, form.classe_id],
  );
  const classeMismatch =
    !!form.classe_id && !!form.ecole_id && !!selectedClasse && selectedClasse.ecole_id !== form.ecole_id;


  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      if (!form.nom.trim() || !form.prenom.trim()) throw new Error("Nom et prénom obligatoires");
      if (!form.ecole_id) throw new Error("Sélectionnez une école");
      if (!form.classe_id) throw new Error("Sélectionnez une classe");
      const classe = classes.find((c) => c.id === form.classe_id);
      if (!classe) throw new Error("Classe invalide");
      if (classe.ecole_id !== form.ecole_id) throw new Error("La classe ne correspond pas à l'école sélectionnée");
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        sexe: form.sexe,
        classe_id: form.classe_id,
        ecole_id: form.ecole_id,
        numero_eleve: form.numero_eleve.trim() || null,
        adresse: form.adresse.trim() || null,
        tuteur_nom: form.tuteur_nom.trim() || null,
        tuteur_numero: form.tuteur_numero.trim() || null,
      };
      let eleveId = eleve?.id;
      if (eleve) {
        await enqueueWrite({
          table: "eleves",
          op: "update",
          payload,
          match: { id: eleve.id },
          label: `Modifier ${form.prenom} ${form.nom}`,
        });
      } else {
        // Generate id client-side so a later chef_id update can reference
        // it even when the insert is queued offline.
        eleveId = crypto.randomUUID();
        await enqueueWrite({
          table: "eleves",
          op: "insert",
          payload: { ...payload, id: eleveId, user_id },
          label: `Ajouter ${form.prenom} ${form.nom}`,
        });
      }
      // Chef de classe
      const wasChef = eleve && classe.chef_id === eleve.id;
      if (form.chef && eleveId) {
        await enqueueWrite({
          table: "classes",
          op: "update",
          payload: { chef_id: eleveId },
          match: { id: form.classe_id },
          label: "Définir chef de classe",
        });
      } else if (wasChef && !form.chef) {
        await enqueueWrite({
          table: "classes",
          op: "update",
          payload: { chef_id: null },
          match: { id: form.classe_id },
          label: "Retirer chef de classe",
        });
      }
    },
    onSuccess: () => {
      toast.success(eleve ? "Élève modifié" : "Élève ajouté");
      qc.invalidateQueries({ queryKey: ["eleves"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{eleve ? "Modifier l'élève" : "Nouvel élève"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eprenom">Prénom *</Label>
              <Input id="eprenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enom">Nom *</Label>
              <Input
                id="enom"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value.toUpperCase() })}
                style={{ textTransform: "uppercase" }}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Sexe</Label>
            <Select value={form.sexe} onValueChange={(v) => setForm({ ...form, sexe: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>École *</Label>
              <Select
                value={form.ecole_id}
                onValueChange={(v) =>
                  setForm((prev) =>
                    prev.ecole_id === v
                      ? prev
                      : { ...prev, ecole_id: v, classe_id: "" },
                  )
                }

              >
                <SelectTrigger>
                  <SelectValue placeholder={ecoles.length ? "Choisir" : "Aucune école"} />
                </SelectTrigger>
                <SelectContent>
                  {ecoles.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Classe *</Label>
              <Select
                value={form.classe_id}
                onValueChange={(v) => setForm({ ...form, classe_id: v })}
                disabled={!form.ecole_id || classesForEcole.length === 0}
              >
                <SelectTrigger aria-invalid={classeMismatch} className={classeMismatch ? "border-destructive" : undefined}>
                  <SelectValue
                    placeholder={
                      !form.ecole_id
                        ? "École d'abord"
                        : classesForEcole.length === 0
                          ? "Aucune classe"
                          : "Choisir"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {classesForEcole.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classeMismatch && (
                <p className="text-xs text-destructive">
                  Cette classe n'appartient pas à l'école sélectionnée. Choisissez une classe de cette école.
                </p>
              )}
            </div>

          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enum">Numéro de l'élève</Label>
            <Input id="enum" value={form.numero_eleve} onChange={(e) => setForm({ ...form, numero_eleve: e.target.value })} placeholder="Téléphone ou matricule" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eadr">Adresse de l'élève</Label>
            <Input id="eadr" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etnom">Nom du tuteur</Label>
              <Input id="etnom" value={form.tuteur_nom} onChange={(e) => setForm({ ...form, tuteur_nom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etnum">Numéro du tuteur</Label>
              <Input id="etnum" value={form.tuteur_numero} onChange={(e) => setForm({ ...form, tuteur_numero: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-input bg-cream-deep/40 px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.chef}
              onChange={(e) => setForm({ ...form, chef: e.target.checked })}
              className="h-4 w-4 accent-teal"
            />
            <span className="flex items-center gap-1.5 text-sm">
              <Crown className="h-3.5 w-3.5 text-gold" />
              Chef de classe
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={save.isPending || classeMismatch}>{save.isPending ? "…" : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEleveDialog({ open, onOpenChange, eleve, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; eleve: Eleve | null; onDone: () => void; }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!eleve) return;
      await enqueueWrite({
        table: "eleves",
        op: "delete",
        match: { id: eleve.id },
        label: `Supprimer ${eleve.prenom} ${eleve.nom}`,
      });
    },
    onSuccess: () => {
      toast.success("Élève supprimé");
      qc.invalidateQueries({ queryKey: ["eleves"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {eleve?.prenom} {eleve?.nom} ?</AlertDialogTitle>
          <AlertDialogDescription>Les notes de cet élève seront aussi supprimées.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); del.mutate(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ImportElevesButton({
  classes,
  defaultClasseId,
}: {
  classes: Array<{ id: string; nom: string; ecole_id: string }>;
  defaultClasseId?: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<null | {
    rows: Array<Record<string, string>>;
    classeId: string;
  }>(null);

  const onPick = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = await parseCsvFile(file);
      if (rows.length === 0) {
        toast.error("Fichier vide");
        return;
      }
      setPreview({ rows, classeId: defaultClasseId ?? classes[0]?.id ?? "" });
    } catch {
      toast.error("Import CSV impossible");
    }
  };

  const runImport = async () => {
    if (!preview) return;
    const classe = classes.find((c) => c.id === preview.classeId);
    if (!classe) {
      toast.error("Sélectionnez une classe cible");
      return;
    }
    setBusy(true);
    let user_id: string;
    try {
      user_id = await requireUserId();
    } catch {
      setBusy(false);
      toast.error("Session expirée");
      return;
    }
    let ok = 0;
    let ko = 0;
    for (const r of preview.rows) {
      const nom = (r.nom ?? r.name ?? "").trim();
      const prenom = (r.prenom ?? r.firstname ?? "").trim();
      if (!nom || !prenom) {
        ko++;
        continue;
      }
      const sexeRaw = (r.sexe ?? r.genre ?? "").trim().toUpperCase();
      const sexe = sexeRaw.startsWith("F") ? "F" : "M";
      try {
        await enqueueWrite({
          table: "eleves",
          op: "insert",
          payload: {
            id: crypto.randomUUID(),
            user_id,
            nom,
            prenom,
            sexe,
            classe_id: classe.id,
            ecole_id: classe.ecole_id,
            numero_eleve: (r.numero_eleve ?? r.numero ?? r.matricule ?? "").trim() || null,
            adresse: (r.adresse ?? r.address ?? "").trim() || null,
            tuteur_nom: (r.tuteur_nom ?? r.tuteur ?? r.parent ?? "").trim() || null,
            tuteur_numero: (r.tuteur_numero ?? r.telephone_tuteur ?? r.tel ?? "").trim() || null,
          },
          label: `Import élève ${prenom} ${nom}`,
        });
        ok++;
      } catch {
        ko++;
      }
    }
    setBusy(false);
    setPreview(null);
    qc.invalidateQueries({ queryKey: ["eleves"] });
    qc.invalidateQueries({ queryKey: ["counts"] });
    toast.success(`${ok} élève(s) importé(s)${ko ? ` · ${ko} ignoré(s)` : ""}`);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPick}
        disabled={classes.length === 0}
      >
        <Upload className="mr-1 h-4 w-4" /> Importer CSV
      </Button>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="font-display">
              Importer {preview?.rows.length ?? 0} élève(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Colonnes reconnues : <code>nom</code>, <code>prenom</code>,{" "}
              <code>sexe</code> (M/F), <code>numero_eleve</code>,{" "}
              <code>tuteur_nom</code>, <code>tuteur_numero</code>,{" "}
              <code>adresse</code>.
            </p>
            <div className="space-y-1.5">
              <Label>Classe cible</Label>
              <Select
                value={preview?.classeId ?? ""}
                onValueChange={(v) =>
                  setPreview((p) => (p ? { ...p, classeId: v } : p))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preview && preview.rows.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md border border-input bg-cream-deep/40 p-2 text-[11px]">
                {preview.rows.slice(0, 5).map((r, i) => (
                  <div key={i} className="truncate">
                    · {r.prenom ?? r.firstname ?? "?"} {r.nom ?? r.name ?? "?"}
                  </div>
                ))}
                {preview.rows.length > 5 && (
                  <div className="text-muted-foreground">
                    … et {preview.rows.length - 5} de plus
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={runImport} disabled={busy || !preview?.classeId}>
              {busy ? "Import…" : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExportElevesButton({
  eleves,
  classeById,
}: {
  eleves: Eleve[];
  classeById: Record<string, { nom: string } | undefined>;
}) {
  const onClick = () => {
    if (eleves.length === 0) {
      toast.error("Aucun élève à exporter");
      return;
    }
    downloadCsv(
      `eleves-${new Date().toISOString().slice(0, 10)}.csv`,
      eleves.map((e) => ({
        nom: e.nom,
        prenom: e.prenom,
        sexe: e.sexe ?? "",
        classe: classeById[e.classe_id]?.nom ?? "",
        numero_eleve: e.numero_eleve ?? "",
        tuteur_nom: e.tuteur_nom ?? "",
        tuteur_numero: e.tuteur_numero ?? "",
        adresse: e.adresse ?? "",
      })),
    );
    toast.success(`${eleves.length} élève(s) exporté(s)`);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <Download className="mr-1 h-4 w-4" /> Export CSV
    </Button>
  );
}

function EleveDetailsDialog({
  open,
  onOpenChange,
  eleve,
  classe,
  ecoleNom,
  moyenne,
  echelle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eleve: Eleve | null;
  classe: { id: string; nom: string; chef_id: string | null } | null | undefined;
  ecoleNom?: string;
  moyenne?: number;
  echelle: number;
}) {
  if (!eleve) return null;
  const isChef = classe?.chef_id === eleve.id;
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Détails de l'élève</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex items-center gap-3">
          <span className={`grid h-12 w-12 place-items-center rounded-full font-display text-base font-semibold ${eleve.sexe === "F" ? "bg-gold-soft/40 text-foreground" : "bg-teal/15 text-foreground"}`}>
            {eleve.nom.charAt(0)}{eleve.prenom.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold text-foreground truncate">
              <span className="uppercase">{eleve.nom}</span> {eleve.prenom}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{eleve.sexe === "F" ? "Féminin" : "Masculin"}</span>
              {isChef && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  <Crown className="h-3 w-3" /> Chef
                </span>
              )}
            </div>
          </div>
          {moyenne !== undefined && (
            <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${noteColorClass(moyenne, echelle)}`}>
              {formatNote(moyenne)}/{echelle}
            </span>
          )}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-background/60 p-3">
          <Row label="École" value={ecoleNom} />
          <Row label="Classe" value={classe?.nom} />
          <Row label="Numéro / matricule" value={eleve.numero_eleve} />
          <Row label="Adresse" value={eleve.adresse} />
          <Row label="Nom du tuteur" value={eleve.tuteur_nom} />
          <Row label="Téléphone tuteur" value={eleve.tuteur_numero} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
