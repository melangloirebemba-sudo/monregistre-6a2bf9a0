import { useEffect } from "react";

/**
 * Vérifie et applique les mises à jour "live" (OTA) via Capgo au démarrage
 * de l'app native, puis à chaque reprise depuis l'arrière-plan.
 *
 * Étapes :
 *  1. notifyAppReady() — confirme que le bundle courant est sain (désamorce
 *     le rollback automatique de Capgo).
 *  2. getLatest() — interroge le serveur configuré pour connaître le dernier
 *     bundle disponible.
 *  3. Si un nouveau bundle est proposé, on le télécharge puis on l'active
 *     immédiatement via set() → la webview recharge automatiquement sur la
 *     nouvelle version.
 *
 * Sur le web (ou si le plugin est indisponible), le composant ne fait rien.
 */
export function CapacitorLiveUpdater() {
  useEffect(() => {
    let cancelled = false;
    let removeResume: (() => void) | null = null;

    const checkAndApply = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        if (cancelled) return;

        const latest = await CapacitorUpdater.getLatest().catch(() => null);
        if (!latest || cancelled) return;

        // Pas de nouvelle version disponible.
        // @ts-expect-error — champs runtime renvoyés par Capgo
        if (latest.error || !latest.version || !latest.url) return;

        // Évite de re-télécharger le bundle déjà actif.
        try {
          const current = await CapacitorUpdater.current();
          // @ts-expect-error
          if (current?.bundle?.version && current.bundle.version === latest.version) {
            return;
          }
        } catch {
          // ignore — on tente le téléchargement dans le doute
        }

        const bundle = await CapacitorUpdater.download({
          // @ts-expect-error
          version: latest.version,
          // @ts-expect-error
          url: latest.url,
        });
        if (cancelled || !bundle?.id) return;

        // Applique immédiatement : la webview recharge sur le nouveau bundle.
        await CapacitorUpdater.set({ id: bundle.id });
      } catch {
        // Plugin indisponible ou erreur réseau — silencieux.
      }
    };

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        if (cancelled) return;
        await CapacitorUpdater.notifyAppReady().catch(() => {});
        await checkAndApply();

        // Re-vérifie chaque fois que l'app revient au premier plan.
        try {
          const { App } = await import("@capacitor/app");
          const handle = await App.addListener("appStateChange", (state) => {
            if (state.isActive) void checkAndApply();
          });
          removeResume = () => {
            void handle.remove();
          };
        } catch {
          // @capacitor/app absent — pas de listener de reprise.
        }
      } catch {
        // Silencieux sur le web.
      }
    })();

    return () => {
      cancelled = true;
      removeResume?.();
    };
  }, []);

  return null;
}
