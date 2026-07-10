import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  listQueue,
  subscribeOfflineQueue,
  isSyncing,
  type QueuedWrite,
} from "@/lib/offline-queue";

/**
 * Écoute la file d'attente hors ligne et affiche un toast lorsqu'une
 * synchronisation se termine :
 *  - succès : nombre d'écritures effectivement envoyées au serveur.
 *  - échec : nombre d'écritures restées en erreur.
 */
export function SyncToaster() {
  const prev = useRef<{ ids: Set<string>; syncing: boolean }>({
    ids: new Set(),
    syncing: false,
  });
  const initialized = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const snapshot = async (): Promise<QueuedWrite[]> => {
      try {
        return await listQueue();
      } catch {
        return [];
      }
    };

    const handle = async () => {
      const items = await snapshot();
      if (cancelled) return;
      const currentIds = new Set(items.map((i) => i.id));
      const currentSyncing = isSyncing();

      if (!initialized.current) {
        prev.current = { ids: currentIds, syncing: currentSyncing };
        initialized.current = true;
        return;
      }

      const wasSyncing = prev.current.syncing;
      // Fin d'un cycle de synchronisation
      if (wasSyncing && !currentSyncing) {
        // Écritures supprimées de la file (= envoyées avec succès).
        let synced = 0;
        for (const id of prev.current.ids) {
          if (!currentIds.has(id)) synced += 1;
        }
        // Écritures restées en erreur.
        const errored = items.filter((i) => i.attempts > 0 && i.lastError).length;
        if (synced > 0) {
          toast.success(
            synced === 1
              ? "Synchronisation terminée · 1 enregistrement envoyé"
              : `Synchronisation terminée · ${synced} enregistrements envoyés`,
          );
        }
        if (errored > 0) {
          toast.error(
            errored === 1
              ? "1 enregistrement n'a pas pu être synchronisé"
              : `${errored} enregistrements n'ont pas pu être synchronisés`,
          );
        }
      }

      prev.current = { ids: currentIds, syncing: currentSyncing };
    };

    void handle();
    const unsub = subscribeOfflineQueue(() => {
      void handle();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return null;
}
