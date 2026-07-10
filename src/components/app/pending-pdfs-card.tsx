import { useEffect, useState } from "react";
import { FileText, Share2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listPendingPdfs,
  deletePendingPdf,
  subscribePendingPdfs,
  type PendingPdf,
} from "@/lib/pdf/pending";
import { deliverPendingPdf } from "@/lib/pdf/save";
import { useOfflineStatus } from "@/hooks/use-offline-status";

export function PendingPdfsCard() {
  const [items, setItems] = useState<PendingPdf[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const { online } = useOfflineStatus();

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      listPendingPdfs().then((r) => {
        if (alive) setItems(r);
      });
    };
    refresh();
    const unsub = subscribePendingPdfs(refresh);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  if (!items.length) return null;

  async function handleShare(item: PendingPdf) {
    try {
      setBusy(item.id);
      await deliverPendingPdf(item);
      toast.success("PDF partagé");
    } catch (err) {
      toast.error("Impossible de partager", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(item: PendingPdf) {
    await deletePendingPdf(item.id);
    toast.success("PDF supprimé de la file");
  }

  return (
    <div className="rounded-md border bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          PDF en attente ({items.length})
        </p>
        {!online && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Hors ligne
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 text-sm border rounded px-2 py-1.5 bg-background"
          >
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="truncate">{it.label ?? it.filename}</p>
              <p className="text-[11px] text-muted-foreground truncate">{it.filename}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleShare(it)}
              disabled={busy === it.id}
            >
              {busy === it.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span className="ml-1 hidden sm:inline">Partager</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(it)}
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
