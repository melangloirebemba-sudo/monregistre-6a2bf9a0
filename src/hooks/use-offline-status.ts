import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  pendingCount,
  isSyncing,
  subscribeOfflineQueue,
  wireOfflineAutoFlush,
} from "@/lib/offline-queue";

export interface OfflineStatus {
  online: boolean;
  syncing: boolean;
  pending: number;
}

export function useOfflineStatus(): OfflineStatus {
  const qc = useQueryClient();
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      setPending(await pendingCount());
      setSyncing(isSyncing());
    };
    void refresh();
    const unsub = subscribeOfflineQueue(() => {
      void refresh();
    });
    const teardown = wireOfflineAutoFlush(() => {
      // After a successful flush, refresh all queries so the UI reflects
      // server state.
      void qc.invalidateQueries();
    });

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      unsub();
      teardown();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [qc]);

  return { online, syncing, pending };
}
