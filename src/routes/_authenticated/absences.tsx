import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarX,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  absencesQO,
  classesQO,
  elevesQO,
  requireUserId,
  type Absence,
} from "@/lib/queries/data";
import { enqueueWrite } from "@/lib/offline-queue";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/absences")({
  head: () => ({ meta: [{ title: "Absences — MonRegistre" }] }),
  component: AbsencesPage,
});

type AbsenceRow = Absence & {
  eleve: { nom: string; prenom: string; classe_id: string } | null;
};

function AbsencesPage() {
  const { data: classes = [] } = useQuery(classesQO());
  const [classeFilter, setClasseFilter] = useState<string>("all");
  const { data: absences = [], isLoading } = useQuery(
    absencesQO({ classeId: classeFilter === "all" ? undefined : classeFilter }),
  );

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AbsenceRow | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AbsenceRow | null>(null);

  const filtered = useMemo(
    () =>
      absences.filter((a) => {
        const s = `${a.eleve?.prenom ?? ""} ${a.eleve?.nom ?? ""} ${a.motif ?? ""}`.toLowerCase();
        return s.includes(q.toLowerCase());
      }),
    [absences, q],
  );

  const classeById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, c])),
    [classes],
  );

  const canAdd = classes.length > 0;

  return (
    <div className="px-5 pb-24 pt-5">
      <header className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Assiduité
        </div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
            Absences
          </h1>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
            {absences.length}
          </span>
        </div>
      </header>

      <div className="mb-3 space-y-2">
        <Select value={classeFilter} onValueChange={setClasseFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrer par classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="pl-9"
          />
        </div>
      </div>

      {!canAdd ? (
        <div className="card-elevated p-6 text-center text-sm text-muted-foreground">
          Créez d'abord une classe et un élève pour enregistrer des absences.
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="card-elevated flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/15 text-ink">
            <CalendarX className="h-6 w-6" />
          </span>
          <div>
            <div className="font-display text-lg font-semibold">Aucune absence</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Enregistrez la première absence.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const cls = a.eleve ? classeById[a.eleve.classe_id] : null;
            return (
              <li key={a.id} className="card-elevated p-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                      a.justifiee
                        ? "bg-teal/15 text-teal"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {a.justifiee ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold text-foreground">
                      {a.eleve ? `${a.eleve.prenom} ${a.eleve.nom}` : "Élève ?"}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {new Date(a.date).toLocaleDateString("fr-FR")}
                      {cls ? ` · ${cls.nom}` : ""}
                      {a.motif ? ` · ${a.motif}` : ""}
                      {a.justifiee ? " · justifiée" : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditing(a);
                      setOpen(true);
                    }}
                    aria-label="Modifier"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setToDelete(a)}
                    aria-label="Supprimer"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
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
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          aria-label="Ajouter"
          className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-teal text-teal-foreground shadow-[var(--shadow-hero)] transition-transform hover:scale-105 lg:bottom-8"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <AbsenceDialog
        open={open}
        onOpenChange={setOpen}
        absence={editing}
        classes={classes}
        defaultClasseId={classeFilter !== "all" ? classeFilter : undefined}
      />
      <DeleteAbsenceDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        absence={toDelete}
        onDone={() => setToDelete(null)}
      />
    </div>
  );
}

function AbsenceDialog({
  open,
  onOpenChange,
  absence,
  classes,
  defaultClasseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  absence: AbsenceRow | null;
  classes: Array<{ id: string; nom: string }>;
  defaultClasseId?: string;
}) {
  const qc = useQueryClient();
  const [classeId, setClasseId] = useState<string>("");
  const { data: eleves = [] } = useQuery({
    ...elevesQO(classeId || undefined),
    enabled: !!classeId,
  });

  const [form, setForm] = useState({
    eleve_id: "",
    date: new Date().toISOString().slice(0, 10),
    motif: "",
    justifiee: false,
  });

  useEffect(() => {
    if (open) {
      const initialClasseId =
        absence?.eleve?.classe_id ?? defaultClasseId ?? classes[0]?.id ?? "";
      setClasseId(initialClasseId);
      setForm({
        eleve_id: absence?.eleve_id ?? "",
        date: absence?.date ?? new Date().toISOString().slice(0, 10),
        motif: absence?.motif ?? "",
        justifiee: absence?.justifiee ?? false,
      });
    }
  }, [open, absence, defaultClasseId, classes]);

  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      if (!form.eleve_id) throw new Error("Sélectionnez un élève");
      if (!form.date) throw new Error("Date obligatoire");
      const payload = {
        eleve_id: form.eleve_id,
        date: form.date,
        motif: form.motif.trim() || null,
        justifiee: form.justifiee,
      };
      if (absence) {
        await enqueueWrite({
          table: "absences",
          op: "update",
          payload,
          match: { id: absence.id },
          label: "Modifier absence",
        });
      } else {
        await enqueueWrite({
          table: "absences",
          op: "insert",
          payload: { ...payload, id: crypto.randomUUID(), user_id },
          label: "Ajouter absence",
        });
      }
    },
    onSuccess: () => {
      toast.success(absence ? "Absence modifiée" : "Absence enregistrée");
      qc.invalidateQueries({ queryKey: ["absences"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display">
            {absence ? "Modifier l'absence" : "Nouvelle absence"}
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
            <Label>Classe *</Label>
            <Select
              value={classeId}
              onValueChange={(v) => {
                setClasseId(v);
                setForm((f) => ({ ...f, eleve_id: "" }));
              }}
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
          <div className="space-y-1.5">
            <Label>Élève *</Label>
            <Select
              value={form.eleve_id}
              onValueChange={(v) => setForm({ ...form, eleve_id: v })}
              disabled={!classeId}
            >
              <SelectTrigger>
                <SelectValue placeholder={classeId ? "Choisir" : "Choisissez une classe"} />
              </SelectTrigger>
              <SelectContent>
                {eleves.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.prenom} {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adate">Date *</Label>
            <Input
              id="adate"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amotif">Motif</Label>
            <Input
              id="amotif"
              value={form.motif}
              onChange={(e) => setForm({ ...form, motif: e.target.value })}
              placeholder="Maladie, familial…"
            />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-input bg-cream-deep/40 px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.justifiee}
              onChange={(e) => setForm({ ...form, justifiee: e.target.checked })}
              className="h-4 w-4 accent-teal"
            />
            <span className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
              Absence justifiée
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAbsenceDialog({
  open,
  onOpenChange,
  absence,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  absence: AbsenceRow | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!absence) return;
      await enqueueWrite({
        table: "absences",
        op: "delete",
        match: { id: absence.id },
        label: "Supprimer absence",
      });
    },
    onSuccess: () => {
      toast.success("Absence supprimée");
      qc.invalidateQueries({ queryKey: ["absences"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette absence ?</AlertDialogTitle>
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
