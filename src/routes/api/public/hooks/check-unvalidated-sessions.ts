// Cron endpoint : prévient chaque enseignant lorsque des créneaux du mois
// n'ont pas encore été validés (présence/absence) ou que des heures sont
// « à risque » (séances en attente d'approbation).
import { createFileRoute } from "@tanstack/react-router";

interface CreneauRow {
  id: string;
  user_id: string;
  jour_semaine: number;
}

interface SeanceRow {
  user_id: string;
  creneau_id: string | null;
  date: string;
  approbation: string | null;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const Route = createFileRoute("/api/public/hooks/check-unvalidated-sessions")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push.server");

        const now = new Date();
        const debut = new Date(now.getFullYear(), now.getMonth(), 1);
        // On s'arrête à hier : la journée en cours peut encore être validée.
        const fin = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        if (fin < debut) return Response.json({ ok: true, skipped: "début de mois" });

        const [{ data: cData, error: cErr }, { data: sData, error: sErr }] = await Promise.all([
          supabaseAdmin.from("creneaux").select("id, user_id, jour_semaine"),
          supabaseAdmin
            .from("seances")
            .select("user_id, creneau_id, date, approbation")
            .gte("date", isoDay(debut))
            .lte("date", isoDay(fin)),
        ]);
        if (cErr || sErr) {
          return Response.json({ ok: false, error: (cErr ?? sErr)!.message }, { status: 500 });
        }

        const creneaux = (cData ?? []) as CreneauRow[];
        const seances = (sData ?? []) as SeanceRow[];
        const done = new Set(
          seances.filter((s) => s.creneau_id).map((s) => `${s.creneau_id}:${s.date}`),
        );

        const manquants = new Map<string, number>();
        for (const c of creneaux) {
          const d = new Date(debut);
          while (d <= fin) {
            const js = d.getDay();
            const weekday = js === 0 ? 7 : js;
            if (c.jour_semaine === weekday && !done.has(`${c.id}:${isoDay(d)}`)) {
              manquants.set(c.user_id, (manquants.get(c.user_id) ?? 0) + 1);
            }
            d.setDate(d.getDate() + 1);
          }
        }

        const enAttente = new Map<string, number>();
        for (const s of seances) {
          if (s.approbation === "en_attente") {
            enAttente.set(s.user_id, (enAttente.get(s.user_id) ?? 0) + 1);
          }
        }

        const users = new Set([...manquants.keys(), ...enAttente.keys()]);
        let sent = 0;

        for (const userId of users) {
          const nb = manquants.get(userId) ?? 0;
          const risque = enAttente.get(userId) ?? 0;
          if (nb === 0 && risque === 0) continue;

          const title = nb > 0 ? `${nb} créneau(x) non validé(s)` : "Heures en attente d'approbation";
          const parts = [
            nb > 0
              ? `${nb} heure(s) de cours ne sont pas comptabilisées faute de validation.`
              : null,
            risque > 0 ? `${risque} séance(s) attendent une approbation.` : null,
          ].filter(Boolean);
          const body = parts.join(" ");

          await supabaseAdmin.from("user_notifications").insert({
            user_id: userId,
            title,
            body,
            category: "remuneration",
            href: "/remuneration",
          });

          const res = await sendPushToUser(
            userId,
            {
              title,
              body,
              url: "/remuneration",
              tag: "seances-non-validees",
              data: { kind: "seances_non_validees", nb, risque },
            },
            { kind: "seances_non_validees", key: `${isoDay(now)}-${nb}-${risque}` },
            { pushKind: "seances_non_validees" },
          );
          if (res.sent > 0) sent++;
        }

        return Response.json({ ok: true, users: users.size, sent });
      },
    },
  },
});
