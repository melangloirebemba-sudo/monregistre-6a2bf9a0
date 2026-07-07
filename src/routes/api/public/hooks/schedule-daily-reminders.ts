// Cron endpoint: sends each teacher a summary push of tomorrow's schedule.
// Called nightly by pg_cron. Public route on the modern stack; the pg_cron
// call passes the Supabase anon key as `apikey`, and the handler still
// gates access via service_role reads.
import { createFileRoute } from "@tanstack/react-router";

interface CreneauRow {
  id: string;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  classe_id: string;
  matiere: string | null;
}

interface ClasseRow {
  id: string;
  nom: string;
  user_id: string;
  ecole_id: string;
}

// Map JS Date.getUTCDay (0=Sun) into local Congo weekday (UTC+1),
// then to the `creneaux.jour_semaine` domain (1=lundi..7=dimanche).
function tomorrowLocalWeekday(now: Date): { weekday: number; ymd: string } {
  // Local Congo = UTC + 1h
  const local = new Date(now.getTime() + 60 * 60 * 1000);
  const tomorrow = new Date(local);
  tomorrow.setUTCDate(local.getUTCDate() + 1);
  const jsDay = tomorrow.getUTCDay(); // 0=Sun..6=Sat
  const weekday = jsDay === 0 ? 7 : jsDay; // 1..7 (Mon..Sun)
  const ymd = tomorrow.toISOString().slice(0, 10);
  return { weekday, ymd };
}

export const Route = createFileRoute("/api/public/hooks/schedule-daily-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push.server");

        const now = new Date();
        const { weekday, ymd } = tomorrowLocalWeekday(now);

        // Fetch all creneaux for tomorrow's weekday.
        const { data: creneaux, error } = await supabaseAdmin
          .from("creneaux")
          .select("id, jour_semaine, heure_debut, heure_fin, classe_id, matiere")
          .eq("jour_semaine", weekday);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const list = (creneaux ?? []) as CreneauRow[];
        if (list.length === 0) {
          return Response.json({ ok: true, users: 0, sent: 0 });
        }

        const classeIds = Array.from(new Set(list.map((c) => c.classe_id)));
        const { data: classes } = await supabaseAdmin
          .from("classes")
          .select("id, nom, user_id, ecole_id")
          .in("id", classeIds);
        const classeById = new Map<string, ClasseRow>();
        for (const c of (classes ?? []) as ClasseRow[]) classeById.set(c.id, c);

        // Group creneaux by teacher.
        const byUser = new Map<string, CreneauRow[]>();
        for (const c of list) {
          const cls = classeById.get(c.classe_id);
          if (!cls) continue;
          const arr = byUser.get(cls.user_id) ?? [];
          arr.push(c);
          byUser.set(cls.user_id, arr);
        }

        let sent = 0;
        for (const [userId, items] of byUser) {
          items.sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
          const preview = items
            .slice(0, 3)
            .map((c) => {
              const cls = classeById.get(c.classe_id);
              return `${c.heure_debut.slice(0, 5)} ${cls?.nom ?? ""}${c.matiere ? ` · ${c.matiere}` : ""}`;
            })
            .join(" · ");
          const extra = items.length > 3 ? ` (+${items.length - 3})` : "";
          const body = `${items.length} cours demain — ${preview}${extra}`;
          const res = await sendPushToUser(
            userId,
            {
              title: "Programme de demain",
              body,
              url: "/emploi-du-temps",
              tag: "schedule-daily",
              data: { kind: "schedule_daily", ymd },
            },
            { kind: "schedule_daily", key: ymd },
          );
          if (res.sent > 0) sent++;
        }

        return Response.json({ ok: true, users: byUser.size, sent, weekday, ymd });
      },
    },
  },
});
