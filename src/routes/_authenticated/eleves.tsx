import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, Search, Crown } from "lucide-react";
import { toast } from "sonner";
import { enqueueWrite } from "@/lib/offline-queue";
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
            const isChef = cls?.chef_id === e.id;
            return (
              <li key={e.id} className="card-elevated p-3">
                <div className="flex items-center gap-3">
                  <span className={`relative grid h-10 w-10 place-items-center rounded-full font-display text-sm font-semibold ${e.sexe === "F" ? "bg-gold-soft/40 text-ink" : "bg-teal/15 text-ink"}`}>
                    {e.prenom.charAt(0)}{e.nom.charAt(0)}
                    {isChef && (
                      <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-ink shadow" title="Chef de classe">
                        <Crown className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate font-display text-sm font-semibold text-foreground">
                        {e.prenom} {e.nom}
                      </div>
                      {isChef && (
                        <span className="rounded-full bg-gold/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink">Chef</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {cls?.nom ?? "Classe inconnue"}
                      {e.numero_eleve ? ` · ${e.numero_eleve}` : ""}
                      {e.tuteur_numero ? ` · Tuteur ${e.tuteur_numero}` : ""}
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
          className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-teal text-teal-foreground shadow-[var(--shadow-hero)] transition-transform hover:scale-105 lg:bottom-8"
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
  classes: Array<{ id: string; nom: string; ecole_id: string; chef_id: string | null }>;
  defaultClasseId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    sexe: "M",
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
      setForm({
        nom: eleve?.nom ?? "",
        prenom: eleve?.prenom ?? "",
        sexe: eleve?.sexe ?? "M",
        classe_id: classeId,
        numero_eleve: eleve?.numero_eleve ?? "",
        adresse: eleve?.adresse ?? "",
        tuteur_nom: eleve?.tuteur_nom ?? "",
        tuteur_numero: eleve?.tuteur_numero ?? "",
        chef: !!(eleve && cls && cls.chef_id === eleve.id),
      });
    }
  }, [open, eleve, defaultClasseId, classes]);

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
