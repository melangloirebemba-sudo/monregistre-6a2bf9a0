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
    mutationFn: async (items: Array<{ type: CatalogueType; valeur: string; cycle?: string | null }>) => {
      const clean = items
        .map((i) => ({ ...i, valeur: i.valeur.trim() }))
        .filter((i) => i.valeur.length > 0);
      if (clean.length === 0) return;
      let user_id: string;
      try {
        user_id = await requireUserId();
      } catch {
        return;
      }
      const rows = clean.map((i) => ({
        user_id,
        type: i.type,
        valeur: i.valeur,
        cycle: i.type === "cycle" ? null : (i.cycle?.trim() || null),
      }));
      // Doublons ignorés grâce à l'index unique (user, type, cycle, valeur).
      await supabase.from("catalogue_entries").upsert(rows, {
        onConflict: "user_id,type,cycle,valeur",
        ignoreDuplicates: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogue"] });
    },
  });
}
