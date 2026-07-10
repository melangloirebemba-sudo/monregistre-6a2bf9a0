import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, History, Trash2 } from "lucide-react";
import {
  readSyncHistory,
  clearSyncHistory,
  subscribeOfflineQueue,
  type SyncHistoryEntry,
} from "@/lib/offline-queue";

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Récapitulatif des dernières synchronisations effectuées.
 * Affiche pour chacune : date, done/total et nombre d'échecs.
 */
export function SyncHistoryCard({ className = "" }: { className?: string }) {
  const [entries, setEntries] = useState<SyncHistoryEntry[]>(() => readSyncHistory());
  const [, setTick] = useState(0);

  useEffect(() => {
    setEntries(readSyncHistory());
    const unsub = subscribeOfflineQueue(() => setEntries(readSyncHistory()));
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  if (entries.length === 0) return null;

  return (
    <section
      className={[
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        className,
      ].join(" ")}
      aria-label="Dernières synchronisations"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-teal">
          <History className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Dernières synchros
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Effacer l'historique des synchronisations ?")) {
              clearSyncHistory();
              setEntries([]);
            }
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-foreground/5"
          aria-label="Effacer l'historique"
        >
          <Trash2 className="h-3 w-3" />
          Effacer
        </button>
      </header>
      <ul className="space-y-1.5 text-xs">
        {entries.slice(0, 5).map((e) => {
          const ok = e.failed === 0;
          return (
            <li
              key={e.startedAt}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-foreground">
                  {ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className="font-medium">
                    {e.done}/{e.total} envoyée{e.total > 1 ? "s" : ""}
                  </span>
                  {e.failed > 0 && (
                    <span className="text-destructive">
                      · {e.failed} échec{e.failed > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatDate(e.startedAt)}
                </div>
              </div>
              <span
                className={[
                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                  ok
                    ? "border-teal/30 bg-teal/10 text-teal"
                    : "border-destructive/30 bg-destructive/10 text-destructive",
                ].join(" ")}
              >
                {ok ? "OK" : "Partiel"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
