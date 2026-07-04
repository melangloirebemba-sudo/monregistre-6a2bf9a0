import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { classesQO, ecolesQO, requireUserId, type Classe } from "@/lib/queries/data";
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

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes — MonRegistre" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const [ecoleFilter, setEcoleFilter] = useState<string>("all");
  const { data: classes = [], isLoading } = useQuery(
    classesQO(ecoleFilter === "all" ? undefined : ecoleFilter),
  );
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Classe | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Classe | null>(null);

  const filtered = useMemo(
    () =>
      classes.filter((c) =>
        [c.nom, c.code, c.matiere].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()),
      ),
    [classes, q],
  );

  const ecoleById = useMemo(() => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])), [ecoles]);

  const canAdd = ecoles.length > 0;

  return (
    <div className="px-5 pb-24 pt-5">
      <header className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Registre</div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Classes</h1>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
            {classes.length}
          </span>
        </div>
      </header>

      <div className="mb-3 space-y-2">
        <Select value={ecoleFilter} onValueChange={setEcoleFilter}>
          <SelectTrigger><SelectValue placeholder="Filtrer par école" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les écoles</SelectItem>
            {ecoles.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une classe…" className="pl-9" />
        </div>
      </div>

      {!canAdd ? (
        <div className="card-elevated p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ajoutez d'abord une école pour créer des classes.
          </p>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/15 text-ink">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <div className="font-display text-lg font-semibold">Aucune classe</div>
            <p className="mt-1 text-sm text-muted-foreground">Créez votre première classe.</p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter une classe
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id} className="card-elevated p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal/15 text-ink">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-base font-semibold text-foreground">{c.nom}</h3>
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-ink">{c.code}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {ecoleById[c.ecole_id] ?? "École inconnue"}
                    {c.matiere ? ` · ${c.matiere}` : ""}
                    {" · "}{c.effectif} élève{c.effectif > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => { setEditing(c); setOpen(true); }} aria-label="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setToDelete(c)} aria-label="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
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

      <ClasseDialog open={open} onOpenChange={setOpen} classe={editing} ecoles={ecoles} defaultEcoleId={ecoleFilter !== "all" ? ecoleFilter : ecoles[0]?.id} />
      <DeleteDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)} classe={toDelete} onDone={() => setToDelete(null)} />
    </div>
  );
}

function ClasseDialog({
  open,
  onOpenChange,
  classe,
  ecoles,
  defaultEcoleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classe: Classe | null;
  ecoles: { id: string; nom: string }[];
  defaultEcoleId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nom: "", code: "", matiere: "", effectif: "0", ecole_id: "" });

  useEffect(() => {
    if (open) {
      setForm({
        nom: classe?.nom ?? "",
        code: classe?.code ?? "",
        matiere: classe?.matiere ?? "",
        effectif: String(classe?.effectif ?? 0),
        ecole_id: classe?.ecole_id ?? defaultEcoleId ?? "",
      });
    }
  }, [open, classe, defaultEcoleId]);

  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      // Récupère l'année active pour rattacher la classe
      const { data: prof } = await supabase
        .from("profils_enseignant")
        .select("annee_active")
        .eq("user_id", user_id)
        .maybeSingle();
      const annee_scolaire = prof?.annee_active?.trim() || null;

      const payload = {
        nom: form.nom.trim(),
        code: form.code.trim(),
        matiere: form.matiere.trim() || null,
        effectif: Number(form.effectif) || 0,
        ecole_id: form.ecole_id,
      };
      if (!payload.nom || !payload.code) throw new Error("Nom et code obligatoires");
      if (!payload.ecole_id) throw new Error("Sélectionnez une école");
      if (classe) {
        const { error } = await supabase.from("classes").update(payload).eq("id", classe.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("classes")
          .insert({ ...payload, user_id, annee_scolaire });
        if (error) throw error;
      }
    },

    onSuccess: () => {
      toast.success(classe ? "Classe modifiée" : "Classe ajoutée");
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="font-display">{classe ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label>École *</Label>
            <Select value={form.ecole_id} onValueChange={(v) => setForm({ ...form, ecole_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir une école" /></SelectTrigger>
              <SelectContent>
                {ecoles.map((e) => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cnom">Nom *</Label>
              <Input id="cnom" placeholder="ex. 6ème A" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ccode">Code *</Label>
              <Input id="ccode" placeholder="6A" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ceff">Effectif</Label>
              <Input id="ceff" type="number" min={0} value={form.effectif} onChange={(e) => setForm({ ...form, effectif: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmat">Matière enseignée</Label>
            <Input id="cmat" value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ open, onOpenChange, classe, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; classe: Classe | null; onDone: () => void; }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!classe) return;
      const { error } = await supabase.from("classes").delete().eq("id", classe.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classe supprimée");
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {classe?.nom} ?</AlertDialogTitle>
          <AlertDialogDescription>Les élèves et notes rattachés seront aussi supprimés.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); del.mutate(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
