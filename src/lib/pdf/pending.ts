/**
 * File d'attente locale des PDF générés hors ligne.
 * Les PDF (bulletins, rapports, reçus) sont stockés en IndexedDB tant que
 * l'utilisateur n'a pas pu les partager/télécharger, puis rejoués depuis la
 * modale de synchronisation.
 */

const DB_NAME = "monregistre-pending-pdfs";
const STORE = "pdfs";
const DB_VERSION = 1;

export const PENDING_PDF_EVENT = "monregistre:pending-pdfs-change";

export interface PendingPdf {
  id: string;
  filename: string;
  blob: Blob;
  createdAt: number;
  label?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("open failed"));
  });
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PENDING_PDF_EVENT));
  }
}

export async function enqueuePendingPdf(blob: Blob, filename: string, label?: string): Promise<string> {
  const db = await openDb();
  const id = `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: PendingPdf = { id, filename, blob, createdAt: Date.now(), label };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notify();
  return id;
}

export async function listPendingPdfs(): Promise<PendingPdf[]> {
  try {
    const db = await openDb();
    const items = await new Promise<PendingPdf[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as PendingPdf[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function countPendingPdfs(): Promise<number> {
  return (await listPendingPdfs()).length;
}

export async function deletePendingPdf(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notify();
}

export async function clearPendingPdfs(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notify();
}

export function subscribePendingPdfs(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PENDING_PDF_EVENT, fn);
  return () => window.removeEventListener(PENDING_PDF_EVENT, fn);
}
