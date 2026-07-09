import { createFileRoute } from "@tanstack/react-router";
import { toFrench } from "@/lib/errors";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Pencil, Trash2, CheckCircle2, PlayCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  classesQO,
  ecolesQO,
  periodesQO,
  sequencesQO,
  requireUserId,
  type Sequence,
} from "@/lib/queries/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/progression")({
  head: () => ({ meta: [{ title: "Progression — MonRegistre" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(classesQO());
    void context.queryClient.prefetchQuery(ecolesQO());
    void context.queryClient.prefetchQuery(periodesQO());
    void context.queryClient.prefetchQuery(sequencesQO());
  },
  component: ProgressionPage,
});

type SequenceRow = Sequence & {
  classe: { nom: string; code: string; ecole_id: string } | null;
  periode: { label: string } | null;
};

function currentWeek(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = (now.getTime() - start.getTime()) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}

type EffectiveStatus = "terminee" | "en_cours" | "en_retard" | "a_venir";

function computeStatus(s: SequenceRow, week: number): EffectiveStatus {
  if (s.date_traitee || s.statut === "terminee") return "terminee";
  if (s.statut === "en_cours") return "en_cours";
  if (s.semaine_prevue && s.semaine_prevue < week) return "en_retard";
  return "a_venir";
}

const STATUS_META: Record<EffectiveStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  terminee: { label: "Terminée", className: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
  en_cours: { label: "En cours", className: "bg-teal/15 text-teal border-teal/30", Icon: PlayCircle },
  en_retard: { label: "En retard", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertTriangle },
  a_venir: { label: "À venir", className: "bg-muted text-muted-foreground border-border", Icon: Clock },
};

function ProgressionPage() {
  const qc = useQueryClient();
  const week = currentWeek();
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: classes = [] } = useQuery(classesQO());
  const { data: periodes = [] } = useQuery(periodesQO());
  const [filterEcole, setFilterEcole] = useState<string>("all");
  const [filterClasse, setFilterClasse] = useState<string>("all");
  const [filterPeriode, setFilterPeriode] = useState<string>("all");

  const { data: sequences = [] } = useQuery(sequencesQO());

  const classesFilteredByEcole = useMemo(
    () => (filterEcole === "all" ? classes : classes.filter((c) => c.ecole_id === filterEcole)),
    [classes, filterEcole],
  );

  const filtered = useMemo(() => {
    return sequences.filter((s) => {
      if (filterClasse !== "all" && s.classe_id !== filterClasse) return false;
      if (filterPeriode !== "all" && s.periode_id !== filterPeriode) return false;
      if (filterEcole !== "all" && s.classe?.ecole_id !== filterEcole) return false;
      return true;
    });
  }, [sequences, filterClasse, filterPeriode, filterEcole]);

  // Dashboard: par classe × période, taux d'avancement
  const dashboard = useMemo(() => {
    const map = new Map<string, { classe: string; code: string; periode: string; total: number; done: number; late: number; classe_id: string; periode_id: string | null }>();
    for (const s of sequences) {
      if (filterEcole !== "all" && s.classe?.ecole_id !== filterEcole) continue;
      const key = `${s.classe_id}::${s.periode_id ?? "none"}`;
      const eff = computeStatus(s, week);
      const row = map.get(key) ?? {
        classe: s.classe?.nom ?? "—",
        code: s.classe?.code ?? "",
        periode: s.periode?.label ?? "Sans période",
        total: 0,
        done: 0,
        late: 0,
        classe_id: s.classe_id,
        periode_id: s.periode_id,
      };
      row.total += 1;
      if (eff === "terminee") row.done += 1;
      if (eff === "en_retard") row.late += 1;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => a.classe.localeCompare(b.classe));
  }, [sequences, filterEcole, week]);

  // Formulaire
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SequenceRow | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [f, setF] = useState({
    classe_id: "",
    periode_id: "",
    titre: "",
    description: "",
    ordre: "1",
    semaine_prevue: "",
    statut: "a_venir",
    date_traitee: "",
    notes_libres: "",
  });

  function openCreate() {
    setEdit(null);
    setF({
      classe_id: classes[0]?.id ?? "",
      periode_id: periodes.find((p) => p.active)?.id ?? periodes[0]?.id ?? "",
      titre: "",
      description: "",
      ordre: String((filtered[filtered.length - 1]?.ordre ?? 0) + 1),
      semaine_prevue: "",
      statut: "a_venir",
      date_traitee: "",
      notes_libres: "",
    });
    setOpen(true);
  }
  function openEdit(s: SequenceRow) {
    setEdit(s);
    setF({
      classe_id: s.classe_id,
      periode_id: s.periode_id ?? "",
      titre: s.titre,
      description: s.description ?? "",
      ordre: String(s.ordre),
      semaine_prevue: s.semaine_prevue ? String(s.semaine_prevue) : "",
      statut: s.statut,
      date_traitee: s.date_traitee ?? "",
      notes_libres: s.notes_libres ?? "",
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const uid = await requireUserId();
      if (!f.classe_id) throw new Error("Classe requise");
      if (!f.titre.trim()) throw new Error("Titre requis");
      const payload = {
        user_id: uid,
        classe_id: f.classe_id,
        periode_id: f.periode_id || null,
        titre: f.titre.trim(),
        description: f.description.trim() || null,
        ordre: Number(f.ordre) || 1,
        semaine_prevue: f.semaine_prevue ? Number(f.semaine_prevue) : null,
        statut: f.statut,
        date_traitee: f.date_traitee || null,
        notes_libres: f.notes_libres.trim() || null,
      };
      if (edit) {
        const { error } = await supabase.from("sequences_programme").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sequences_programme").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      setOpen(false);
      toast.success(edit ? "Séquence mise à jour" : "Séquence ajoutée");
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sequences_programme").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      setToDelete(null);
      toast.success("Séquence supprimée");
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const quickAdvance = useMutation({
    mutationFn: async (s: SequenceRow) => {
      const eff = computeStatus(s, week);
      let update: Partial<Sequence> = {};
      if (eff === "terminee") return;
      if (eff === "en_cours") update = { statut: "terminee", date_traitee: new Date().toISOString().slice(0, 10) };
      else update = { statut: "en_cours" };
      const { error } = await supabase.from("sequences_programme").update(update).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-teal" /> Progression pédagogique
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Semaine {week} · {sequences.length} séquences</p>
        </div>
        <Button onClick={openCreate} className="shrink-0"><Plus className="h-4 w-4 mr-1" /> Séquence</Button>
      </header>

      {/* Tableau de bord */}
      <section className="card-elevated p-4 space-y-3">
        <h2 className="font-serif text-lg">Où j'en suis</h2>
        {dashboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune séquence enregistrée.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dashboard.map((d) => {
              const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
              return (
                <div key={`${d.classe_id}-${d.periode_id}`} className="rounded-xl border border-border p-3 bg-background/50">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{d.classe} <span className="text-muted-foreground text-xs">({d.code})</span></div>
                      <div className="text-xs text-muted-foreground">{d.periode}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-mono">{d.done}/{d.total}</div>
                      {d.late > 0 && <div className="text-xs text-destructive">{d.late} en retard</div>}
                    </div>
                  </div>
                  <Progress value={pct} className="mt-2" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Filtres */}
      <section className="grid gap-2 sm:grid-cols-3">
        <Select value={filterEcole} onValueChange={(v) => { setFilterEcole(v); setFilterClasse("all"); }}>
          <SelectTrigger><SelectValue placeholder="École" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les écoles</SelectItem>
            {ecoles.map((e) => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classesFilteredByEcole.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom} ({c.code})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPeriode} onValueChange={setFilterPeriode}>
          <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les périodes</SelectItem>
            {periodes.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      {/* Liste des séquences */}
      <section className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card-elevated p-8 text-center text-muted-foreground">
            Aucune séquence pour ces filtres.
          </div>
        ) : (
          filtered.map((s) => {
            const eff = computeStatus(s, week);
            const meta = STATUS_META[eff];
            return (
              <article key={s.id} className="card-elevated p-3 flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => quickAdvance.mutate(s)}
                  className={`shrink-0 h-10 w-10 rounded-full border flex items-center justify-center ${meta.className}`}
                  title="Avancer le statut"
                >
                  <meta.Icon className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono">#{s.ordre}</span>
                    <h3 className="font-medium truncate">{s.titre}</h3>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.classe?.nom} · {s.periode?.label ?? "Sans période"}
                    {s.semaine_prevue ? ` · S${s.semaine_prevue}` : ""}
                    {s.date_traitee ? ` · fait le ${new Date(s.date_traitee).toLocaleDateString("fr-FR")}` : ""}
                  </div>
                  {s.description && <p className="text-sm mt-1 text-muted-foreground line-clamp-2">{s.description}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setToDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Dialog CRUD */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? "Modifier la séquence" : "Nouvelle séquence"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Classe</Label>
                <Select value={f.classe_id} onValueChange={(v) => setF({ ...f, classe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom} ({c.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Période</Label>
                <Select value={f.periode_id || "none"} onValueChange={(v) => setF({ ...f, periode_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {periodes.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Titre</Label>
              <Input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label>Ordre</Label>
                <Input type="number" value={f.ordre} onChange={(e) => setF({ ...f, ordre: e.target.value })} />
              </div>
              <div>
                <Label>Semaine prévue</Label>
                <Input type="number" min={1} max={53} value={f.semaine_prevue} onChange={(e) => setF({ ...f, semaine_prevue: e.target.value })} />
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={f.statut} onValueChange={(v) => setF({ ...f, statut: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_venir">À venir</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="terminee">Terminée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Date de traitement</Label>
              <Input type="date" value={f.date_traitee} onChange={(e) => setF({ ...f, date_traitee: e.target.value })} />
            </div>
            <div>
              <Label>Notes libres</Label>
              <Textarea rows={2} value={f.notes_libres} onChange={(e) => setF({ ...f, notes_libres: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{edit ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette séquence ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
