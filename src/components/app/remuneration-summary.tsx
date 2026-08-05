import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Wallet } from "lucide-react";
import { ecolesQO } from "@/lib/queries/data";
import {
  formatHeures,
  paiementsSalaireQO,
  seancesQO,
  syntheseParEcole,
  tarifsQO,
  labelMois,
} from "@/lib/queries/remuneration";
import { formatMontantXAF } from "@/lib/pdf/recu-paiement-shared";

export function RemunerationSummary() {
  const now = new Date();
  const debut = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const finDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fin = `${finDate.getFullYear()}-${String(finDate.getMonth() + 1).padStart(2, "0")}-${String(finDate.getDate()).padStart(2, "0")}`;

  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: tarifs = [] } = useQuery(tarifsQO());
  const { data: seances = [] } = useQuery(seancesQO(debut, fin));
  const { data: paiements = [] } = useQuery(paiementsSalaireQO());

  const synthese = useMemo(() => syntheseParEcole(seances, tarifs), [seances, tarifs]);
  const ecoleNom = useMemo(
    () => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])),
    [ecoles],
  );
  const totalMinutes = synthese.reduce((a, s) => a + s.minutesEffectuees, 0);
  const totalEstime = synthese.reduce((a, s) => a + s.montantEstime, 0);
  const derniers = paiements.slice(0, 3);

  return (
    <div className="card-elevated p-5 mb-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Wallet className="h-4 w-4" />
          Heures & rémunération
        </div>
        <Link to="/remuneration" className="flex items-center text-xs text-teal hover:underline">
          Détails <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Heures ce mois
          </div>
          <p className="mt-1 font-display text-xl font-semibold text-foreground">
            {formatHeures(totalMinutes)}
          </p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Salaire estimé
          </div>
          <p className="mt-1 font-display text-xl font-semibold text-foreground">
            {formatMontantXAF(Math.round(totalEstime))}
          </p>
        </div>
      </div>

      {synthese.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {synthese.map((s) => (
            <li key={s.ecole_id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">
                {ecoleNom[s.ecole_id] ?? "École"} · {formatHeures(s.minutesEffectuees)}
              </span>
              <span className="font-medium text-foreground">
                {formatMontantXAF(Math.round(s.montantEstime), s.devise)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {derniers.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            Derniers salaires reçus
          </div>
          <ul className="space-y-1.5">
            {derniers.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  {ecoleNom[p.ecole_id] ?? "École"} · {labelMois(p.mois)}
                </span>
                <span className="font-medium text-foreground">
                  {formatMontantXAF(p.montant, p.devise)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {synthese.length === 0 && derniers.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Valide ta présence depuis l'emploi du temps et définis tes tarifs horaires pour voir
          l'estimation de ton salaire.
        </p>
      )}
    </div>
  );
}
