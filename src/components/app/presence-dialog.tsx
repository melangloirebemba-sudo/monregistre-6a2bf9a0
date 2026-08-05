import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { toFrench } from "@/lib/errors";
import { requireUserId } from "@/lib/queries/data";
import { CYCLES, STATUTS, type Cycle, type SeanceStatut } from "@/lib/queries/remuneration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PresenceTarget {
  creneau_id: string | null;
  ecole_id: string;
  ecole_nom?: string | null;
  classe_id: string | null;
  classe_nom?: string | null;
  matiere: string | null;
  heure_debut: string;
  heure_fin: string;
}

export function PresenceDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: PresenceTarget | null;
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [statut, setStatut] = useState<SeanceStatut>("effectuee");
  const [cycle, setCycle] = useState<Cycle>("college");
  const [retard, setRetard] = useState("0");
  const [debut, setDebut] = useState("08:00");
  const [fin, setFin] = useState("09:00");
  const [motif, setMotif] = useState("");
  const [commentaire, setCommentaire] = useState("");

  useEffect(() => {
    if (!open || !target) return;
    setDate(new Date().toISOString().slice(0, 10));
    setStatut("effectuee");
    setRetard("0");
    setMotif("");
    setCommentaire("");
    setDebut(target.heure_debut.slice(0, 5));
    setFin(target.heure_fin.slice(0, 5));
  }, [open, target]);

  const save = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Créneau introuvable");
      if (debut >= fin) throw new Error("L'heure de fin doit être après le début");
      const uid = await requireUserId();
      const payload = {
        user_id: uid,
        ecole_id: target.ecole_id,
        classe_id: target.classe_id,
        creneau_id: target.creneau_id,
        date,
        heure_debut: debut,
        heure_fin: fin,
        matiere: target.matiere,
        cycle,
        statut,
        retard_minutes: Math.max(0, Number(retard) || 0),
        motif: motif.trim() || null,
        commentaire: commentaire.trim() || null,
        validee_le: new Date().toISOString(),
      };
      if (target.creneau_id) {
        const { data: existing } = await supabase
          .from("seances")
          .select("id")
          .eq("creneau_id", target.creneau_id)
          .eq("date", date)
          .maybeSingle();
        if (existing?.id) {
          const { error } = await supabase.from("seances").update(payload).eq("id", existing.id);
          if (error) throw error;
          return;
        }
      }
      const { error } = await supabase.from("seances").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seances"] });
      toast.success("Présence enregistrée");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const absent = statut !== "effectuee";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Valider ma présence</DialogTitle>
          <DialogDescription>
            {target?.classe_nom ?? "Cours"}
            {target?.matiere ? ` · ${target.matiere}` : ""}
            {target?.ecole_nom ? ` — ${target.ecole_nom}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Label>Statut du cours</Label>
            <Select value={statut} onValueChange={(v) => setStatut(v as SeanceStatut)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!absent && (
            <div className="space-y-1.5">
              <Label>Retard (minutes)</Label>
              <Input
                type="number"
                min={0}
                value={retard}
                onChange={(e) => setRetard(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Les minutes de retard sont déduites des heures payables.
              </p>
            </div>
          )}

          {absent && (
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Maladie, mission, cours annulé…"
              />
              <p className="text-xs text-muted-foreground">
                Une absence non justifiée retire l'intégralité des heures de ce cours.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Commentaire (optionnel)</Label>
            <Textarea
              rows={2}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Remarque sur la séance"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-teal text-ink-foreground hover:bg-teal/90"
          >
            {save.isPending ? "..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
