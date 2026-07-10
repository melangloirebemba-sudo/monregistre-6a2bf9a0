/**
 * Sauvegarde/partage un PDF en s'adaptant à la plateforme.
 * - Web : déclenche un téléchargement classique via une balise <a download>.
 * - Mobile natif (Capacitor) : écrit le fichier dans le dossier Documents
 *   de l'appareil puis ouvre la feuille de partage native. En cas d'échec,
 *   fallback web.
 */
export async function savePdfBlob(blob: Blob, filename: string): Promise<void> {
  const safeName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;

  // Détection Capacitor natif
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
        // L'utilisateur a annulé le partage — le fichier est déjà écrit
        // dans Documents et reste accessible.
      }
      return;
    } catch (err) {
      console.warn("[pdf] enregistrement natif impossible, fallback web", err);
      // fallback web ci-dessous
    }
  }

  // Fallback web : téléchargement classique
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read error"));
    reader.onload = () => {
      const result = reader.result as string;
      // result = "data:application/pdf;base64,XXXX"
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
