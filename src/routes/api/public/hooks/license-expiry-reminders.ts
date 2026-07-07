// Cron endpoint: warns each teacher when their paid plan is about to expire.
// Milestones: J-14, J-7, J-3, J-1 (upcoming) and J+0 (expired within 24 h).
import { createFileRoute } from "@tanstack/react-router";

interface ProfilRow {
  user_id: string;
  plan: string;
  plan_expires_at: string | null;
  nom_affiche: string | null;
}

const MILESTONES = [14, 7, 3, 1, 0];

function daysUntil(expiresAtIso: string, now: Date): number | null {
  const t = Date.parse(expiresAtIso);
  if (!Number.isFinite(t)) return null;
  const diffMs = t - now.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

function messageFor(daysLeft: number): { title: string; body: string; requireInteraction?: boolean } {
  if (daysLeft <= 0) {
    return {
      title: "Votre licence a expiré",
      body: "Votre plan est retombé à Gratuit. Renouvelez pour retrouver tous vos accès.",
      requireInteraction: true,
    };
  }
  if (daysLeft === 1) {
    return {
      title: "Licence expire demain",
      body: "Renouvelez dès aujourd'hui pour éviter toute interruption.",
    };
  }
  return {
    title: `Licence expire dans ${daysLeft} jours`,
    body: "Pensez à renouveler votre plan pour continuer sans coupure.",
  };
}

export const Route = createFileRoute("/api/public/hooks/license-expiry-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push.server");

        const now = new Date();

        const { data, error } = await supabaseAdmin
          .from("profils_enseignant")
          .select("user_id, plan, plan_expires_at, nom_affiche")
          .neq("plan", "gratuit")
          .not("plan_expires_at", "is", null);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const rows = (data ?? []) as ProfilRow[];
        let sent = 0;
        let considered = 0;

        for (const row of rows) {
          if (!row.plan_expires_at) continue;
          const d = daysUntil(row.plan_expires_at, now);
          if (d === null) continue;
          if (!MILESTONES.includes(d)) continue;
          considered++;
          const msg = messageFor(d);
          const res = await sendPushToUser(
            row.user_id,
            {
              title: msg.title,
              body: msg.body,
              url: "/parametres",
              tag: "license-expiry",
              requireInteraction: !!msg.requireInteraction,
              data: { kind: "license_expiry", daysLeft: d },
            },
            { kind: "license_expiry", key: `${row.plan_expires_at.slice(0, 10)}-d${d}` },
            { pushKind: "license_expiry" },
          );
          if (res.sent > 0) sent++;
        }

        return Response.json({ ok: true, considered, sent });
      },
    },
  },
});
