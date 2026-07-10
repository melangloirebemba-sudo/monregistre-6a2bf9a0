import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, CheckCircle2, Wifi, AlertTriangle, Trash2 } from "lucide-react";
import { useOfflineStatus } from "@/hooks/use-offline-status";
import {
  flushQueue,
  listQueue,
  clearQueue,
  subscribeOfflineQueue,
  type QueuedWrite,
} from "@/lib/offline-queue";

const LAST_SYNC_KEY = "monregistre.lastSyncAt";

function readLastSync(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const TABLE_LABELS: Record<string, string> = {
  ecoles: "École",
  classes: "Classe",
  eleves: "Élève",
  notes: "Note",
  absences: "Absence",
  periodes: "Période",
  creneaux: "Créneau",
  sequences_programme: "Séquence",
  annees_scolaires: "Année scolaire",
};

function entityLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

/**
 * Carte détaillée du statut de synchronisation hors-ligne.
 * Affiche: état réseau, file en attente, dernière synchro, erreurs éventuelles.
 */
export function SyncStatusCard({ className = "" }: { className?: string }) {
  const { online, syncing, pending } = useOfflineStatus();
  const [items, setItems] = useState<QueuedWrite[]>([]);
  const [lastSync, setLastSync] = useState<number | null>(() => readLastSync());
  const [, setTick] = useState(0);
  const prevBusy = useRef(false);

  // Refresh the queue snapshot on every queue change.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const list = await listQueue().catch(() => []);
      if (!cancelled) setItems(list);
    };
    void refresh();
    const unsub = subscribeOfflineQueue(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Tick every 30s to refresh the "il y a X" label.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Detect end of a flush → store last sync time.
  useEffect(() => {
    const busy = syncing || pending > 0;
    if (prevBusy.current && !busy && online) {
      const now = Date.now();
      try {
        localStorage.setItem(LAST_SYNC_KEY, String(now));
      } catch {
        /* ignore */
      }
      setLastSync(now);
    }
    prevBusy.current = busy;
  }, [syncing, pending, online]);

  const errored = items.filter((i) => i.attempts > 0 && i.lastError);

  let state: "offline" | "syncing" | "pending" | "synced";
  if (!online) state = "offline";
  else if (syncing) state = "syncing";
  else if (pending > 0) state = "pending";
  else state = "synced";

  const badge = {
    offline: {
      Icon: CloudOff,
      label: "Hors ligne",
      tone: "bg-destructive/10 text-destructive border-destructive/30",
    },
    syncing: {
      Icon: RefreshCw,
      label: "Synchronisation…",
      tone: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
    },
    pending: {
      Icon: RefreshCw,
      label: "En attente",
      tone: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
    },
    synced: {
      Icon: CheckCircle2,
      label: "Synchronisé",
      tone: "bg-teal/10 text-teal border-teal/30",
    },
  }[state];

  const opLabel = (op: string) =>
    op === "insert" ? "Ajout" : op === "update" ? "Modif." : op === "delete" ? "Suppr." : op;

  return (
    <section
      className={[
        "rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3",
        className,
      ].join(" ")}
      aria-label="Statut de synchronisation"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              badge.tone,
            ].join(" ")}
          >
            <badge.Icon className={["h-3.5 w-3.5", syncing ? "animate-spin" : ""].join(" ")} />
            {badge.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Wifi className="h-3.5 w-3.5" />
            {online ? "En ligne" : "Déconnecté"}
          </span>
        </div>
        {(pending > 0 || errored.length > 0) && online && (
          <button
            type="button"
            onClick={() => void flushQueue()}
            className="rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium hover:bg-foreground/20"
          >
            Synchroniser
          </button>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">File d'attente</dt>
          <dd className="font-semibold">
            {pending} écriture{pending > 1 ? "s" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Dernière synchro</dt>
          <dd className="font-semibold">
            {lastSync ? formatRelative(lastSync) : "—"}
          </dd>
        </div>
      </dl>

      {errored.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {errored.length} erreur{errored.length > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Vider les écritures en erreur ? Elles seront perdues.")) {
                  void clearQueue();
                }
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
              Vider
            </button>
          </div>
          <ul className="space-y-1.5 text-xs">
            {errored.slice(0, 5).map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{opLabel(it.op)}</span>{" "}
                  · {it.label ?? it.table}
                  {it.lastError && (
                    <span className="block text-destructive/80 truncate max-w-[26ch]">
                      {it.lastError}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {it.attempts} essai{it.attempts > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
