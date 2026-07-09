import { useEffect, useState } from "react";
import { toFrench } from "@/lib/errors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profilQueryOptions } from "@/lib/queries/profil";
import { anneesScolairesQO, activerAnnee } from "@/lib/queries/annees";
import { requireUserId } from "@/lib/queries/data";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Affiché à la connexion tant que l'enseignant n'a pas choisi
 * (ou créé) une année scolaire active.
 */
export function AnneeScolaireGate() {
  const { data: profil, isLoading: profilLoading } = useQuery(profilQueryOptions());
  const { data: annees = [], isLoading: anneesLoading } = useQuery(anneesScolairesQO());
  const qc = useQueryClient();

  const noProfilYear = !profil?.annee_active || !profil.annee_active.trim();
  const hasActive = annees.some((a) => a.statut === "active");
  const needsChoice = !profilLoading && !anneesLoading && (noProfilYear || !hasActive);

  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(needsChoice), [needsChoice]);

  const suggested = (() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth(); // 0-11
    return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  })();

  const [newLib, setNewLib] = useState(suggested);

  const activate = useMutation({
    mutationFn: async (a: { id: string; libelle: string }) => {
      await activerAnnee(a.id, a.libelle);
    },
    onSuccess: () => {
      toast.success("Année scolaire activée");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const create = useMutation({
    mutationFn: async () => {
      const libelle = newLib.trim();
      if (!libelle) throw new Error("Libellé obligatoire");
      const user_id = await requireUserId();
      // Désactive les autres
      await supabase
        .from("annees_scolaires")
        .update({ statut: "archivee" })
        .eq("user_id", user_id)
        .eq("statut", "active");
      const { error } = await supabase
        .from("annees_scolaires")
        .insert({ user_id, libelle, statut: "active" });
      if (error) throw error;
      await supabase
        .from("profils_enseignant")
        .update({ annee_active: libelle })
        .eq("user_id", user_id);
    },
    onSuccess: () => {
      toast.success("Année scolaire créée");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const selectables = annees.filter((a) => a.statut !== "archivee");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Empêche la fermeture tant qu'aucune année active
        if (!v && needsChoice) return;
        setOpen(v);
      }}
    >
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-teal" />
            Choisir une année scolaire
          </DialogTitle>
          <DialogDescription>
            Toutes les données affichées (classes, périodes, notes) sont
            filtrées selon l'année scolaire active.
          </DialogDescription>
        </DialogHeader>

        {selectables.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Reprendre une année existante
            </Label>
            <ul className="space-y-1.5">
              {selectables.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => activate.mutate({ id: a.id, libelle: a.libelle })}
                    disabled={activate.isPending}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left hover:bg-cream-deep/40"
                  >
                    <span>
                      <span className="block text-sm font-medium">{a.libelle}</span>
                      <span className="block text-[10px] uppercase text-muted-foreground">
                        {a.statut === "active" ? "Active" : "À venir"}
                      </span>
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-teal" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-2 border-t border-border pt-3"
        >
          <Label htmlFor="new-annee" className="text-xs uppercase tracking-wide text-muted-foreground">
            Ou créer une nouvelle année
          </Label>
          <div className="flex gap-2">
            <Input
              id="new-annee"
              value={newLib}
              onChange={(e) => setNewLib(e.target.value)}
              placeholder="2025-2026"
            />
            <Button type="submit" disabled={create.isPending}>
              Activer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
