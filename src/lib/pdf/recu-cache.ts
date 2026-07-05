import { useSyncExternalStore } from "react";
import {
  buildRecuPaiementPDFBlob,
  type RecuPaiementContext,
} from "./recu-paiement";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "recus";

export interface EnsureOptions {
  /** Existing storage path in the `recus` bucket, if any. */
  pdfPath?: string | null;
}


export type RecuPdfStatus =
  | "idle"
  | "pending"
  | "generating"
  | "ready"
  | "error";

export interface RecuPdfEntry {
  status: RecuPdfStatus;
  blob?: Blob;
  url?: string;
  filename?: string;
  error?: string;
  updatedAt: number;
}

const cache = new Map<string, RecuPdfEntry>();
const inflight = new Map<string, Promise<RecuPdfEntry>>();
const listeners = new Set<() => void>();

const DEFAULT: RecuPdfEntry = { status: "idle", updatedAt: 0 };

function emit() {
  listeners.forEach((l) => l());
}

function write(id: string, patch: Partial<RecuPdfEntry>) {
  const prev = cache.get(id) ?? DEFAULT;
  cache.set(id, { ...prev, ...patch, updatedAt: Date.now() });
  emit();
}

export function subscribeRecuCache(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getRecuEntry(id: string): RecuPdfEntry {
  return cache.get(id) ?? DEFAULT;
}

/**
 * Yield to the browser so the UI can paint before the CPU-heavy jsPDF pass.
 * Uses requestIdleCallback when available, otherwise a short timeout.
 */
function scheduleBackground(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }).requestIdleCallback;
    if (typeof ric === "function") {
      ric(() => resolve(), { timeout: 250 });
    } else {
      setTimeout(resolve, 30);
    }
  });
}

/**
 * Ensures the PDF for `id` is generated and cached. Concurrent calls share the
 * same in-flight promise. Returns immediately when a "ready" blob is cached.
 */
export function ensureRecuPDF(
  id: string,
  ctx: RecuPaiementContext,
): Promise<RecuPdfEntry> {
  const existing = cache.get(id);
  if (existing?.status === "ready" && existing.blob) {
    return Promise.resolve(existing);
  }
  const running = inflight.get(id);
  if (running) return running;

  write(id, { status: "pending", error: undefined });

  const task = (async () => {
    await scheduleBackground();
    write(id, { status: "generating" });
    try {
      // Yield one more frame so the "generating" state renders.
      await new Promise((r) => setTimeout(r, 0));
      const { blob, filename } = buildRecuPaiementPDFBlob(ctx);
      const prev = cache.get(id);
      if (prev?.url) URL.revokeObjectURL(prev.url);
      const url = URL.createObjectURL(blob);
      write(id, {
        status: "ready",
        blob,
        url,
        filename,
        error: undefined,
      });
      return cache.get(id) ?? DEFAULT;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de la génération";
      write(id, { status: "error", error: message });
      throw err;
    } finally {
      inflight.delete(id);
    }
  })();

  inflight.set(id, task);
  return task;
}

/** Trigger a browser download from the cached blob. Returns false if not ready. */
export function downloadCachedRecu(id: string): boolean {
  const entry = cache.get(id);
  if (!entry?.blob || !entry.filename) return false;
  const url = entry.url ?? URL.createObjectURL(entry.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = entry.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export function invalidateRecu(id: string) {
  const prev = cache.get(id);
  if (prev?.url) URL.revokeObjectURL(prev.url);
  cache.delete(id);
  inflight.delete(id);
  emit();
}

/** React hook that returns the live cache entry for a receipt id. */
export function useRecuEntry(id: string): RecuPdfEntry {
  return useSyncExternalStore(
    subscribeRecuCache,
    () => getRecuEntry(id),
    () => DEFAULT,
  );
}
