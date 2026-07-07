import { useSyncExternalStore } from "react";
import { type RecuPaiementContext } from "./recu-paiement-shared";
import { supabase } from "@/integrations/supabase/client";

export type { RecuPaiementContext };


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

async function fetchStoredPdf(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  // Supabase-js returns a Blob in the browser.
  return data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: "application/pdf" });
}

async function uploadAndPersist(
  id: string,
  blob: Blob,
): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;
  const path = `${uid}/${id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });
  if (upErr) {
    console.warn("[recu-pdf] upload failed", upErr);
    return null;
  }
  const { error: dbErr } = await supabase
    .from("paiements")
    .update({ pdf_path: path })
    .eq("id", id);
  if (dbErr) console.warn("[recu-pdf] persist path failed", dbErr);
  return path;
}

/**
 * Ensures the PDF for `id` is generated and cached. Concurrent calls share the
 * same in-flight promise. Returns immediately when a "ready" blob is cached.
 *
 * Persistence: if `options.pdfPath` is provided, the blob is downloaded from
 * Supabase Storage (no regeneration). Otherwise the PDF is generated, uploaded
 * to `recus/<uid>/<id>.pdf`, and `paiements.pdf_path` is updated.
 */
export function ensureRecuPDF(
  id: string,
  ctx: RecuPaiementContext,
  options: EnsureOptions = {},
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
      let blob: Blob | null = null;

      // 1) Try the persisted copy first.
      if (options.pdfPath) {
        blob = await fetchStoredPdf(options.pdfPath);
      }

      // 2) Fallback: build the PDF locally, then push it to Storage.
      if (!blob) {
        await new Promise((r) => setTimeout(r, 0));
        // Import dynamique : jspdf (~200 Ko) n'est téléchargé qu'à la première génération.
        const { buildRecuPaiementPDFBlob } = await import("./recu-paiement");
        const built = buildRecuPaiementPDFBlob(ctx);
        blob = built.blob;
        // Persist in the background — don't block the download on it.
        void uploadAndPersist(id, blob);
      }
      if (!blob) throw new Error("Impossible de générer le reçu");

      const filename = `Recu_${ctx.numero_recu}.pdf`;
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
