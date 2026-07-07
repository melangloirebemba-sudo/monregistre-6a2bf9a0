// Server-only helpers to send Web Push notifications via the web-push library.
// Uses the service_role client (supabaseAdmin) to iterate over subscriptions
// and record deliveries. Never import this from a component or a loader.
import webpush from "web-push";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:support@monregistre.app";
  if (!pub || !priv) throw new Error("VAPID keys missing");
  webpush.setVapidDetails(subj, pub, priv);
  vapidReady = true;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a Web Push to every active subscription of `userId`.
 * If `dedupKey` is provided, the send is skipped when an entry already exists in push_deliveries.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  dedup?: { kind: string; key: string },
  options?: { pushKind?: string },
): Promise<{ sent: number; skipped: boolean; errors: number }> {
  ensureVapid();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Vérifie la préférence push utilisateur pour cette catégorie
  const pushKind = options?.pushKind;
  if (pushKind) {
    const { data: profil } = await supabaseAdmin
      .from("profils_enseignant")
      .select("notifications_prefs")
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = (profil?.notifications_prefs ?? null) as
      | { enabled?: boolean; push?: Record<string, boolean> }
      | null;
    if (prefs) {
      if (prefs.enabled === false) return { sent: 0, skipped: true, errors: 0 };
      if (prefs.push && prefs.push[pushKind] === false) {
        return { sent: 0, skipped: true, errors: 0 };
      }
    }
  }

  if (dedup) {
    const { data: existing } = await supabaseAdmin
      .from("push_deliveries")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", dedup.kind)
      .eq("key", dedup.key)
      .maybeSingle();
    if (existing) return { sent: 0, skipped: true, errors: 0 };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .is("disabled_at", null);

  const list = (subs ?? []) as SubRow[];
  if (list.length === 0) {
    if (dedup) {
      await supabaseAdmin.from("push_deliveries").insert({
        user_id: userId,
        kind: dedup.kind,
        key: dedup.key,
        ok: false,
        error: "no active subscription",
      });
    }
    return { sent: 0, skipped: false, errors: 0 };
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let errors = 0;

  await Promise.all(
    list.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 24 * 60 * 60 },
        );
        sent++;
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", s.id);
      } catch (e: unknown) {
        errors++;
        const status = (e as { statusCode?: number }).statusCode ?? 0;
        if (status === 404 || status === 410) {
          // Endpoint is gone — mark subscription as disabled.
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ disabled_at: new Date().toISOString() })
            .eq("id", s.id);
        } else {
          console.warn("[push] send error", status, (e as Error).message);
        }
      }
    }),
  );

  if (dedup) {
    await supabaseAdmin.from("push_deliveries").insert({
      user_id: userId,
      kind: dedup.kind,
      key: dedup.key,
      ok: sent > 0,
      error: errors > 0 && sent === 0 ? `all ${errors} sends failed` : null,
    });
  }

  return { sent, skipped: false, errors };
}
