import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const LAST_SHOWN_KEY = "monregistre.installPromptLastShownAt";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h

function wasShownRecently(): boolean {
  try {
    const raw = localStorage.getItem(LAST_SHOWN_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markShown() {
  try {
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return Boolean(mq || iosStandalone);
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPad =
    /iPad/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);
  return /iPhone|iPod/.test(ua) || iPad;
}

export function InstallPwaPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewOrIframe()) return;
    if (isStandalone()) return;
    if (wasShownRecently()) return;

    const show = () => {
      markShown();
      setVisible(true);
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      show();
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari does not fire beforeinstallprompt: show a manual hint.
    if (isIos()) {
      const inSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
      if (inSafari) {
        setIosHint(true);
        show();
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Installer MonRegistre"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-background/95 p-4 shadow-[var(--shadow-hero)] backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal/15 text-teal">
          <Download className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-semibold text-foreground">
            Installer MonRegistre
          </div>
          {iosHint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sur iPhone/iPad : appuyez sur{" "}
              <Share className="inline h-3 w-3 align-[-2px]" aria-hidden="true" /> Partager, puis
              « Sur l'écran d'accueil »{" "}
              <Plus className="inline h-3 w-3 align-[-2px]" aria-hidden="true" />.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ajoutez l'application à votre écran d'accueil pour un accès rapide, hors-ligne.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {!iosHint && deferred && (
              <Button size="sm" onClick={install} className="h-8 px-3 text-xs">
                <Download className="mr-1 h-3.5 w-3.5" /> Installer
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={close}
              className="h-8 px-3 text-xs"
            >
              Plus tard
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="rounded-md p-1 text-muted-foreground hover:bg-cream-deep/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
