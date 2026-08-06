import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUserId } from "@/lib/queries/data";
import { cycleKey } from "@/lib/catalogues";

export type CatalogueType = "cycle" | "classe" | "matiere";

export interface CatalogueEntry {
  id: string;
  user_id: string;
  type: CatalogueType;
  cycle: string | null;
  valeur: string;
}

export interface CatalogueHistoryRow {
  id: string;
  action: string;
  type: string;
  cycle: string | null;
  ancienne_valeur: string | null;
  nouvelle_valeur: string | null;
  created_at: string;
}

/**
 * Normalisation utilisée pour la déduplication : accents, casse et espaces
 * multiples sont ignorés ("  6E  " ≡ "6e").
 */
export function normValeur(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Nettoyage d'une valeur avant enregistrement (espaces multiples réduits). */
export function cleanValeur(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

export const catalogueQO = () =>
  queryOptions({
    queryKey: ["catalogue"],
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<CatalogueEntry[]> => {
      const { data, error } = await supabase
        .from("catalogue_entries")
        .select("id, user_id, type, cycle, valeur")
        .order("valeur");
      if (error) throw error;
      return (data ?? []) as CatalogueEntry[];
    },
  });

export const catalogueHistoryQO = () =>
  queryOptions({
    queryKey: ["catalogue-history"],
    staleTime: 60_000,
    queryFn: async (): Promise<CatalogueHistoryRow[]> => {
      const { data, error } = await supabase
        .from("catalogue_history")
        .select("id, action, type, cycle, ancienne_valeur, nouvelle_valeur, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CatalogueHistoryRow[];
    },
  });

/** Valeurs personnalisées d'un type, filtrées par cycle quand il est fourni. */
export function entriesFor(
  entries: CatalogueEntry[],
  type: CatalogueType,
  cycle?: string | null,
): string[] {
  const key = cycleKey(cycle);
  return entries
    .filter((e) => e.type === type && (type === "cycle" || !key || cycleKey(e.cycle) === key))
    .map((e) => e.valeur);
}

/** Enregistre les nouvelles valeurs créées par l'utilisateur (idempotent). */
export function useSaveCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: Array<{ type: CatalogueType; valeur: string; cycle?: string | null }>,
    ) => {
      const clean = items
        .map((i) => ({ ...i, valeur: cleanValeur(i.valeur) }))
        .filter((i) => i.valeur.length > 0);
      if (clean.length === 0) return;
      let user_id: string;
      try {
        user_id = await requireUserId();
      } catch {
        return;
      }

      // Déduplication locale (casse / espaces) avant l'appel réseau.
      const seen = new Set<string>();
      const rows = clean
        .map((i) => ({
          user_id,
          type: i.type,
          valeur: i.valeur,
          cycle: i.type === "cycle" ? null : cleanValeur(i.cycle ?? "") || null,
        }))
        .filter((r) => {
          const k = `${r.type}|${normValeur(r.cycle)}|${normValeur(r.valeur)}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

      // Ignore ce qui existe déjà en base (comparaison normalisée).
      const { data: existing } = await supabase
        .from("catalogue_entries")
        .select("type, cycle, valeur");
      const known = new Set(
        (existing ?? []).map(
          (e) => `${e.type}|${normValeur(e.cycle)}|${normValeur(e.valeur)}`,
        ),
      );
      const toInsert = rows.filter(
        (r) => !known.has(`${r.type}|${normValeur(r.cycle)}|${normValeur(r.valeur)}`),
      );

      // L'index unique normalisé rejette les doublons résiduels : on ignore 23505.
      await Promise.all(
        toInsert.map(async (r) => {
          const { error } = await supabase.from("catalogue_entries").insert(r);
          if (error && error.code !== "23505") throw error;
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogue"] });
      qc.invalidateQueries({ queryKey: ["catalogue-history"] });
    },
  });
}

export function useUpdateCatalogueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; valeur: string; cycle?: string | null }) => {
      const valeur = cleanValeur(input.valeur);
      if (!valeur) throw new Error("La valeur ne peut pas être vide.");
      const { error } = await supabase
        .from("catalogue_entries")
        .update({
          valeur,
          ...(input.cycle !== undefined
            ? { cycle: cleanValeur(input.cycle ?? "") || null }
            : {}),
        })
        .eq("id", input.id);
      if (error) {
        if (error.code === "23505") throw new Error("Cette valeur existe déjà.");
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogue"] });
      qc.invalidateQueries({ queryKey: ["catalogue-history"] });
    },
  });
}

export function useDeleteCatalogueEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalogue_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogue"] });
      qc.invalidateQueries({ queryKey: ["catalogue-history"] });
    },
  });
}

export interface CatalogueExport {
  format: "monregistre-catalogues";
  version: 1;
  exported_at: string;
  entries: Array<{ type: CatalogueType; cycle: string | null; valeur: string }>;
}

export function buildCatalogueExport(entries: CatalogueEntry[]): CatalogueExport {
  return {
    format: "monregistre-catalogues",
    version: 1,
    exported_at: new Date().toISOString(),
    entries: entries.map((e) => ({ type: e.type, cycle: e.cycle, valeur: e.valeur })),
  };
}

export function parseCatalogueImport(raw: string): CatalogueExport["entries"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Fichier illisible : JSON invalide.");
  }
  const obj = parsed as Partial<CatalogueExport>;
  if (!obj || !Array.isArray(obj.entries)) {
    throw new Error("Fichier invalide : aucune entrée de catalogue trouvée.");
  }
  const types: CatalogueType[] = ["cycle", "classe", "matiere"];
  return obj.entries
    .filter(
      (e) =>
        e &&
        typeof e.valeur === "string" &&
        types.includes(e.type as CatalogueType),
    )
    .map((e) => ({
      type: e.type as CatalogueType,
      cycle: typeof e.cycle === "string" ? e.cycle : null,
      valeur: e.valeur,
    }));
}

// ---------------------------------------------------------------------------
// Stratégie d'import : détection des conflits
// ---------------------------------------------------------------------------

export type ImportStrategy = "fusionner" | "remplacer" | "ignorer";

export interface ImportItem {
  type: CatalogueType;
  cycle: string | null;
  valeur: string;
}

export interface ImportConflict {
  /** Entrée existante en base (même type/cycle/valeur normalisés). */
  existing: CatalogueEntry;
  /** Valeur telle qu'écrite dans le fichier importé. */
  incoming: ImportItem;
  /** true si l'orthographe diffère (casse, accents, espaces). */
  differentSpelling: boolean;
}

export interface ImportAnalysis {
  nouveaux: ImportItem[];
  conflits: ImportConflict[];
  total: number;
}

function keyOf(type: string, cycle: string | null, valeur: string) {
  return `${type}|${normValeur(cycle)}|${normValeur(valeur)}`;
}

/** Compare le fichier importé au catalogue existant. */
export function analyzeCatalogueImport(
  items: ImportItem[],
  existing: CatalogueEntry[],
): ImportAnalysis {
  const byKey = new Map<string, CatalogueEntry>();
  for (const e of existing) byKey.set(keyOf(e.type, e.cycle, e.valeur), e);

  const nouveaux: ImportItem[] = [];
  const conflits: ImportConflict[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const item: ImportItem = {
      type: raw.type,
      cycle: raw.type === "cycle" ? null : cleanValeur(raw.cycle ?? "") || null,
      valeur: cleanValeur(raw.valeur),
    };
    if (!item.valeur) continue;
    const k = keyOf(item.type, item.cycle, item.valeur);
    if (seen.has(k)) continue;
    seen.add(k);

    const match = byKey.get(k);
    if (match) {
      conflits.push({
        existing: match,
        incoming: item,
        differentSpelling: match.valeur !== item.valeur,
      });
    } else {
      nouveaux.push(item);
    }
  }

  return { nouveaux, conflits, total: nouveaux.length + conflits.length };
}

export interface ApplyImportResult {
  ajoutes: number;
  remplaces: number;
  ignores: number;
}

/**
 * Applique un import selon la stratégie choisie :
 * - fusionner : ajoute les nouveaux, conserve les valeurs existantes
 * - remplacer : ajoute les nouveaux et écrase l'orthographe des existantes
 * - ignorer   : n'ajoute que les nouveaux, sans toucher aux conflits
 * (fusionner et ignorer diffèrent seulement par le rapport affiché)
 */
export function useApplyCatalogueImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      analysis: ImportAnalysis;
      strategy: ImportStrategy;
    }): Promise<ApplyImportResult> => {
      const { analysis, strategy } = input;
      let user_id: string;
      try {
        user_id = await requireUserId();
      } catch {
        throw new Error("Session expirée : reconnectez-vous pour importer.");
      }

      let ajoutes = 0;
      for (const item of analysis.nouveaux) {
        const { error } = await supabase.from("catalogue_entries").insert({
          user_id,
          type: item.type,
          cycle: item.cycle,
          valeur: item.valeur,
        });
        if (error && error.code !== "23505") throw error;
        if (!error) ajoutes += 1;
      }

      let remplaces = 0;
      if (strategy === "remplacer") {
        for (const c of analysis.conflits) {
          if (!c.differentSpelling) continue;
          const { error } = await supabase
            .from("catalogue_entries")
            .update({ valeur: c.incoming.valeur })
            .eq("id", c.existing.id);
          if (error && error.code !== "23505") throw error;
          if (!error) remplaces += 1;
        }
      }

      return {
        ajoutes,
        remplaces,
        ignores: analysis.conflits.length - remplaces,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogue"] });
      qc.invalidateQueries({ queryKey: ["catalogue-history"] });
    },
  });
}
