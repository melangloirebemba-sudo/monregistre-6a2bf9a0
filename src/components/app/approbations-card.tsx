import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, History, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toFrench } from "@/lib/errors";
import { ecolesQO } from "@/lib/queries/data";
import { planCapabilitiesQO } from "@/lib/queries/profil";
import {
  APPROBATION_LABEL,
  STATUTS,
  seancesEnAttenteQO,
  validationsQO,
  type SeanceApprobation,
} from "@/lib/queries/remuneration";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const BADGE: Record<SeanceApprobation, string> = {
  non_requise: "bg-muted text-muted-foreground",
  en_attente: "bg-gold/20 text-foreground",
  approuvee: "bg-success/15 text-success",
  refusee: "bg-destructive/15 text-destructive",
};

export function ApprobationBadge({ statut }: { statut: SeanceApprobation }) {
  if (statut === "non_requise") return null;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[statut]}`}>
      {APPROBATION_LABEL[statut]}
    </span>
  );
}

/**
 * Circuit d'approbation des retards et absences justifiées.
 * - Enseignant : voit ses demandes en attente et l'historique des décisions.
 * - Administrateur : peut approuver ou refuser chaque demande.
 */
export function ApprobationsCard() {
  const qc = useQueryClient();
  const { data: caps } = useQuery(planCapabilitiesQO());
  const isAdmin = Boolean(caps?.isAdmin);
  const { data: enAttente = [] } = useQuery(seancesEnAttenteQO());
  const { data: historique = [] } = useQuery(validationsQO());
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);

  const ecoleNom = useMemo(
    () => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])),
    [ecoles],
  );
  const statutLabel = (v: string | null) =>
    STATUTS.find((s) => s.value === v)?.label ?? "—";

  const decider = useMutation({
    mutationFn: async (input: { id: string; approuver: boolean }) => {
      const { error } = await supabase.rpc("approuver_seance", {
        _seance_id: input.id,
        _approuver: input.approuver,
        _note: notes[input.id]?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["seances"] });
      qc.invalidateQueries({ queryKey: ["seance-validations"] });
      toast.success(v.approuver ? "Séance approuvée" : "Séance refusée");
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  return (
    <section className="card-elevated p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-teal" />
          Approbations {isAdmin ? "à traiter" : "de mes justificatifs"}
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowHistory((v) => !v)}>
          <History className="mr-1.5 h-4 w-4" />
          {showHistory ? "Masquer l'historique" : "Historique"}
        </Button>
      </div>

      {enAttente.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune demande en attente. Les retards et absences justifiées sont soumis à approbation.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {enAttente.map((s) => (
            <li key={s.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(s.date).toLocaleDateString("fr-FR")} ·{" "}
                    {ecoleNom[s.ecole_id] ?? "École"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statutLabel(s.statut)}
                    {s.retard_minutes > 0 ? ` · ${s.retard_minutes} min de retard` : ""}
                    {s.motif ? ` · ${s.motif}` : ""}
                  </p>
                </div>
                <ApprobationBadge statut="en_attente" />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Textarea
                    rows={2}
                    placeholder="Note de décision (optionnel)"
                    value={notes[s.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-teal text-ink-foreground hover:bg-teal/90"
                      disabled={decider.isPending}
                      onClick={() => decider.mutate({ id: s.id, approuver: true })}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decider.isPending}
                      onClick={() => decider.mutate({ id: s.id, approuver: false })}
                    >
                      <XCircle className="mr-1.5 h-4 w-4 text-destructive" />
                      Refuser
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showHistory && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Historique des validations</h3>
          {historique.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune validation enregistrée.</p>
          ) : (
            <ul className="divide-y divide-border">
              {historique.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {v.action === "demande"
                        ? "Demande soumise"
                        : v.action === "approbation"
                          ? "Approbation"
                          : "Refus"}
                      {v.note ? ` — ${v.note}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statutLabel(v.statut_seance)}
                      {v.retard_minutes > 0 ? ` · ${v.retard_minutes} min` : ""} ·{" "}
                      {new Date(v.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <ApprobationBadge statut={v.approbation} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
