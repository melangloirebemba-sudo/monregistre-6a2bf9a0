import { useEffect } from "react";

/**
 * Initialise les mises à jour "live" (OTA) via Capgo sur l'app native.
 * Ne fait rien sur le web (où c'est le service worker / AppUpdateNotifier
 * qui gère les mises à jour).
 *
 * Fonctionnement :
 *  - Au démarrage, on notifie Capgo que le bundle actuel s'est chargé sans
 *    planter (sinon Capgo revient automatiquement à la version précédente
 *    après quelques secondes — filet de sécurité anti mise-à-jour cassée).
 *  - Capgo vérifie en tâche de fond s'il existe un nouveau bundle JS/CSS sur
 *    le serveur configuré, le télécharge, et l'applique au prochain
 *    redémarrage de l'app (ou immédiatement selon la configuration choisie).
 */
export function CapacitorLiveUpdater() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        if (cancelled) return;
        // Confirme que le bundle actuel est sain (annule le rollback auto).
        await CapacitorUpdater.notifyAppReady();
        // Vérifie s'il existe une mise à jour disponible.
        await CapacitorUpdater.getLatest();
      } catch {
        // @capgo/capacitor-updater indisponible (web) — pas d'action nécessaire.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
