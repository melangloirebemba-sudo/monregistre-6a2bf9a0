import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SyncStatusCard } from "@/components/app/sync-status-card";
import { PendingPdfsCard } from "@/components/app/pending-pdfs-card";

export const OPEN_SYNC_DIALOG_EVENT = "monregistre:open-sync-dialog";

export function openSyncDialog() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SYNC_DIALOG_EVENT));
}

/**
 * Modale globale de la file de synchronisation hors-ligne.
 * S'ouvre depuis n'importe quel badge en écoutant l'évènement window
 * `monregistre:open-sync-dialog`.
 */
export function SyncQueueDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_SYNC_DIALOG_EVENT, handler);
    return () => window.removeEventListener(OPEN_SYNC_DIALOG_EVENT, handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Écritures en attente</DialogTitle>
          <DialogDescription>
            Vos modifications réalisées hors ligne sont mises en file et envoyées
            automatiquement dès le retour de la connexion.
          </DialogDescription>
        </DialogHeader>
        <SyncStatusCard />
      </DialogContent>
    </Dialog>
  );
}
