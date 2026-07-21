import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Retourne la date à laquelle l'utilisateur a terminé le tour (ou null). */
export const getTourStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profils_enseignant")
      .select("tour_completed_at")
      .eq("user_id", userId)
      .maybeSingle();
    return { completedAt: (data as { tour_completed_at?: string | null } | null)?.tour_completed_at ?? null };
  });

export const markTourCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profils_enseignant")
      .update({ tour_completed_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { ok: true };
  });
