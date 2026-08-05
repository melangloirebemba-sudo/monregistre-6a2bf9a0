// Catalogues de référence (cycles, classes, matières) pour la saisie assistée.
// Ils servent de suggestions par défaut : l'utilisateur peut toujours créer
// ses propres valeurs, qui sont ensuite persistées en base (catalogue_entries).

export const CYCLES_DEFAUT = ["Primaire", "Collège", "Lycée", "Université"] as const;

export const CLASSES_PAR_CYCLE: Record<string, string[]> = {
  primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  college: ["6e", "5e", "4e", "3e"],
  lycee: ["Seconde", "Première", "Terminale"],
  universite: [
    "Licence 1 (L1)",
    "Licence 2 (L2)",
    "Licence 3 (L3)",
    "Master 1 (M1)",
    "Master 2 (M2)",
    "Doctorat 1 (D1)",
    "Doctorat 2 (D2)",
    "Doctorat 3 (D3)",
  ],
};

export const MATIERES_PAR_CYCLE: Record<string, string[]> = {
  primaire: [
    "Français",
    "Mathématiques",
    "Lecture",
    "Écriture",
    "Éducation civique",
    "Sciences",
    "Histoire",
    "Géographie",
    "EPS",
    "Arts plastiques",
    "Éducation musicale",
  ],
  college: [
    "Français",
    "Mathématiques",
    "Anglais",
    "Histoire",
    "Géographie",
    "Éducation civique et morale",
    "Sciences de la Vie et de la Terre (SVT)",
    "Physique-Chimie",
    "Technologie",
    "Informatique",
    "EPS",
    "Arts plastiques",
    "Éducation musicale",
  ],
  lycee: [
    "Français",
    "Philosophie",
    "Mathématiques",
    "Anglais",
    "Histoire",
    "Géographie",
    "Éducation civique et morale",
    "Physique",
    "Chimie",
    "SVT",
    "Informatique",
    "EPS",
    "Littérature",
    "Économie",
    "Comptabilité",
    "Gestion",
    "Droit",
  ],
  // Université : aucune liste fixe (dépend de la faculté / filière)
  universite: [],
};

/** Normalise un libellé de cycle pour retrouver ses suggestions. */
export function cycleKey(cycle: string | null | undefined): string {
  return (cycle ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function classesSuggerees(cycle: string | null | undefined): string[] {
  return CLASSES_PAR_CYCLE[cycleKey(cycle)] ?? [];
}

export function matieresSuggerees(cycle: string | null | undefined): string[] {
  return MATIERES_PAR_CYCLE[cycleKey(cycle)] ?? [];
}

/** Fusionne suggestions par défaut et valeurs personnalisées, sans doublon. */
export function fusionner(base: string[], perso: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of [...base, ...perso]) {
    const k = v.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v.trim());
  }
  return out;
}
