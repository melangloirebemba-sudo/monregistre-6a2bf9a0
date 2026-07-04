import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

// Détecte les nouveaux déploiements en comparant l'empreinte du HTML racine
// (scripts + feuilles de style avec noms hachés par Vite). Quand le contenu
// change entre deux polls, une notification propose de recharger.

const POLL_MS = 5 * 60 * 1000; // 5 min
const NOTIFIED_KEY = "monregistre.updateNotifiedFingerprint";

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com") ||
    host.endsWith(".beta.lovable.dev")
  );
}

async function fetchFingerprint(): Promise<string | null> {
  try {
    const res = await fetch("/", {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Extrait les URLs hachées des scripts et styles émis par Vite/TanStack.
    const matches = html.match(/(?:src|href)="\/[^"]*?\.[A-Za-z0-9_-]{6,}\.(?:js|css|mjs)"/g);
    if (!matches || matches.length === 0) return html.length.toString();
    return matches.sort().join("|");
  } catch {
    return null;
  }
}

export function AppUpdateNotifier() {
  const initial = useRef<string | null>(null);
  const notified = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewOrIframe()) return;
    if (!import.meta.env.PROD) return;

    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
      const fp = await fetchFingerprint();
      if (cancelled || !fp) return;
      if (initial.current === null) {
        initial.current = fp;
        return;
      }
      if (fp === initial.current) return;
      if (notified.current) return;
      // Évite de re-notifier plusieurs fois pour la même version.
      try {
        if (localStorage.getItem(NOTIFIED_KEY) === fp) {
          notified.current = true;
          return;
        }
        localStorage.setItem(NOTIFIED_KEY, fp);
      } catch {
        /* ignore */
      }
      notified.current = true;
      toast("Nouvelle version disponible", {
        description: "Rechargez la page pour bénéficier des dernières améliorations.",
        duration: Infinity,
        icon: <RefreshCw className="h-4 w-4" />,
        action: {
          label: "Recharger",
          onClick: () => window.location.reload(),
        },
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    timer = window.setInterval(() => void check(), POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
