import { useEffect, useRef, useState } from "react";
import { isSyncing, pendingCount, subscribeOfflineQueue } from "@/lib/offline-queue";

export interface SyncProgress {
  /** true tant qu'un cycle de synchronisation est en cours */
  active: boolean;
  /** nombre d'écritures déjà traitées dans le cycle courant */
  done: number;
  /** nombre total d'écritures dans le cycle courant */
  total: number;
}

/**
 * Suit la progression d'un cycle de synchronisation :
 * lorsque `syncing` passe à true, on capture le total d'écritures en file ;
 * ensuite `done = total - pendingActuel` jusqu'à la fin du cycle.
 */
export function useSyncProgress(): SyncProgress {
  const [state, setState] = useState<SyncProgress>({ active: false, done: 0, total: 0 });
  const totalRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const pending = await pendingCount().catch(() => 0);
      const active = isSyncing();
      if (cancelled) return;
      if (active) {
        // Démarre / met à jour le total sur la borne haute observée pendant le cycle.
        totalRef.current = Math.max(totalRef.current, pending);
        const total = totalRef.current;
        const done = Math.max(0, total - pending);
        setState({ active: true, done, total });
      } else {
        totalRef.current = 0;
        setState({ active: false, done: 0, total: 0 });
      }
    };

    void tick();
    const unsub = subscribeOfflineQueue(() => {
      void tick();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return state;
}
