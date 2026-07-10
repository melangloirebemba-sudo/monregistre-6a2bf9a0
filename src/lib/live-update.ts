// Live update "auto-hébergé" gratuit : on n'utilise PAS le backend Capgo
// (qui demanderait de déployer sa propre infra Supabase + Cloudflare Workers).
// À la place, on héberge le bundle web sur une Release GitHub (créée
// automatiquement par la CI, voir .github/workflows/build-android-apk.yml)
// et c'est l'app elle-même qui va vérifier s'il existe une version plus
// récente, la télécharger, et l'appliquer via le plugin open-source
// @capgo/capacitor-updater (mode "manuel", documenté ici :
// https://capgo.app/docs/plugins/updater/self-hosted/manual-update/).

const GITHUB_REPO = "melangloirebemba-sudo/monregistre-6a2bf9a0";
const RELEASES_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const BUNDLE_ASSET_NAME = "monregistre-web-bundle.zip";

// Ne vérifie pas plus d'une fois toutes les 6h (au boot + à la reconnexion).
const CHECK_THROTTLE_MS = 6 * 60 * 60 * 1000;
const LAST_CHECK_KEY = "monregistre.liveUpdate.lastCheckAt";

interface GithubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

function shouldThrottle(): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(LAST_CHECK_KEY);
  if (!raw) return false;
  const last = Number(raw);
  return Number.isFinite(last) && Date.now() - last < CHECK_THROTTLE_MS;
}

function markChecked(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Vérifie s'il existe un bundle web plus récent que celui installé, le
 * télécharge et le programme pour la prochaine mise en arrière-plan de
 * l'app (sans jamais interrompre la session en cours).
 *
 * Silencieux en cas d'échec (pas de réseau, repo privé/renommé, etc.) — la
 * mise à jour live est une amélioration, jamais un blocage pour l'app.
 */
export async function checkForLiveUpdate(opts: { force?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return;
  if (!opts.force && shouldThrottle()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

    const res = await fetch(RELEASES_LATEST_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const release = (await res.json()) as GithubRelease;
    const remoteVersion = release.tag_name;
    const asset = release.assets?.find((a) => a.name === BUNDLE_ASSET_NAME);
    if (!remoteVersion || !asset) return;

    const { bundle: currentBundle } = await CapacitorUpdater.current();
    if (currentBundle?.version === remoteVersion) {
      markChecked();
      return;
    }

    // Évite de re-télécharger un bundle déjà présent localement (ex: déjà
    // téléchargé lors d'un précédent lancement mais pas encore appliqué).
    const { bundles } = await CapacitorUpdater.list();
    const alreadyDownloaded = bundles.find((b) => b.version === remoteVersion);

    const target =
      alreadyDownloaded ??
      (await CapacitorUpdater.download({
        url: asset.browser_download_url,
        version: remoteVersion,
      }));

    // Programme l'application au prochain retour en arrière-plan / relance —
    // ne coupe jamais la session en cours de l'enseignant.
    await CapacitorUpdater.next({ id: target.id });
    markChecked();
  } catch {
    // Réseau indisponible, repo inaccessible, plugin absent (web) — silencieux.
  }
}
