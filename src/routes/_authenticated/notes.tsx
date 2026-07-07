import { createFileRoute, Link } from "@tanstack/react-router";
import { EcoleFilter, EcoleBadge, EcoleGroupHeader } from "@/components/app/ecole-filter";
import { VirtualList } from "@/components/ui/virtual-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Pencil, Trash2, Search, Download, Zap } from "lucide-react";
import { toast } from "sonner";
import { enqueueWrite } from "@/lib/offline-queue";
import {
  rollbackLists,
  upsertInLists,
  upsertManyInLists,
  removeFromLists,
  type ListSnapshot,
} from "@/lib/optimistic";
import { downloadCsv } from "@/lib/csv";
import {
  classesQO,
  ecolesQO,
  elevesQO,
  notesQO,
  periodesQO,
  requireUserId,
  type Note,
} from "@/lib/queries/data";
import { profilQueryOptions } from "@/lib/queries/profil";

import { noteColorClass, formatNote } from "@/lib/format";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — MonRegistre" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(classesQO());
    void context.queryClient.prefetchQuery(ecolesQO());
    void context.queryClient.prefetchQuery(periodesQO());
    void context.queryClient.prefetchQuery(notesQO());
  },
  component: NotesPage,
});

type NoteRow = Note & { eleve: { nom: string; prenom: string; classe_id: string } | null };

function NotesPage() {
  const queryClient = useQueryClient();
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: classes = [] } = useQuery(classesQO());
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: periodes = [] } = useQuery(periodesQO());
  const echelle = profil?.echelle_notation ?? 20;

  // Précharge silencieusement les combinaisons de filtres voisines dès que
  // les classes/périodes sont connues → changement de filtre = instantané.
  useEffect(() => {
    for (const c of classes.slice(0, 6)) {
      void queryClient.prefetchQuery(notesQO({ classeId: c.id }));
      void queryClient.prefetchQuery(elevesQO(c.id));
    }
    for (const p of periodes.slice(0, 4)) {
      void queryClient.prefetchQuery(notesQO({ periodeId: p.id }));
    }
  }, [classes, periodes, queryClient]);


  const [ecoleFilter, setEcoleFilter] = useState<string>("all");
  const [classeFilter, setClasseFilter] = useState<string>("all");
  const [periodeFilter, setPeriodeFilter] = useState<string>("all");
  const { data: eleves = [] } = useQuery(elevesQO(classeFilter === "all" ? undefined : classeFilter));
  const { data: notes = [], isLoading } = useQuery(
    notesQO({
      classeId: classeFilter === "all" ? undefined : classeFilter,
      periodeId: periodeFilter === "all" ? undefined : periodeFilter,
    }),
  );

  const classesForEcole = useMemo(
    () => (ecoleFilter === "all" ? classes : classes.filter((c) => c.ecole_id === ecoleFilter)),
    [classes, ecoleFilter],
  );
  const classeById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const ecoleById = useMemo(() => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])), [ecoles]);

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<NoteRow | null>(null);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toDelete, setToDelete] = useState<NoteRow | null>(null);

  const deferredQ = useDeferredValue(q);
  const pq = usePaginatedQuery({
    data: notes,
    search: deferredQ,
    searchFields: (n) => [n.eleve?.prenom, n.eleve?.nom, n.libelle, n.matiere],
    filters: [
      (n) => {
        if (ecoleFilter === "all") return true;
        const cls = n.eleve ? classeById[n.eleve.classe_id] : null;
        return cls?.ecole_id === ecoleFilter;
      },
    ],
    sortKey: `${ecoleFilter}|${classeFilter}|${periodeFilter}`,
  });
  const filtered = pq.filtered;
  const paged = pq.items;




  const canAdd = eleves.length > 0 || classes.length > 0;

  return (
    <div className="px-5 pb-24 pt-5">
      <header className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Évaluations</div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Notes</h1>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">{notes.length}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={classes.length === 0}
            onClick={() => setBulkOpen(true)}
          >
            <Zap className="mr-1 h-4 w-4" /> Saisie rapide
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (filtered.length === 0) {
                toast.error("Aucune note à exporter");
                return;
              }
              const periodeById = Object.fromEntries(periodes.map((p) => [p.id, p.label]));
              downloadCsv(
                `notes-${new Date().toISOString().slice(0, 10)}.csv`,
                filtered.map((n) => ({
                  date: n.date,
                  eleve: n.eleve ? `${n.eleve.prenom} ${n.eleve.nom}` : "",
                  libelle: n.libelle,
                  matiere: n.matiere ?? "",
                  valeur: n.valeur,
                  echelle,
                  coefficient: n.coefficient,
                  periode: n.periode_id ? periodeById[n.periode_id] ?? "" : "",
                })),
              );
              toast.success(`${filtered.length} note(s) exportée(s)`);
            }}
          >
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </header>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <EcoleFilter
          value={ecoleFilter}
          ecoles={ecoles}
          emptyLabel="Toutes écoles"
          onValueChange={(v) => {
            setEcoleFilter(v);
            const cls = classes.find((c) => c.id === classeFilter);
            if (v !== "all" && cls && cls.ecole_id !== v) setClasseFilter("all");
          }}
        />
        <Select value={classeFilter} onValueChange={setClasseFilter}>
          <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes classes</SelectItem>
            {classesForEcole.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodeFilter} onValueChange={setPeriodeFilter}>
          <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes périodes</SelectItem>
            {periodes.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-9" />
      </div>

      {periodes.length === 0 && (
        <div className="mb-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
          Astuce : définissez vos périodes (trimestres/semestres) dans <Link to="/parametres" className="underline">Paramètres</Link>.
        </div>
      )}

      {!canAdd ? (
        <div className="card-elevated p-6 text-center text-sm text-muted-foreground">
          Créez d'abord une classe et un élève pour saisir des notes.
        </div>
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        notes.length === 0 ? (
          <div className="card-elevated flex flex-col items-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/15 text-foreground">
              <ClipboardList className="h-6 w-6" />
            </span>
            <div>
              <div className="font-display text-lg font-semibold">Aucune note</div>
              <p className="mt-1 text-sm text-muted-foreground">Saisissez votre première note.</p>
            </div>
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Ajouter une note
            </Button>
          </div>
        ) : (
          <NoResults
            query={q}
            onReset={() => {
              setQ("");
              setEcoleFilter("all");
              setClasseFilter("all");
              setPeriodeFilter("all");
            }}
          />
        )
      ) : (
        (() => {
          const renderItem = (n: NoteRow) => {
            const cls = n.eleve ? classeById[n.eleve.classe_id] : null;
            return (
              <div key={n.id} className="card-elevated p-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-sm font-semibold ${noteColorClass(n.valeur, echelle)}`}>
                    {formatNote(n.valeur)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold text-foreground">
                      {n.eleve ? `${n.eleve.prenom} ${n.eleve.nom}` : "Élève ?"}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      <EcoleBadge name={cls ? ecoleById[cls.ecole_id] : undefined} />
                      {cls ? ` · ${cls.nom}` : ""}
                      {" · "}{n.libelle}
                      {n.coefficient !== 1 ? ` · coef ${n.coefficient}` : ""}
                      {n.matiere ? ` · ${n.matiere}` : ""}
                      {" · "}{new Date(n.date).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <button onClick={() => { setEditing(n); setOpen(true); }} aria-label="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setToDelete(n)} aria-label="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          };
          const listView = (() => {
            if (ecoleFilter === "all") {
              const map = new Map<string, NoteRow[]>();
              paged.forEach((n) => {
                const cls = n.eleve ? classeById[n.eleve.classe_id] : null;
                const key = cls?.ecole_id ?? "__unknown__";
                const list = map.get(key) ?? [];
                list.push(n);
                map.set(key, list);
              });
              const grouped = Array.from(map.entries()).sort((a, b) =>
                (ecoleById[a[0]] ?? "").localeCompare(ecoleById[b[0]] ?? ""),
              );
              return (
                <div className="space-y-4">
                  {grouped.map(([ecoleId, list]) => (
                    <section key={ecoleId}>
                      <EcoleGroupHeader name={ecoleById[ecoleId]} count={list.length} />
                      <div>{list.map((n) => renderItem(n))}</div>
                    </section>
                  ))}
                </div>
              );
            }
            return (
              <VirtualList
                items={paged}
                estimateSize={78}
                overscan={6}
                className="max-h-[70vh]"
                getItemKey={(n) => n.id}
                renderItem={renderItem}
              />
            );
          })();
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
                itemLabel="notes"
              />
            </div>
          );
        })()
      )}


      {canAdd && (
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          aria-label="Ajouter"
          className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-teal text-teal-foreground shadow-[var(--shadow-hero)] transition-transform hover:scale-105 lg:bottom-8"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <NoteDialog
        open={open}
        onOpenChange={setOpen}
        note={editing}
        classes={classes}
        periodes={periodes}
        echelle={echelle}
        defaultClasseId={classeFilter !== "all" ? classeFilter : undefined}
        defaultPeriodeId={periodeFilter !== "all" ? periodeFilter : undefined}
      />
      <BulkNoteDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        classes={classes}
        periodes={periodes}
        echelle={echelle}
        defaultClasseId={classeFilter !== "all" ? classeFilter : undefined}
        defaultPeriodeId={periodeFilter !== "all" ? periodeFilter : undefined}
      />
      <DeleteNoteDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)} note={toDelete} onDone={() => setToDelete(null)} />
    </div>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  note,
  classes,
  periodes,
  echelle,
  defaultClasseId,
  defaultPeriodeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  note: NoteRow | null;
  classes: Array<{ id: string; nom: string; ecole_id: string; matiere: string | null }>;
  periodes: Array<{ id: string; label: string }>;
  echelle: number;
  defaultClasseId?: string;
  defaultPeriodeId?: string;
}) {
  const qc = useQueryClient();
  const [classeId, setClasseId] = useState<string>("");
  const { data: eleves = [] } = useQuery({
    ...elevesQO(classeId || undefined),
    enabled: !!classeId,
  });

  const [form, setForm] = useState({
    eleve_id: "",
    libelle: "",
    valeur: "",
    coefficient: "1",
    matiere: "",
    date: new Date().toISOString().slice(0, 10),
    periode_id: "none",
  });

  useEffect(() => {
    if (open) {
      const initialClasseId = note?.eleve?.classe_id ?? defaultClasseId ?? classes[0]?.id ?? "";
      setClasseId(initialClasseId);
      const cls = classes.find((c) => c.id === initialClasseId);
      setForm({
        eleve_id: note?.eleve_id ?? "",
        libelle: note?.libelle ?? "",
        valeur: note ? String(note.valeur) : "",
        coefficient: note ? String(note.coefficient) : "1",
        matiere: note?.matiere ?? cls?.matiere ?? "",
        date: note?.date ?? new Date().toISOString().slice(0, 10),
        periode_id: note?.periode_id ?? defaultPeriodeId ?? "none",
      });
    }
  }, [open, note, defaultClasseId, defaultPeriodeId, classes]);

  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      const valeur = Number(form.valeur);
      if (!form.eleve_id) throw new Error("Sélectionnez un élève");
      if (!form.libelle.trim()) throw new Error("Libellé obligatoire");
      if (Number.isNaN(valeur) || valeur < 0 || valeur > echelle) {
        throw new Error(`Note entre 0 et ${echelle}`);
      }
      const eleve = eleves.find((e) => e.id === form.eleve_id);
      const cls = classes.find((c) => c.id === classeId);
      const ecole_id = eleve?.ecole_id ?? cls?.ecole_id;
      if (!ecole_id) throw new Error("École introuvable");
      const payload = {
        eleve_id: form.eleve_id,
        libelle: form.libelle.trim(),
        valeur,
        coefficient: Number(form.coefficient) || 1,
        matiere: form.matiere.trim() || null,
        date: form.date,
        periode_id: form.periode_id === "none" ? null : form.periode_id,
        ecole_id,
      };
      if (note) {
        await enqueueWrite({
          table: "notes",
          op: "update",
          payload,
          match: { id: note.id },
          label: `Modifier note ${form.libelle}`,
          baseUpdatedAt: note.updated_at,
          conflictStrategy: "merge",
        });
      } else {
        await enqueueWrite({
          table: "notes",
          op: "insert",
          payload: { ...payload, id: crypto.randomUUID(), user_id },
          label: `Ajouter note ${form.libelle}`,
        });
      }
    },
    // Mise à jour optimiste : on patche immédiatement les caches `notes`
    // pour que la liste reflète la modification sans attendre le réseau.
    onMutate: async (): Promise<{ snapshot: ListSnapshot<NoteRow> } | undefined> => {
      const valeur = Number(form.valeur);
      const eleve = eleves.find((e) => e.id === form.eleve_id);
      const cls = classes.find((c) => c.id === classeId);
      const ecole_id = eleve?.ecole_id ?? cls?.ecole_id;
      if (
        !form.eleve_id ||
        !form.libelle.trim() ||
        Number.isNaN(valeur) ||
        valeur < 0 ||
        valeur > echelle ||
        !eleve ||
        !ecole_id
      ) {
        return undefined;
      }
      await qc.cancelQueries({ queryKey: ["notes"] });
      const now = new Date().toISOString();
      const optimistic: NoteRow = {
        id: note?.id ?? `tmp-${crypto.randomUUID()}`,
        user_id: note?.user_id ?? "optimistic",
        eleve_id: form.eleve_id,
        libelle: form.libelle.trim(),
        valeur,
        coefficient: Number(form.coefficient) || 1,
        matiere: form.matiere.trim() || null,
        date: form.date,
        periode_id: form.periode_id === "none" ? null : form.periode_id,
        sequence_id: note?.sequence_id ?? null,
        ecole_id,
        updated_at: now,
        eleve: { nom: eleve.nom, prenom: eleve.prenom, classe_id: eleve.classe_id },
      };
      const snapshot = upsertInLists<NoteRow>(qc, ["notes"], optimistic, {
        sort: (a, b) => b.date.localeCompare(a.date),
        keyMatches: (row, key) => {
          const [, kClasse, kEleve, kPeriode] = key as string[];
          if (kClasse && kClasse !== "-" && row.eleve?.classe_id !== kClasse) return false;
          if (kEleve && kEleve !== "-" && row.eleve_id !== kEleve) return false;
          if (kPeriode && kPeriode !== "-" && (row.periode_id ?? "-") !== kPeriode) return false;
          return true;
        },
      });
      // Fermeture immédiate du dialogue pour la sensation d'instantané.
      onOpenChange(false);
      return { snapshot };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.snapshot) rollbackLists<NoteRow>(qc, ctx.snapshot);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success(note ? "Note modifiée" : "Note ajoutée");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="font-display">{note ? "Modifier la note" : "Nouvelle note"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Classe *</Label>
            <Select value={classeId} onValueChange={(v) => { setClasseId(v); setForm((f) => ({ ...f, eleve_id: "" })); }}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Élève *</Label>
            <Select value={form.eleve_id} onValueChange={(v) => setForm({ ...form, eleve_id: v })} disabled={!classeId}>
              <SelectTrigger><SelectValue placeholder={classeId ? "Choisir" : "Choisissez une classe"} /></SelectTrigger>
              <SelectContent>
                {eleves.map((e) => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nlib">Libellé *</Label>
            <Input id="nlib" placeholder="Devoir 1, Interro…" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nval">Note /{echelle} *</Label>
              <Input id="nval" type="number" min={0} max={echelle} step="0.25" value={form.valeur} onChange={(e) => setForm({ ...form, valeur: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ncoef">Coef.</Label>
              <Input id="ncoef" type="number" min={0.5} step="0.5" value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ndate">Date</Label>
              <Input id="ndate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nmat">Matière</Label>
              <Input id="nmat" value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Période</Label>
              <Select value={form.periode_id} onValueChange={(v) => setForm({ ...form, periode_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {periodes.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "…" : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteNoteDialog({ open, onOpenChange, note, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; note: NoteRow | null; onDone: () => void; }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!note) return;
      await enqueueWrite({
        table: "notes",
        op: "delete",
        match: { id: note.id },
        label: "Supprimer note",
        baseUpdatedAt: note.updated_at,
        conflictStrategy: "merge",
      });
    },
    onMutate: async (): Promise<{ snapshot: ListSnapshot<NoteRow> } | undefined> => {
      if (!note) return undefined;
      await qc.cancelQueries({ queryKey: ["notes"] });
      const snapshot = removeFromLists<NoteRow>(qc, ["notes"], note.id);
      onDone();
      return { snapshot };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.snapshot) rollbackLists<NoteRow>(qc, ctx.snapshot);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Note supprimée"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
    },
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette note ?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); del.mutate(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Dialogue de saisie rapide : lignes par élève, sélection multiple d'élèves,
// multi-période et multi-matière (produit cartésien), validation par ligne
// et patch optimiste par lot (upsertManyInLists) pour zéro latence perçue.
// Navigation clavier : autofocus libellé, ↑/↓/Entrée pour naviguer entre les
// champs élèves, Ctrl+Entrée pour valider.
function BulkNoteDialog({
  open,
  onOpenChange,
  classes,
  periodes,
  echelle,
  defaultClasseId,
  defaultPeriodeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: Array<{ id: string; nom: string; ecole_id: string; matiere: string | null }>;
  periodes: Array<{ id: string; label: string }>;
  echelle: number;
  defaultClasseId?: string;
  defaultPeriodeId?: string;
}) {
  const qc = useQueryClient();
  const [classeId, setClasseId] = useState<string>("");
  const [libelle, setLibelle] = useState("");
  const [matieresText, setMatieresText] = useState("");
  const [coefficient, setCoefficient] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodeIds, setPeriodeIds] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState(false);

  const libelleRef = useState<HTMLInputElement | null>(null as unknown as HTMLInputElement | null);
  // Simple ref via useState to avoid extra import; we only need the DOM node.
  const setLibelleRef = (el: HTMLInputElement | null) => libelleRef[1](el);

  const { data: eleves = [] } = useQuery({
    ...elevesQO(classeId || undefined),
    enabled: !!classeId && open,
  });

  useEffect(() => {
    if (open) {
      const initial = defaultClasseId ?? classes[0]?.id ?? "";
      setClasseId(initial);
      const cls = classes.find((c) => c.id === initial);
      setLibelle("");
      setMatieresText(cls?.matiere ?? "");
      setCoefficient("1");
      setDate(new Date().toISOString().slice(0, 10));
      setPeriodeIds(defaultPeriodeId ? [defaultPeriodeId] : []);
      setValues({});
      setChecked({});
      setShowPreview(false);
      // Autofocus sur le libellé au prochain tick.
      setTimeout(() => libelleRef[0]?.focus(), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultClasseId, defaultPeriodeId, classes]);

  useEffect(() => {
    setValues({});
    setChecked({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId]);

  // Toutes les cases cochées par défaut dès qu'on connaît les élèves.
  useEffect(() => {
    if (!open || eleves.length === 0) return;
    setChecked((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      for (const e of eleves) next[e.id] = true;
      return next;
    });
  }, [open, eleves]);

  const matieresList = useMemo(() => {
    const parts = matieresText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  }, [matieresText]);

  const parsedRows = useMemo(() => {
    return eleves.map((e) => {
      const raw = (values[e.id] ?? "").trim().replace(",", ".");
      const isChecked = checked[e.id] !== false;
      if (!raw) return { eleve: e, raw, num: null as number | null, error: null as string | null, checked: isChecked };
      const num = Number(raw);
      if (Number.isNaN(num)) return { eleve: e, raw, num: null, error: "Nombre invalide", checked: isChecked };
      if (num < 0 || num > echelle) return { eleve: e, raw, num: null, error: `0–${echelle}`, checked: isChecked };
      return { eleve: e, raw, num, error: null, checked: isChecked };
    });
  }, [eleves, values, checked, echelle]);

  const activeRows = parsedRows.filter((r) => r.checked && r.num !== null);
  const errorCount = parsedRows.filter((r) => r.checked && r.error).length;
  const multiplier = Math.max(1, periodeIds.length) * Math.max(1, matieresList.length);
  const totalNotes = activeRows.length * multiplier;

  // Navigation clavier entre les champs élèves.
  const inputRefs = useMemo(() => new Map<string, HTMLInputElement>(), []);
  const setInputRef = (id: string) => (el: HTMLInputElement | null) => {
    if (el) inputRefs.set(id, el);
    else inputRefs.delete(id);
  };
  const focusOffset = (currentId: string, offset: number) => {
    const list = eleves.map((e) => e.id);
    const idx = list.indexOf(currentId);
    if (idx === -1) return;
    let i = idx + offset;
    while (i >= 0 && i < list.length) {
      const el = inputRefs.get(list[i]);
      if (el) {
        el.focus();
        el.select();
        return;
      }
      i += offset;
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      if (!libelle.trim()) throw new Error("Libellé obligatoire");
      if (!classeId) throw new Error("Classe obligatoire");
      if (errorCount > 0) throw new Error("Corrigez les notes invalides");
      if (activeRows.length === 0) throw new Error("Aucune note à enregistrer");
      const cls = classes.find((c) => c.id === classeId);
      const coef = Number(coefficient) || 1;
      const periodesToUse = periodeIds.length > 0 ? periodeIds : [null];
      const matieresToUse = matieresList.length > 0 ? matieresList : [null];
      for (const r of activeRows) {
        const ecole_id = r.eleve.ecole_id ?? cls?.ecole_id;
        if (!ecole_id) continue;
        for (const pid of periodesToUse) {
          for (const mat of matieresToUse) {
            await enqueueWrite({
              table: "notes",
              op: "insert",
              payload: {
                id: crypto.randomUUID(),
                user_id,
                eleve_id: r.eleve.id,
                libelle: libelle.trim(),
                valeur: r.num as number,
                coefficient: coef,
                matiere: mat,
                date,
                periode_id: pid,
                ecole_id,
              },
              label: `Note ${libelle} · ${r.eleve.prenom} ${r.eleve.nom}`,
            });
          }
        }
      }
    },
    onMutate: async (): Promise<{ snapshot: ListSnapshot<NoteRow> } | undefined> => {
      if (!libelle.trim() || !classeId || errorCount > 0 || activeRows.length === 0) return undefined;
      const cls = classes.find((c) => c.id === classeId);
      const coef = Number(coefficient) || 1;
      const periodesToUse = periodeIds.length > 0 ? periodeIds : [null];
      const matieresToUse = matieresList.length > 0 ? matieresList : [null];
      await qc.cancelQueries({ queryKey: ["notes"] });
      const now = new Date().toISOString();
      const optimistic: NoteRow[] = [];
      for (const r of activeRows) {
        for (const pid of periodesToUse) {
          for (const mat of matieresToUse) {
            optimistic.push({
              id: `tmp-${crypto.randomUUID()}`,
              user_id: "optimistic",
              eleve_id: r.eleve.id,
              libelle: libelle.trim(),
              valeur: r.num as number,
              coefficient: coef,
              matiere: mat,
              date,
              periode_id: pid,
              sequence_id: null,
              ecole_id: r.eleve.ecole_id ?? cls?.ecole_id ?? "",
              updated_at: now,
              eleve: { nom: r.eleve.nom, prenom: r.eleve.prenom, classe_id: r.eleve.classe_id },
            });
          }
        }
      }
      const snapshot = upsertManyInLists<NoteRow>(qc, ["notes"], optimistic, {
        sort: (a, b) => b.date.localeCompare(a.date),
        keyMatches: (row, key) => {
          const [, kClasse, kEleve, kPeriode] = key as string[];
          if (kClasse && kClasse !== "-" && row.eleve?.classe_id !== kClasse) return false;
          if (kEleve && kEleve !== "-" && row.eleve_id !== kEleve) return false;
          if (kPeriode && kPeriode !== "-" && (row.periode_id ?? "-") !== kPeriode) return false;
          return true;
        },
      });
      onOpenChange(false);
      return { snapshot };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.snapshot) rollbackLists<NoteRow>(qc, ctx.snapshot);
      toast.error(e.message);
    },
    onSuccess: () => toast.success(`${totalNotes} note(s) ajoutée(s)`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
    },
  });

  const allCheckedCount = parsedRows.filter((r) => r.checked).length;
  const togglePeriode = (id: string) => {
    setPeriodeIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px]"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            save.mutate();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Saisie rapide de notes</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Classe *</Label>
              <Select value={classeId} onValueChange={setClasseId}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blib">Libellé *</Label>
              <Input
                id="blib"
                ref={setLibelleRef}
                placeholder="Devoir 1…"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bcoef">Coef.</Label>
              <Input id="bcoef" type="number" min={0.5} step="0.5" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="bmat">Matière(s)</Label>
              <Input
                id="bmat"
                placeholder="Maths, Physique…"
                value={matieresText}
                onChange={(e) => setMatieresText(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bdate">Date</Label>
              <Input id="bdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {matieresList.length > 1 && (
            <div className="text-[11px] text-muted-foreground">
              {matieresList.length} matières · une note par matière et par élève.
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Période(s)</Label>
            <div className="flex flex-wrap gap-1.5">
              {periodes.length === 0 ? (
                <span className="text-xs text-muted-foreground">Aucune période définie</span>
              ) : (
                periodes.map((p) => {
                  const on = periodeIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePeriode(p.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        on
                          ? "border-teal bg-teal text-teal-foreground"
                          : "border-border bg-background text-foreground hover:bg-cream-deep"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })
              )}
            </div>
            {periodeIds.length > 1 && (
              <div className="text-[11px] text-muted-foreground">
                {periodeIds.length} périodes · une note par période.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-cream-deep/40 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Élèves · {allCheckedCount}/{eleves.length} sélectionné(s)</span>
              <div className="flex items-center gap-2 normal-case tracking-normal">
                <button
                  type="button"
                  className="text-[11px] text-foreground underline underline-offset-2"
                  onClick={() => setChecked(Object.fromEntries(eleves.map((e) => [e.id, true])))}
                >
                  Tout
                </button>
                <button
                  type="button"
                  className="text-[11px] text-foreground underline underline-offset-2"
                  onClick={() => setChecked(Object.fromEntries(eleves.map((e) => [e.id, false])))}
                >
                  Aucun
                </button>
                <span>·</span>
                <span>
                  {totalNotes} à enregistrer
                  {errorCount > 0 ? ` · ${errorCount} err.` : ""}
                </span>
              </div>
            </div>
            <div className="max-h-[42vh] overflow-y-auto divide-y divide-border/60">
              {eleves.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {classeId ? "Aucun élève dans cette classe" : "Choisissez une classe"}
                </div>
              ) : (
                parsedRows.map((r) => (
                  <label
                    key={r.eleve.id}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${
                      r.checked ? "" : "opacity-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-teal"
                      checked={r.checked}
                      onChange={(e) =>
                        setChecked((c) => ({ ...c, [r.eleve.id]: e.target.checked }))
                      }
                    />
                    <div className="min-w-0 flex-1 truncate text-sm">
                      {r.eleve.prenom} {r.eleve.nom}
                    </div>
                    <div className="flex flex-col items-end">
                      <Input
                        ref={setInputRef(r.eleve.id)}
                        type="text"
                        inputMode="decimal"
                        placeholder={`/${echelle}`}
                        disabled={!r.checked}
                        className={`h-9 w-20 text-right ${r.error ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        value={values[r.eleve.id] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [r.eleve.id]: e.target.value }))
                        }
                        onFocus={(e) => {
                          if (!r.checked) {
                            setChecked((c) => ({ ...c, [r.eleve.id]: true }));
                          }
                          e.currentTarget.select();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "ArrowDown") {
                            e.preventDefault();
                            focusOffset(r.eleve.id, 1);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            focusOffset(r.eleve.id, -1);
                          }
                        }}
                      />
                      {r.error ? (
                        <span className="mt-0.5 text-[10px] text-destructive">{r.error}</span>
                      ) : null}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground">
            Astuce : ↑/↓ ou Entrée pour naviguer entre les élèves · Ctrl+Entrée pour valider.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button
              type="submit"
              disabled={save.isPending || totalNotes === 0 || errorCount > 0 || !libelle.trim()}
            >
              {save.isPending ? "…" : `Enregistrer (${totalNotes})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
