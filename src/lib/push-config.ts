// VAPID public key — PUBLIC by design (Web Push standard).
// The private counterpart is stored server-side (VAPID_PRIVATE_KEY secret).
export const VAPID_PUBLIC_KEY =
  "BKBdCyVA_iKnJWzgJo2FLB8_QbLtmA5tUqt49o_K85Aydfb1bhSJ_Ms1ijTyns842friCR-fOzw6KSmbYd2G4WE";

/** Convert a base64url-encoded VAPID key into the Uint8Array expected by PushManager.subscribe. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
