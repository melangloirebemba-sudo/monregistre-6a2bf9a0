import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Archive,
  Plus,
  Trash2,
  Star,
} from "lucide-react";
import { anneesScolairesQO, activerAnnee, type AnneeScolaire, type StatutAnnee } from "@/lib/queries/annees";
import { profilQueryOptions } from "@/lib/queries/profil";
import { requireUserId } from "@/lib/queries/data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/annees-scolaires")({
  head: () => ({ meta: [{ title: "Années scolaires — MonRegistre" }] }),
  component: AnneesPage,
});

const statutLabels: Record<StatutAnnee, string> = {
  active: "Active",
  archivee: "Archivée",
  a_venir: "À venir",
};

const statutStyles: Record<StatutAnnee, string> = {
  active: "bg-teal/15 text-teal",
  archivee: "bg-muted text-muted-foreground",
  a_venir: "bg-gold/15 text-ink",
};

function AnneesPage() {
  const { data: annees = [] } = useQuery(anneesScolairesQO());
  const { data: profil } = useQuery(profilQueryOptions());
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnneeScolaire | null>(null);

  const activate = useMutation({
    mutationFn: async (a: AnneeScolaire) => activerAnnee(a.id, a.libelle),
    onSuccess: () => {
      toast.success("Année activée");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (a: AnneeScolaire) => {
      const { error } = await supabase
        .from("annees_scolaires")
        .update({ statut: "archivee" })
        .eq("id", a.id);
      if (error) throw error;
      // Si c'était l'année active du profil, la vider
      if (profil?.annee_active === a.libelle) {
        const uid = await requireUserId();
        await supabase
          .from("profils_enseignant")
          .update({ annee_active: "" })
          .eq("user_id", uid);
      }
    },
    onSuccess: () => {
      toast.success("Année archivée");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (a: AnneeScolaire) => {
      const { error } = await supabase
        .from("annees_scolaires")
        .delete()
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Année supprimée");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 pb-24 pt-5">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Compte
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
            Années scolaires
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            L'année active filtre toutes les données de l'application.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Nouvelle
        </Button>
      </div>

      <ul className="space-y-2">
        {annees.map((a) => (
          <li
            key={a.id}
            className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal" />
                <span className="font-display text-base font-semibold text-foreground">
                  {a.libelle}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ${statutStyles[a.statut]}`}
                >
                  {statutLabels[a.statut]}
                </span>
              </div>
              {(a.date_debut || a.date_fin) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {a.date_debut ? new Date(a.date_debut).toLocaleDateString("fr-FR") : "…"}
                  {" → "}
                  {a.date_fin ? new Date(a.date_fin).toLocaleDateString("fr-FR") : "…"}
                </div>
              )}
              {a.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {a.statut !== "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => activate.mutate(a)}
                  disabled={activate.isPending}
                >
                  <Star className="mr-1 h-4 w-4" /> Activer
                </Button>
              )}
              {a.statut !== "archivee" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => archive.mutate(a)}
                  disabled={archive.isPending}
                >
                  <Archive className="mr-1 h-4 w-4" /> Archiver
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(a);
                  setOpen(true);
                }}
              >
                Modifier
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Supprimer"
                onClick={() => {
                  if (confirm(`Supprimer l'année ${a.libelle} ?`)) del.mutate(a);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </li>
        ))}
        {!annees.length && (
          <li className="card-elevated p-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-teal/60" />
            Aucune année scolaire. Créez la première.
          </li>
        )}
      </ul>

      <AnneeDialog open={open} onOpenChange={setOpen} annee={editing} />
    </div>
  );
}

function AnneeDialog({
  open,
  onOpenChange,
  annee,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  annee: AnneeScolaire | null;
}) {
  const qc = useQueryClient();
  const [libelle, setLibelle] = useState(annee?.libelle ?? "");
  const [dateDebut, setDateDebut] = useState(annee?.date_debut ?? "");
  const [dateFin, setDateFin] = useState(annee?.date_fin ?? "");
  const [statut, setStatut] = useState<StatutAnnee>(annee?.statut ?? "a_venir");
  const [notes, setNotes] = useState(annee?.notes ?? "");

  // reset when opened
  useState(() => {
    setLibelle(annee?.libelle ?? "");
    setDateDebut(annee?.date_debut ?? "");
    setDateFin(annee?.date_fin ?? "");
    setStatut(annee?.statut ?? "a_venir");
    setNotes(annee?.notes ?? "");
  });

  const save = useMutation({
    mutationFn: async () => {
      const lib = libelle.trim();
      if (!lib) throw new Error("Libellé obligatoire");
      const user_id = await requireUserId();
      const payload = {
        libelle: lib,
        date_debut: dateDebut || null,
        date_fin: dateFin || null,
        statut,
        notes: notes.trim() || null,
      };
      if (statut === "active") {
        await supabase
          .from("annees_scolaires")
          .update({ statut: "archivee" })
          .eq("user_id", user_id)
          .eq("statut", "active");
      }
      if (annee) {
        const { error } = await supabase
          .from("annees_scolaires")
          .update(payload)
          .eq("id", annee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("annees_scolaires")
          .insert({ ...payload, user_id });
        if (error) throw error;
      }
      if (statut === "active") {
        await supabase
          .from("profils_enseignant")
          .update({ annee_active: lib })
          .eq("user_id", user_id);
      }
    },
    onSuccess: () => {
      toast.success(annee ? "Année modifiée" : "Année créée");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{annee ? "Modifier l'année" : "Nouvelle année scolaire"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="libelle">Libellé</Label>
            <Input
              id="libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="2025-2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="dd">Début</Label>
              <Input id="dd" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="df">Fin</Label>
              <Input id="df" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="statut">Statut</Label>
            <select
              id="statut"
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutAnnee)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="a_venir">À venir</option>
              <option value="active">Active</option>
              <option value="archivee">Archivée</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
