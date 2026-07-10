import { useEffect } from "react";
import { checkForLiveUpdate } from "@/lib/live-update";

/**
 * Vérifie et applique les mises à jour "live" (OTA) au démarrage de l'app
 * native, puis à chaque reprise depuis l'arrière-plan et à la reconnexion
 * réseau.
 *
 * Le bundle web est hébergé gratuitement sur une Release GitHub (publiée
 * automatiquement par la CI), pas sur un serveur Capgo dédié — voir
 * src/lib/live-update.ts pour le détail du mécanisme.
 *
 * Étapes :
 *  1. notifyAppReady() — confirme que le bundle courant est sain (désamorce
 *     le rollback automatique de Capgo).
 *  2. checkForLiveUpdate() — compare avec la dernière Release GitHub, et si
 *     une version plus récente existe, la télécharge et la programme pour
 *     la prochaine reprise de l'app (jamais d'interruption de la session
 *     en cours).
 *
 * Sur le web (ou si le plugin est indisponible), le composant ne fait rien.
 */
export function CapacitorLiveUpdater() {
  useEffect(() => {
    let cancelled = false;
    let removeResume: (() => void) | null = null;
    let removeNetworkListener: (() => void) | null = null;

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        if (cancelled) return;

        await CapacitorUpdater.notifyAppReady().catch(() => {});
        await checkForLiveUpdate();

        // Re-vérifie chaque fois que l'app revient au premier plan.
        try {
          const { App } = await import("@capacitor/app");
          const handle = await App.addListener("appStateChange", (state) => {
            if (state.isActive) void checkForLiveUpdate();
          });
          removeResume = () => {
            void handle.remove();
          };
        } catch {
          // @capacitor/app absent — pas de listener de reprise.
        }

        // Re-vérifie aussi dès que le réseau revient (utile après une longue
        // session hors ligne).
        try {
          const { Network } = await import("@capacitor/network");
          const netHandle = await Network.addListener("networkStatusChange", (s) => {
            if (s.connected) void checkForLiveUpdate();
          });
          removeNetworkListener = () => {
            void netHandle.remove();
          };
        } catch {
          // @capacitor/network absent.
        }
      } catch {
        // Silencieux sur le web.
      }
    })();

    return () => {
      cancelled = true;
      removeResume?.();
      removeNetworkListener?.();
    };
  }, []);

  return null;
}
