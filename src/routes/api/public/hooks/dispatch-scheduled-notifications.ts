// Cron endpoint: dispatches scheduled_notifications whose send_at has been
// reached. For each entry we materialize user_notifications rows for the
// target audience, mark the entry as `sent`, and let the relay cron push
// them to mobile subscribers.
import { createFileRoute } from "@tanstack/react-router";

interface ScheduledRow {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  href: string | null;
  target_type: string;
  target_value: string | null;
}

export const Route = createFileRoute("/api/public/hooks/dispatch-scheduled-notifications")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const nowIso = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from("scheduled_notifications")
          .select("id, title, body, category, href, target_type, target_value")
          .eq("status", "pending")
          .lte("send_at", nowIso)
          .order("send_at", { ascending: true })
          .limit(50);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const rows = (data ?? []) as ScheduledRow[];
        let dispatched = 0;
        let totalRecipients = 0;

        // Charge la liste des administrateurs une seule fois pour les exclure
        // des diffusions "all" et "plan" (les admins ne se reçoivent pas eux-mêmes).
        const { data: adminRows } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const adminIds = new Set(
          ((adminRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
        );

        for (const row of rows) {
          try {
            let userIds: string[] = [];
            if (row.target_type === "all") {
              const { data: users } = await supabaseAdmin
                .from("profils_enseignant")
                .select("user_id");
              userIds = (users ?? [])
                .map((u) => u.user_id as string)
                .filter((id) => !adminIds.has(id));
            } else if (row.target_type === "plan" && row.target_value) {
              const { data: users } = await supabaseAdmin
                .from("profils_enseignant")
                .select("user_id")
                .eq("plan", row.target_value as "gratuit" | "lite" | "premium");
              userIds = (users ?? [])
                .map((u) => u.user_id as string)
                .filter((id) => !adminIds.has(id));
            } else if (row.target_type === "user" && row.target_value) {
              userIds = [row.target_value];
            }

            if (userIds.length > 0) {
              const inserts = userIds.map((uid) => ({
                user_id: uid,
                title: row.title,
                body: row.body,
                category: row.category ?? "admin",
                href: row.href,
              }));
              for (let i = 0; i < inserts.length; i += 500) {
                const chunk = inserts.slice(i, i + 500);
                const { error: insErr } = await supabaseAdmin
                  .from("user_notifications")
                  .insert(chunk);
                if (insErr) throw new Error(insErr.message);
              }
            }

            await supabaseAdmin
              .from("scheduled_notifications")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                recipients_count: userIds.length,
              })
              .eq("id", row.id);

            dispatched++;
            totalRecipients += userIds.length;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await supabaseAdmin
              .from("scheduled_notifications")
              .update({ status: "failed", error: msg })
              .eq("id", row.id);
          }
        }

        return Response.json({
          ok: true,
          scanned: rows.length,
          dispatched,
          recipients: totalRecipients,
        });
      },
    },
  },
});
