import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "@/lib/demo";

export type Cycle = "primaire" | "college" | "lycee" | "universite";
export type SeanceStatut =
  | "effectuee"
  | "absence_justifiee"
  | "absence_non_justifiee"
  | "annulee";
export type SalaireStatut = "en_attente" | "paye" | "partiel";

export const CYCLES: { value: Cycle; label: string }[] = [
  { value: "primaire", label: "Primaire" },
  { value: "college", label: "Collège" },
  { value: "lycee", label: "Lycée" },
  { value: "universite", label: "Université" },
];

export const STATUTS: { value: SeanceStatut; label: string }[] = [
  { value: "effectuee", label: "Cours assuré" },
  { value: "absence_justifiee", label: "Absence justifiée" },
  { value: "absence_non_justifiee", label: "Absence non justifiée" },
  { value: "annulee", label: "Cours annulé" },
];

export interface TarifHoraire {
  id: string;
  user_id: string;
  ecole_id: string;
  cycle: Cycle;
  matiere: string | null;
  montant_horaire: number;
  devise: string;
  actif: boolean;
}

export interface Seance {
  id: string;
  user_id: string;
  ecole_id: string;
  classe_id: string | null;
  creneau_id: string | null;
  date: string;
  heure_debut: string;
  heure_fin: string;
  matiere: string | null;
  cycle: Cycle;
  statut: SeanceStatut;
  retard_minutes: number;
  duree_minutes: number;
  motif: string | null;
  commentaire: string | null;
  validee_le: string | null;
  approbation: SeanceApprobation;
  approbation_note: string | null;
  approuve_le: string | null;
  approuve_par: string | null;
}

export type SeanceApprobation = "non_requise" | "en_attente" | "approuvee" | "refusee";

export const APPROBATION_LABEL: Record<SeanceApprobation, string> = {
  non_requise: "Non requise",
  en_attente: "En attente",
  approuvee: "Approuvée",
  refusee: "Refusée",
};

export interface SeanceValidation {
  id: string;
  seance_id: string;
  user_id: string;
  action: string;
  note: string | null;
  statut_seance: SeanceStatut | null;
  retard_minutes: number;
  approbation: SeanceApprobation;
  created_at: string;
}

export interface PaiementSalaire {
  id: string;
  user_id: string;
  ecole_id: string;
  mois: string;
  montant: number;
  devise: string;
  heures_payees: number;
  statut: SalaireStatut;
  moyen_paiement: string | null;
  reference: string | null;
  note: string | null;
  paye_le: string;
}

const STALE = 60_000;

export function tarifsQO() {
  return queryOptions({
    queryKey: ["tarifs-horaires"],
    staleTime: STALE,
    queryFn: async (): Promise<TarifHoraire[]> => {
      if (isDemoMode()) return [];
      const { data, error } = await supabase
        .from("tarifs_horaires")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TarifHoraire[];
    },
  });
}

/** Séances sur une plage de dates (ISO yyyy-mm-dd). */
export function seancesQO(debut: string, fin: string) {
  return queryOptions({
    queryKey: ["seances", debut, fin],
    staleTime: STALE,
    queryFn: async (): Promise<Seance[]> => {
      if (isDemoMode()) return [];
      const { data, error } = await supabase
        .from("seances")
        .select("*")
        .gte("date", debut)
        .lte("date", fin)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Seance[];
    },
  });
}

/** Séances en attente d'approbation (retards, absences justifiées). */
export function seancesEnAttenteQO() {
  return queryOptions({
    queryKey: ["seances", "en-attente"],
    staleTime: STALE,
    queryFn: async (): Promise<Seance[]> => {
      if (isDemoMode()) return [];
      const { data, error } = await supabase
        .from("seances")
        .select("*")
        .eq("approbation", "en_attente")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Seance[];
    },
  });
}

/** Historique des validations (demandes, approbations, refus). */
export function validationsQO(seanceId?: string) {
  return queryOptions({
    queryKey: ["seance-validations", seanceId ?? "all"],
    staleTime: STALE,
    queryFn: async (): Promise<SeanceValidation[]> => {
      if (isDemoMode()) return [];
      let q = supabase
        .from("seance_validations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (seanceId) q = q.eq("seance_id", seanceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SeanceValidation[];
    },
  });
}

export function paiementsSalaireQO() {
  return queryOptions({
    queryKey: ["paiements-salaire"],
    staleTime: STALE,
    queryFn: async (): Promise<PaiementSalaire[]> => {
      if (isDemoMode()) return [];
      const { data, error } = await supabase
        .from("paiements_salaire")
        .select("*")
        .order("mois", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaiementSalaire[];
    },
  });
}

export interface SyntheseEcole {
  ecole_id: string;
  minutesEffectuees: number;
  minutesPerdues: number;
  montantEstime: number;
  montantPerdu: number;
  devise: string;
  seances: number;
}

function minutesBrutes(s: Seance): number {
  const [h1, m1] = s.heure_debut.split(":").map(Number);
  const [h2, m2] = s.heure_fin.split(":").map(Number);
  return Math.max(0, (h2 ?? 0) * 60 + (m2 ?? 0) - ((h1 ?? 0) * 60 + (m1 ?? 0)));
}

function tarifPour(tarifs: TarifHoraire[], s: Seance): TarifHoraire | null {
  const candidats = tarifs.filter(
    (t) => t.actif && t.ecole_id === s.ecole_id && t.cycle === s.cycle,
  );
  const exact = candidats.find(
    (t) => (t.matiere ?? "").toLowerCase() === (s.matiere ?? "").toLowerCase(),
  );
  return exact ?? candidats.find((t) => !t.matiere) ?? null;
}

/** Agrège les séances par école : heures payables, heures perdues et estimation. */
export function syntheseParEcole(
  seances: Seance[],
  tarifs: TarifHoraire[],
): SyntheseEcole[] {
  const map = new Map<string, SyntheseEcole>();
  for (const s of seances) {
    const cur =
      map.get(s.ecole_id) ??
      ({
        ecole_id: s.ecole_id,
        minutesEffectuees: 0,
        minutesPerdues: 0,
        montantEstime: 0,
        montantPerdu: 0,
        devise: "XAF",
        seances: 0,
      } satisfies SyntheseEcole);
    const brut = minutesBrutes(s);
    const payable = s.statut === "effectuee" ? Math.max(0, brut - (s.retard_minutes || 0)) : 0;
    const perdu = brut - payable;
    const t = tarifPour(tarifs, s);
    const taux = t?.montant_horaire ?? 0;
    cur.minutesEffectuees += payable;
    cur.minutesPerdues += perdu;
    cur.montantEstime += (payable / 60) * taux;
    cur.montantPerdu += (perdu / 60) * taux;
    cur.devise = t?.devise ?? cur.devise;
    cur.seances += 1;
    map.set(s.ecole_id, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.montantEstime - a.montantEstime);
}

export function formatHeures(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function moisISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function labelMois(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Nombre de créneaux du mois encore non validés (aucune séance saisie). */
export interface CreneauLite {
  id: string;
  jour_semaine: number;
  ecole_id: string;
  classe_id: string | null;
  heure_debut: string;
  heure_fin: string;
  matiere: string | null;
}

export interface CreneauNonValide {
  creneau: CreneauLite;
  date: string;
}

/**
 * Déroule les créneaux hebdomadaires sur la plage [debut, fin] (jusqu'à
 * aujourd'hui) et retourne les occurrences sans séance enregistrée.
 */
export function creneauxNonValides(
  creneaux: CreneauLite[],
  seances: Seance[],
  debut: string,
  fin: string,
): CreneauNonValide[] {
  const today = new Date().toISOString().slice(0, 10);
  const stop = fin < today ? fin : today;
  const seen = new Set(
    seances.filter((s) => s.creneau_id).map((s) => `${s.creneau_id}:${s.date}`),
  );
  const out: CreneauNonValide[] = [];
  const d = new Date(`${debut}T00:00:00`);
  const end = new Date(`${stop}T00:00:00`);
  while (d <= end) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const js = d.getDay();
    const weekday = js === 0 ? 7 : js;
    for (const c of creneaux) {
      if (c.jour_semaine !== weekday) continue;
      if (seen.has(`${c.id}:${iso}`)) continue;
      out.push({ creneau: c, date: iso });
    }
    d.setDate(d.getDate() + 1);
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
