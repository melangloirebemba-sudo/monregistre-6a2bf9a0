// Cron endpoint: relays freshly inserted in-app notifications to Web Push,
// so every notification the app writes to `user_notifications` also reaches
// mobile as a push (paiement, réactivation compte, actions admin, etc.).
// Runs every few minutes, dedup'd via push_deliveries.
import { createFileRoute } from "@tanstack/react-router";

interface NotifRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  category: string | null;
  href: string | null;
  created_at: string;
}

export const Route = createFileRoute("/api/public/hooks/relay-inapp-notifications")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push.server");

        // Look 30 minutes back — the cron runs more often but this widens the
        // safety net in case of a hiccup. Dedup keeps every user_notification
        // relayed exactly once.
        const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data, error } = await supabaseAdmin
          .from("user_notifications")
          .select("id, user_id, title, body, category, href, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(500);

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let sent = 0;
        for (const n of (data ?? []) as NotifRow[]) {
          const cat = n.category ?? "app";
          const res = await sendPushToUser(
            n.user_id,
            {
              title: n.title,
              body: n.body ?? "",
              url: n.href ?? "/accueil",
              tag: cat,
              data: { kind: "inapp", notificationId: n.id, category: n.category },
            },
            { kind: "inapp_relay", key: n.id },
            { pushKind: cat },
          );
          if (res.sent > 0) sent++;
        }

        return Response.json({ ok: true, scanned: data?.length ?? 0, sent });
      },
    },
  },
});
