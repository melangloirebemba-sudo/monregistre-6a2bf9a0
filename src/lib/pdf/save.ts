import { toast } from "sonner";
import { isEffectivelyOnline } from "@/lib/simulated-offline";
import { enqueuePendingPdf, deletePendingPdf, type PendingPdf } from "./pending";

/**
 * Sauvegarde/partage un PDF en s'adaptant à la plateforme et à l'état réseau.
 * - Hors ligne : le PDF est stocké dans IndexedDB (`pending_pdfs`) et pourra
 *   être partagé/téléchargé depuis la modale de synchronisation.
 * - En ligne, Web : téléchargement classique via <a download>.
 * - En ligne, Mobile natif (Capacitor) : écriture dans Documents puis feuille
 *   de partage native. Si l'écriture native échoue, fallback web.
 */
export async function savePdfBlob(blob: Blob, filename: string, label?: string): Promise<void> {
  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  if (!isEffectivelyOnline()) {
    await enqueuePendingPdf(blob, safeName, label);
    toast.success("PDF mis en file d'attente", {
      description: "Il sera partageable dès le retour de la connexion.",
    });
    return;
  }

  await deliverPdf(blob, safeName);
}

async function deliverPdf(blob: Blob, safeName: string): Promise<void> {
  let isNative = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
  } catch {
    isNative = false;
  }

  if (isNative) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share"),
      ]);
      const base64 = await blobToBase64(blob);
      const written = await Filesystem.writeFile({
        path: safeName,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      try {
        await Share.share({
          title: safeName,
          text: safeName,
          url: written.uri,
          dialogTitle: "Enregistrer ou partager le PDF",
        });
      } catch {
        // L'utilisateur a annulé le partage — le fichier reste dans Documents.
      }
      return;
    } catch (err) {
      console.warn("[pdf] enregistrement natif impossible, fallback web", err);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Rejoue un PDF mis en file d'attente (partage / téléchargement). */
export async function deliverPendingPdf(item: PendingPdf): Promise<void> {
  await deliverPdf(item.blob, item.filename);
  await deletePendingPdf(item.id);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read error"));
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
