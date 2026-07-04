import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2, Wifi } from "lucide-react";
import { useOfflineStatus } from "@/hooks/use-offline-status";
import { flushQueue } from "@/lib/offline-queue";

/**
 * Bannière inline de synchronisation temps réel :
 * - Hors ligne (rouge) — avec compteur d'écritures en attente
 * - En attente (ambre) — écritures en file, prêtes à partir
 * - Synchronisation… (ambre animé)
 * - Réseau revenu (bleu, transitoire ~2s) après retour en ligne
 * - Synchronisé (vert, transitoire ~2.5s) après flush complet
 */
export function SyncStatusInline({ className = "" }: { className?: string }) {
  const { online, syncing, pending } = useOfflineStatus();
  const [justReconnected, setJustReconnected] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const prevOnline = useRef(online);
  const prevPending = useRef(pending);
  const prevSyncing = useRef(syncing);

  // Détection du retour du réseau
  useEffect(() => {
    if (!prevOnline.current && online) {
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 2000);
      prevOnline.current = online;
      return () => clearTimeout(t);
    }
    prevOnline.current = online;
  }, [online]);

  // Détection d'un flush terminé : passe de syncing→idle avec pending=0
  useEffect(() => {
    const wasBusy = prevSyncing.current || prevPending.current > 0;
    if (wasBusy && !syncing && pending === 0 && online) {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 2500);
      prevSyncing.current = syncing;
      prevPending.current = pending;
      return () => clearTimeout(t);
    }
    prevSyncing.current = syncing;
    prevPending.current = pending;
  }, [syncing, pending, online]);

  let label = "";
  let tone = "";
  let Icon = Wifi;
  let showRetry = false;

  if (!online) {
    label = pending > 0 ? `Hors ligne · ${pending} en attente` : "Hors ligne";
    tone = "bg-destructive/10 text-destructive border-destructive/30";
    Icon = CloudOff;
  } else if (syncing) {
    label = `Synchronisation…${pending > 0 ? ` (${pending})` : ""}`;
    tone = "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400";
    Icon = RefreshCw;
  } else if (pending > 0) {
    label = `${pending} écriture(s) en attente`;
    tone = "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400";
    Icon = RefreshCw;
    showRetry = true;
  } else if (justReconnected) {
    label = "Réseau revenu";
    tone = "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400";
    Icon = Wifi;
  } else if (justSynced) {
    label = "Synchronisé";
    tone = "bg-teal/10 text-teal border-teal/30";
    Icon = CheckCircle2;
  } else {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
        tone,
        className,
      ].join(" ")}
    >
      <Icon className={["h-3.5 w-3.5", syncing ? "animate-spin" : ""].join(" ")} />
      <span className="flex-1">{label}</span>
      {showRetry && (
        <button
          type="button"
          onClick={() => void flushQueue()}
          className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] hover:bg-foreground/20"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
