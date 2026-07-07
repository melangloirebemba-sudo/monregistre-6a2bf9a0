// Client-side Web Push helpers.
// - Requests browser permission
// - Subscribes the current device to PushManager
// - Persists the endpoint on the server (push_subscriptions table)
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "./push-config";
import { registerPushSubscription, unregisterPushSubscription } from "./push.functions";

export type PushSupport = "unsupported" | "granted" | "denied" | "default";

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushSupport;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // The app registers /sw.js via register-sw.ts, but that only runs in prod.
  // For dev/preview we still allow enabling push by registering on demand.
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    console.warn("[push] SW register failed", e);
    return null;
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (getPushSupport() !== "granted") return false;
  const reg = await ensureRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return !!sub;
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const support = getPushSupport();
  if (support === "unsupported") return { ok: false, reason: "Notifications non supportées sur ce navigateur." };
  if (support === "denied") return { ok: false, reason: "Notifications bloquées. Autorisez-les dans les réglages du navigateur." };

  if (support !== "granted") {
    const res = await Notification.requestPermission();
    if (res !== "granted") return { ok: false, reason: "Permission refusée." };
  }

  const reg = await ensureRegistration();
  if (!reg) return { ok: false, reason: "Service worker indisponible." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Abonnement impossible.";
      return { ok: false, reason: msg };
    }
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "Abonnement invalide." };
  }
  try {
    await registerPushSubscription({
      data: {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent.slice(0, 500),
      },
    });
  } catch (e) {
    console.warn("[push] register failed", e);
    return { ok: false, reason: "Enregistrement serveur impossible." };
  }
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const reg = await ensureRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try {
      await unregisterPushSubscription({ data: { endpoint: sub.endpoint } });
    } catch (e) {
      console.warn("[push] unregister failed", e);
    }
    try {
      await sub.unsubscribe();
    } catch (e) {
      console.warn("[push] browser unsubscribe failed", e);
    }
  }
}
