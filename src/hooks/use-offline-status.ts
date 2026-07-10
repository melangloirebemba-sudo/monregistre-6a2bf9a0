import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  pendingCount,
  isSyncing,
  subscribeOfflineQueue,
  subscribeQueueMutation,
  wireOfflineAutoFlush,
} from "@/lib/offline-queue";
import { isSimulatedOffline, subscribeSimulatedOffline } from "@/lib/simulated-offline";


// Map une table Supabase vers la clé racine des queries associées.
const TABLE_TO_QUERY_KEY: Record<string, string> = {
  ecoles: "ecoles",
  classes: "classes",
  eleves: "eleves",
  periodes: "periodes",
  creneaux: "creneaux",
  sequences_programme: "sequences",
  notes: "notes",
  absences: "absences",
  annees_scolaires: "annees",
};

export interface OfflineStatus {
  online: boolean;
  syncing: boolean;
  pending: number;
}

export function useOfflineStatus(): OfflineStatus {
  const qc = useQueryClient();
  const [online, setOnline] = useState<boolean>(() => {
    if (isSimulatedOffline()) return false;
    return typeof navigator === "undefined" ? true : navigator.onLine;
  });

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
    // Dès qu'une écriture est mise en file hors ligne, on invalide la query
    // correspondante pour que la liste affichée reflète immédiatement le
    // miroir SQLite (qui contient déjà la ligne optimiste).
    const unsubMut = subscribeQueueMutation((table) => {
      const key = TABLE_TO_QUERY_KEY[table];
      if (!key) return;
      void qc.invalidateQueries({ queryKey: [key] });
    });
    const teardown = wireOfflineAutoFlush(() => {
      // After a successful flush, refresh all queries so the UI reflects
      // server state.
      void qc.invalidateQueries();
    });

    const onOnline = () => setOnline(!isSimulatedOffline());
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const unsubSim = subscribeSimulatedOffline((sim) => {
      if (sim) setOnline(false);
      else setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    });


    // Sur l'app native (Capacitor), les événements navigateur online/offline
    // sont parfois peu fiables dans la WebView Android — on s'appuie en plus
    // sur le plugin @capacitor/network quand il est disponible.
    let removeNetworkListener: (() => void) | undefined;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        setOnline(status.connected && !isSimulatedOffline());
        const listener = await Network.addListener("networkStatusChange", (s) => {
          setOnline(s.connected && !isSimulatedOffline());
        });

        removeNetworkListener = () => {
          void listener.remove();
        };
      } catch {
        // @capacitor/network non disponible (web) — on garde les events navigateur.
      }
    })();

    return () => {
      unsub();
      unsubMut();
      teardown();
      unsubSim();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      removeNetworkListener?.();
    };

  }, [qc]);

  return { online, syncing, pending };
}
