import { useEffect, useRef, useState } from "react";
import {
  getFlushProgress,
  isSyncing,
  pendingCount,
  subscribeOfflineQueue,
  type QueueOp,
} from "@/lib/offline-queue";

export interface SyncProgress {
  /** true tant qu'un cycle de synchronisation est en cours */
  active: boolean;
  /** nombre d'écritures déjà traitées dans le cycle courant */
  done: number;
  /** nombre total d'écritures dans le cycle courant */
  total: number;
  /** nombre d'échecs (non-réseau) rencontrés dans le cycle */
  failed: number;
  /** table de l'écriture en cours */
  currentTable?: string;
  /** opération en cours */
  currentOp?: QueueOp;
  /** libellé de l'écriture en cours */
  currentLabel?: string;
  /** dernière erreur rencontrée dans le cycle */
  lastError?: string;
  lastErrorTable?: string;
}

const EMPTY: SyncProgress = { active: false, done: 0, total: 0, failed: 0 };

/**
 * Suit la progression d'un cycle de synchronisation en s'appuyant sur
 * l'état exposé par `offline-queue` (compteur, étape en cours, dernière
 * erreur). Retourne les infos les plus récentes vues pendant le cycle.
 */
export function useSyncProgress(): SyncProgress {
  const [state, setState] = useState<SyncProgress>(EMPTY);
  const totalRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const fp = getFlushProgress();
      const pending = await pendingCount().catch(() => 0);
      const active = isSyncing() || fp.active;
      if (cancelled) return;
      if (active) {
        // borne haute observée pour bien afficher la progression même si
        // de nouvelles écritures s'ajoutent en cours de route.
        totalRef.current = Math.max(totalRef.current, fp.total, pending + fp.done);
        const total = totalRef.current;
        const done = Math.max(0, Math.min(total, fp.done));
        setState({
          active: true,
          done,
          total,
          failed: fp.failed,
          currentTable: fp.currentTable,
          currentOp: fp.currentOp,
          currentLabel: fp.currentLabel,
          lastError: fp.lastError,
          lastErrorTable: fp.lastErrorTable,
        });
      } else {
        totalRef.current = 0;
        setState(EMPTY);
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
