import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mirrorSelect, mirrorUpsert } from "@/lib/sqlite";
import { hasPendingForTable, enqueueWrite } from "@/lib/offline-queue";

export type StatutAnnee = "active" | "archivee" | "a_venir";

export interface AnneeScolaire {
  id: string;
  user_id: string;
  libelle: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: StatutAnnee;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

async function readMirror(): Promise<AnneeScolaire[]> {
  const rows = await mirrorSelect<AnneeScolaire>("annees_scolaires", {
    orderBy: "libelle",
    orderDir: "DESC",
  });
  return rows;
}

export const anneesScolairesQO = () =>
  queryOptions({
    queryKey: ["annees_scolaires"],
    staleTime: 30_000,
    queryFn: async (): Promise<AnneeScolaire[]> => {
      // Hors ligne : sert le miroir local plutôt que d'échouer — la liste
      // reste visible et les ajouts/modifs en attente y apparaissent déjà.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return readMirror();
      }
      try {
        const { data, error } = await supabase
          .from("annees_scolaires")
          .select("*")
          .order("libelle", { ascending: false });
        if (error) throw error;
        const rows = (data ?? []) as AnneeScolaire[];
        if (rows.length > 0) {
          try {
            await mirrorUpsert("annees_scolaires", rows as unknown as Record<string, unknown>[]);
          } catch {
            /* ignore */
          }
        }
        // Des écritures locales sont encore en attente : le serveur ne les
        // reflète pas encore, on sert le miroir pour ne rien perdre à l'écran.
        if (await hasPendingForTable("annees_scolaires")) {
          return readMirror();
        }
        return rows;
      } catch (err) {
        try {
          return await readMirror();
        } catch {
          throw err;
        }
      }
    },
  });

export async function activerAnnee(id: string, libelle: string) {
  const { data: sessionRes } = await supabase.auth.getSession();
  const uid = sessionRes.session?.user?.id;
  if (!uid) throw new Error("Session expirée");

  // Désactive les autres années actives (par id, pour un reflet correct du
  // miroir local hors ligne sur chaque ligne concernée).
  const current = await mirrorSelect<AnneeScolaire>("annees_scolaires", {
    where: { user_id: uid, statut: "active" },
  }).catch(() => [] as AnneeScolaire[]);
  for (const a of current) {
    if (a.id === id) continue;
    await enqueueWrite({
      table: "annees_scolaires",
      op: "update",
      payload: { statut: "archivee" },
      match: { id: a.id },
      label: `Archiver ${a.libelle}`,
    });
  }

  await enqueueWrite({
    table: "annees_scolaires",
    op: "update",
    payload: { statut: "active" },
    match: { id },
    label: "Activer l'année scolaire",
  });

  // Reflet sur le profil (table non mirrorée, mais mise en file quand même).
  await enqueueWrite({
    table: "profils_enseignant",
    op: "update",
    payload: { annee_active: libelle },
    match: { user_id: uid },
    label: "Mettre à jour l'année active du profil",
  });
}
