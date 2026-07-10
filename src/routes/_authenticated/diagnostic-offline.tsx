import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listQueue,
  pendingCount,
  flushQueue,
  enqueueWrite,
  subscribeOfflineQueue,
  subscribeQueueMutation,
  type QueuedWrite,
} from "@/lib/offline-queue";
import { mirrorSelect } from "@/lib/sqlite";
import { SQLITE_TABLES, type SqliteTable } from "@/lib/sqlite/schema";
import { HardDrive, RefreshCw, Wifi, WifiOff, Database, CheckCircle2, XCircle, PlugZap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  isSimulatedOffline,
  setSimulatedOffline,
  subscribeSimulatedOffline,
} from "@/lib/simulated-offline";


export const Route = createFileRoute("/_authenticated/diagnostic-offline")({
  head: () => ({ meta: [{ title: "Diagnostic hors-ligne — MonRegistre" }] }),
  component: DiagnosticOfflinePage,
});

interface Diag {
  indexedDbAvailable: boolean;
  storageEstimate?: { usage?: number; quota?: number };
  online: boolean;
  queue: QueuedWrite[];
  pending: number;
  mirrorCounts: Record<string, number>;
}

async function collect(): Promise<Diag> {
  const indexedDbAvailable = typeof indexedDB !== "undefined";
  let storageEstimate: Diag["storageEstimate"];
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      storageEstimate = { usage: est.usage, quota: est.quota };
    }
  } catch {
    /* ignore */
  }
  const queue = await listQueue();
  const pending = await pendingCount();
  const mirrorCounts: Record<string, number> = {};
  for (const t of SQLITE_TABLES) {
    try {
      const rows = await mirrorSelect(t as SqliteTable);
      mirrorCounts[t] = rows.length;
    } catch {
      mirrorCounts[t] = -1;
    }
  }
  return {
    indexedDbAvailable,
    storageEstimate,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    queue,
    pending,
    mirrorCounts,
  };
}

function formatBytes(n?: number): string {
  if (!n) return "—";
  const units = ["B", "Ko", "Mo", "Go"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function DiagnosticOfflinePage() {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDiag(await collect());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const un1 = subscribeOfflineQueue(() => void refresh());
    const un2 = subscribeQueueMutation(() => void refresh());
    const on = () => void refresh();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      un1();
      un2();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, [refresh]);

  const runProbe = useCallback(async () => {
    try {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `probe-${Date.now()}`;
      await enqueueWrite({
        table: "ecoles",
        op: "insert",
        payload: {
          id,
          nom: `__diagnostic_probe_${new Date().toISOString()}`,
        },
        label: "Sonde diagnostic",
      });
      toast.success("Sonde enregistrée en IndexedDB");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la sonde");
    }
  }, [refresh]);

  return (
    <div className="px-5 pb-10 pt-5 space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Outil</div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Diagnostic hors-ligne</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vérifiez que vos écritures sont enregistrées en IndexedDB pendant une coupure réseau.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
        <Button size="sm" onClick={() => void runProbe()}>
          <HardDrive className="mr-1.5 h-4 w-4" />
          Écrire une sonde
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void flushQueue()} disabled={!diag?.online}>
          Rejouer la file
        </Button>
      </div>

      {diag ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Environnement</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <Row
                icon={<Database className="h-4 w-4" />}
                label="IndexedDB"
                value={
                  diag.indexedDbAvailable ? (
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Disponible
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" /> Indisponible
                    </Badge>
                  )
                }
              />
              <Row
                icon={diag.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                label="Réseau"
                value={
                  <Badge variant={diag.online ? "secondary" : "outline"}>
                    {diag.online ? "En ligne" : "Hors ligne"}
                  </Badge>
                }
              />
              <Row
                icon={<HardDrive className="h-4 w-4" />}
                label="Espace utilisé"
                value={
                  <span className="text-muted-foreground">
                    {formatBytes(diag.storageEstimate?.usage)} / {formatBytes(diag.storageEstimate?.quota)}
                  </span>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>File d'écritures en attente</span>
                <Badge variant={diag.pending > 0 ? "default" : "secondary"}>{diag.pending}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {diag.queue.length === 0 ? (
                <p className="text-muted-foreground">Aucune écriture en attente.</p>
              ) : (
                <ul className="divide-y">
                  {diag.queue.map((q) => (
                    <li key={q.id} className="py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {q.label ?? `${q.op} ${q.table}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {q.table} · {q.op} · {new Date(q.createdAt).toLocaleString("fr-FR")}
                        </div>
                        {q.lastError ? (
                          <div className="text-xs text-destructive mt-1 break-words">{q.lastError}</div>
                        ) : null}
                      </div>
                      <Badge variant={q.attempts > 0 ? "destructive" : "secondary"} className="shrink-0">
                        {q.attempts > 0 ? `${q.attempts} tentative(s)` : "En attente"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Miroir local (IndexedDB)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(diag.mirrorCounts).map(([t, n]) => (
                  <li key={t} className="flex items-center justify-between">
                    <span className="text-muted-foreground truncate">{t}</span>
                    <span className={n < 0 ? "text-destructive" : "font-medium"}>
                      {n < 0 ? "erreur" : n}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Astuce : coupez votre Wi-Fi/données, créez une école ou un élève, puis revenez ici — la file doit contenir
            l'écriture et le miroir doit avoir été mis à jour immédiatement.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div>{value}</div>
    </div>
  );
}
