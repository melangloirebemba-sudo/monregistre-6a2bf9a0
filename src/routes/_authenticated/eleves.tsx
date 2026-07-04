import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  classesQO,
  elevesQO,
  notesQO,
  requireUserId,
  type Eleve,
} from "@/lib/queries/data";
import { moyennePonderee, noteColorClass, formatNote } from "@/lib/format";
import { profilQueryOptions } from "@/lib/queries/profil";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/eleves")({
  head: () => ({ meta: [{ title: "Élèves — MonRegistre" }] }),
  component: ElevesPage,
});

function ElevesPage() {
  const { data: classes = [] } = useQuery(classesQO());
  const { data: profil } = useQuery(profilQueryOptions());
  const [classeFilter, setClasseFilter] = useState<string>("all");
  const { data: eleves = [], isLoading } = useQuery(
    elevesQO(classeFilter === "all" ? undefined : classeFilter),
  );
  const { data: notes = [] } = useQuery(notesQO({ classeId: classeFilter === "all" ? undefined : classeFilter }));
  const echelle = profil?.echelle_notation ?? 20;

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Eleve | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Eleve | null>(null);

  const filtered = useMemo(
    () =>
      eleves.filter((e) =>
        `${e.nom} ${e.prenom}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [eleves, q],
  );

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
  const canAdd = classes.length > 0;

  return (
    <div className="px-5 pb-24 pt-5">
      <header className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Registre</div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Élèves</h1>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">{eleves.length}</span>
        </div>
      </header>

      <div className="mb-3 space-y-2">
        <Select value={classeFilter} onValueChange={setClasseFilter}>
          <SelectTrigger><SelectValue placeholder="Filtrer par classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un élève…" className="pl-9" />
        </div>
      </div>

      {!canAdd ? (
        <div className="card-elevated p-6 text-center text-sm text-muted-foreground">
          Ajoutez d'abord une classe pour inscrire vos élèves.
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/15 text-ink">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <div className="font-display text-lg font-semibold">Aucun élève</div>
            <p className="mt-1 text-sm text-muted-foreground">Ajoutez votre premier élève.</p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter un élève
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => {
            const moy = moyennesByEleve.get(e.id);
            const cls = classeById[e.classe_id];
            return (
              <li key={e.id} className="card-elevated p-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-full font-display text-sm font-semibold ${e.sexe === "F" ? "bg-gold-soft/40 text-ink" : "bg-teal/15 text-ink"}`}>
                    {e.prenom.charAt(0)}{e.nom.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold text-foreground">
                      {e.prenom} {e.nom}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {cls?.nom ?? "Classe inconnue"}
                    </div>
                  </div>
                  {moy !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${noteColorClass(moy, echelle)}`}>
                      {formatNote(moy)}/{echelle}
                    </span>
                  )}
                  <button onClick={() => { setEditing(e); setOpen(true); }} aria-label="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setToDelete(e)} aria-label="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canAdd && (
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          aria-label="Ajouter"
          className="fixed bottom-24 right-1/2 z-20 grid h-14 w-14 translate-x-[195px] place-items-center rounded-full bg-teal text-teal-foreground shadow-[var(--shadow-hero)] md:translate-x-[240px] lg:translate-x-[280px]"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <EleveDialog
        open={open}
        onOpenChange={setOpen}
        eleve={editing}
        classes={classes}
        defaultClasseId={classeFilter !== "all" ? classeFilter : classes[0]?.id}
      />
      <DeleteEleveDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)} eleve={toDelete} onDone={() => setToDelete(null)} />
    </div>
  );
}

function EleveDialog({
  open, onOpenChange, eleve, classes, defaultClasseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eleve: Eleve | null;
  classes: Array<{ id: string; nom: string; ecole_id: string }>;
  defaultClasseId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nom: "", prenom: "", sexe: "M", classe_id: "" });

  useEffect(() => {
    if (open) {
      setForm({
        nom: eleve?.nom ?? "",
        prenom: eleve?.prenom ?? "",
        sexe: eleve?.sexe ?? "M",
        classe_id: eleve?.classe_id ?? defaultClasseId ?? "",
      });
    }
  }, [open, eleve, defaultClasseId]);

  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      if (!form.nom.trim() || !form.prenom.trim()) throw new Error("Nom et prénom obligatoires");
      if (!form.classe_id) throw new Error("Sélectionnez une classe");
      const classe = classes.find((c) => c.id === form.classe_id);
      if (!classe) throw new Error("Classe invalide");
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        sexe: form.sexe,
        classe_id: form.classe_id,
        ecole_id: classe.ecole_id,
      };
      if (eleve) {
        const { error } = await supabase.from("eleves").update(payload).eq("id", eleve.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eleves").insert({ ...payload, user_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(eleve ? "Élève modifié" : "Élève ajouté");
      qc.invalidateQueries({ queryKey: ["eleves"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
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
              <Input id="enom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label>Classe *</Label>
              <Select value={form.classe_id} onValueChange={(v) => setForm({ ...form, classe_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
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

function DeleteEleveDialog({ open, onOpenChange, eleve, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; eleve: Eleve | null; onDone: () => void; }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!eleve) return;
      const { error } = await supabase.from("eleves").delete().eq("id", eleve.id);
      if (error) throw error;
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
