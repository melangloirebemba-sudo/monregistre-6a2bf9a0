import { CloudOff, RefreshCw, Cloud } from "lucide-react";
import { useOfflineStatus } from "@/hooks/use-offline-status";
import { flushQueue } from "@/lib/offline-queue";

/**
 * Small floating badge that shows the connection + sync state.
 * - Hors ligne: badge rouge avec compteur d'écritures en attente
 * - Synchronisation en cours: badge ambre animé
 * - En ligne + rien en attente: caché
 * - En ligne + attente (échec transitoire): badge neutre avec bouton "Réessayer"
 */
export function OfflineIndicator() {
  const { online, syncing, pending } = useOfflineStatus();

  if (online && !syncing && pending === 0) return null;

  let label = "";
  let tone = "";
  let Icon = Cloud;

  if (!online) {
    label = pending > 0 ? `Hors ligne · ${pending} en attente` : "Hors ligne";
    tone = "bg-destructive text-destructive-foreground";
    Icon = CloudOff;
  } else if (syncing) {
    label = `Synchronisation…${pending > 0 ? ` (${pending})` : ""}`;
    tone = "bg-amber-500 text-white";
    Icon = RefreshCw;
  } else if (pending > 0) {
    label = `${pending} écriture(s) en attente`;
    tone = "bg-muted text-foreground border border-border";
    Icon = RefreshCw;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed bottom-24 left-1/2 z-40 -translate-x-1/2 lg:bottom-6 lg:left-6 lg:translate-x-0"
    >
      <div
        className={[
          "flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium shadow-lg",
          tone,
        ].join(" ")}
      >
        <Icon className={["h-4 w-4", syncing ? "animate-spin" : ""].join(" ")} />
        <span>{label}</span>
        {online && pending > 0 && !syncing && (
          <button
            type="button"
            onClick={() => void flushQueue()}
            className="ml-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] hover:bg-foreground/20"
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
