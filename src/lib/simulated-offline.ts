// Mode hors-ligne simulé, activable manuellement pour tester la file d'attente
// et le miroir IndexedDB sans réellement couper le réseau.
//
// Persisté dans localStorage pour survivre aux reloads. Un évènement window
// `monregistre:simulated-offline-change` est diffusé à chaque bascule.

const KEY = "monregistre.simulatedOffline";
export const SIMULATED_OFFLINE_EVENT = "monregistre:simulated-offline-change";

export function isSimulatedOffline(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSimulatedOffline(v: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SIMULATED_OFFLINE_EVENT, { detail: v }));
    // Simule les évènements navigateur natifs pour réveiller le reste du code.
    window.dispatchEvent(new Event(v ? "offline" : "online"));
  }
}

/** Retourne true si le réseau est réellement disponible ET le mode simulé n'est pas actif. */
export function isEffectivelyOnline(): boolean {
  if (isSimulatedOffline()) return false;
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function subscribeSimulatedOffline(fn: (v: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => fn(Boolean((e as CustomEvent).detail));
  window.addEventListener(SIMULATED_OFFLINE_EVENT, handler);
  return () => window.removeEventListener(SIMULATED_OFFLINE_EVENT, handler);
}
