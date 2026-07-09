import { createFileRoute } from "@tanstack/react-router";
import { toFrench } from "@/lib/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { EcoleFilter, EcoleBadge, EcoleGroupHeader } from "@/components/app/ecole-filter";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  classesQO,
  ecolesQO,
  creneauxQO,
  requireUserId,
  type Creneau,
} from "@/lib/queries/data";
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

export const Route = createFileRoute("/_authenticated/emploi-du-temps")({
  head: () => ({ meta: [{ title: "Emploi du temps — MonRegistre" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(ecolesQO());
    void context.queryClient.prefetchQuery(classesQO());
    void context.queryClient.prefetchQuery(creneauxQO());
  },
  component: EmploiDuTempsPage,
});

const JOURS = [
  { v: 1, label: "Lundi", court: "Lun" },
  { v: 2, label: "Mardi", court: "Mar" },
  { v: 3, label: "Mercredi", court: "Mer" },
  { v: 4, label: "Jeudi", court: "Jeu" },
  { v: 5, label: "Vendredi", court: "Ven" },
  { v: 6, label: "Samedi", court: "Sam" },
  { v: 7, label: "Dimanche", court: "Dim" },
];

function EmploiDuTempsPage() {
  const qc = useQueryClient();
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: classes = [] } = useQuery(classesQO());
  const { data: creneaux = [] } = useQuery(creneauxQO());

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Creneau | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [ecoleFilter, setEcoleFilter] = useState<string>("all");
  const [ecoleId, setEcoleId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [jour, setJour] = useState("1");
  const [debut, setDebut] = useState("08:00");
  const [fin, setFin] = useState("09:00");
  const [matiere, setMatiere] = useState("");
  const [salle, setSalle] = useState("");

  const ecoleById = useMemo(
    () => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])),
    [ecoles],
  );

  const filteredCreneaux = useMemo(
    () =>
      ecoleFilter === "all"
        ? creneaux
        : creneaux.filter((c) => c.ecole_id === ecoleFilter),
    [creneaux, ecoleFilter],
  );

  function openCreate() {
    setEdit(null);
    setEcoleId(ecoleFilter !== "all" ? ecoleFilter : (ecoles[0]?.id ?? ""));
    setClasseId("");
    setJour("1");
    setDebut("08:00");
    setFin("09:00");
    setMatiere("");
    setSalle("");
    setOpen(true);
  }

  function openEdit(c: Creneau) {
    setEdit(c);
    setEcoleId(c.ecole_id);
    setClasseId(c.classe_id);
    setJour(String(c.jour_semaine));
    setDebut(c.heure_debut.slice(0, 5));
    setFin(c.heure_fin.slice(0, 5));
    setMatiere(c.matiere ?? "");
    setSalle(c.salle ?? "");
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!ecoleId || !classeId) throw new Error("École et classe requises");
      if (debut >= fin) throw new Error("L'heure de fin doit être après le début");
      const uid = await requireUserId();
      const payload = {
        user_id: uid,
        ecole_id: ecoleId,
        classe_id: classeId,
        jour_semaine: Number(jour),
        heure_debut: debut,
        heure_fin: fin,
        matiere: matiere.trim() || null,
        salle: salle.trim() || null,
      };
      if (edit) {
        const { error } = await supabase.from("creneaux").update(payload).eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("creneaux").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creneaux"] });
      toast.success(edit ? "Créneau modifié" : "Créneau ajouté");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("creneaux").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["creneaux"] });
      toast.success("Créneau supprimé");
      setToDelete(null);
    },
  });

  const classesForEcole = ecoleId
    ? classes.filter((c) => c.ecole_id === ecoleId)
    : classes;


  const groupedByEcole = useMemo(() => {
    if (ecoleFilter !== "all") return null;
    const map = new Map<string, typeof filteredCreneaux>();
    filteredCreneaux.forEach((c) => {
      const list = map.get(c.ecole_id) ?? [];
      list.push(c);
      map.set(c.ecole_id, list);
    });
    return Array.from(map.entries()).sort((a, b) =>
      (ecoleById[a[0]] ?? "").localeCompare(ecoleById[b[0]] ?? ""),
    );
  }, [filteredCreneaux, ecoleFilter, ecoleById]);

  type CreneauRow = (typeof creneaux)[number];

  const renderCreneauItem = (c: CreneauRow) => (
    <li key={c.id} className="p-3 flex items-start gap-3">
      <div className="shrink-0 w-16 text-center">
        <div className="text-sm font-semibold text-foreground">{c.heure_debut.slice(0, 5)}</div>
        <div className="text-[10px] text-foreground/50">↓</div>
        <div className="text-sm text-foreground/70">{c.heure_fin.slice(0, 5)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">
          {c.classe?.nom ?? "—"}
          {c.matiere && <span className="text-foreground/60 font-normal"> · {c.matiere}</span>}
        </p>
        <p className="text-xs text-foreground/60 truncate flex items-center gap-1.5 flex-wrap">
          <EcoleBadge name={c.ecole?.nom ?? ecoleById[c.ecole_id]} />
          {c.salle && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {c.salle}
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setToDelete(c.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );

  const renderByJour = (items: CreneauRow[]) => {
    const days = JOURS.map((j) => ({
      ...j,
      items: items.filter((c) => c.jour_semaine === j.v),
    })).filter((j) => j.items.length > 0);
    return (
      <div className="space-y-4">
        {days.map((j) => (
          <section key={j.v} className="card-elevated overflow-hidden">
            <div className="bg-ink text-ink-foreground px-4 py-2 font-serif text-sm tracking-wide">
              {j.label}
            </div>
            <ul className="divide-y divide-ink/10">{j.items.map(renderCreneauItem)}</ul>
          </section>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Emploi du temps</h1>
          <p className="text-sm text-foreground/60">Créneaux hebdomadaires par classe.</p>
        </div>
        <Button onClick={openCreate} className="bg-teal text-ink-foreground hover:bg-teal/90">
          <Plus className="h-4 w-4 mr-1.5" />
          Créneau
        </Button>
      </header>

      <EcoleFilter value={ecoleFilter} onValueChange={setEcoleFilter} ecoles={ecoles} />

      {!creneaux.length ? (
        <div className="card-elevated p-8 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-teal/60" />
          <p className="text-foreground/70">Aucun créneau. Ajoutes-en un pour construire ton emploi du temps.</p>
        </div>
      ) : !filteredCreneaux.length ? (
        <div className="card-elevated p-8 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-teal/60" />
          <p className="text-foreground/70">Aucun créneau pour cette école.</p>
        </div>
      ) : groupedByEcole ? (
        <div className="space-y-5">
          {groupedByEcole.map(([eid, list]) => (
            <section key={eid}>
              <EcoleGroupHeader name={ecoleById[eid]} count={list.length} />
              {renderByJour(list)}
            </section>
          ))}
        </div>
      ) : (
        renderByJour(filteredCreneaux)
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit ? "Modifier le créneau" : "Nouveau créneau"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>École</Label>
              <Select value={ecoleId} onValueChange={(v) => { setEcoleId(v); setClasseId(""); }}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {ecoles.map((e) => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select value={classeId} onValueChange={setClasseId} disabled={!classesForEcole.length}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {classesForEcole.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jour</Label>
              <Select value={jour} onValueChange={setJour}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOURS.map((j) => <SelectItem key={j.v} value={String(j.v)}>{j.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Matière (optionnel)</Label>
              <Input value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Mathématiques" />
            </div>
            <div className="space-y-1.5">
              <Label>Salle (optionnel)</Label>
              <Input value={salle} onChange={(e) => setSalle(e.target.value)} placeholder="B12" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-teal text-ink-foreground hover:bg-teal/90"
            >
              {save.isPending ? "..." : edit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && del.mutate(toDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

