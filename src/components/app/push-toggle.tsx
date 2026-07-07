// UI: enable/disable Web Push on the current device.
import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { enablePush, disablePush, getPushSupport, isPushEnabled } from "@/lib/push";

export function PushToggle() {
  const [supported, setSupported] = useState<boolean>(false);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [status, setStatus] = useState<"unsupported" | "granted" | "denied" | "default">("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getPushSupport();
    setStatus(s);
    setSupported(s !== "unsupported");
    if (s === "granted") {
      void isPushEnabled().then(setEnabled);
    }
  }, []);

  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-foreground">Notifications push</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Votre navigateur ne prend pas en charge les notifications push. Sur iPhone / iPad, installez
              d'abord l'application depuis Safari via « Sur l'écran d'accueil » (iOS 16.4 ou plus récent).
            </p>
          </div>
        </div>
      </div>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Notifications push désactivées sur cet appareil");
      } else {
        const res = await enablePush();
        if (res.ok) {
          setEnabled(true);
          setStatus("granted");
          toast.success("Notifications push activées sur cet appareil");
        } else {
          toast.error(res.reason);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <BellRing className="h-5 w-5 text-teal" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Notifications push sur cet appareil</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Recevez chaque soir le programme du lendemain, les rappels d'expiration de licence et les
            alertes importantes, même quand l'application est fermée.
          </p>
          {status === "denied" && (
            <p className="mt-2 text-xs text-destructive">
              Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur
              puis rechargez la page.
            </p>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={toggle}
              disabled={busy || status === "denied"}
              className="inline-flex items-center gap-2 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-ink-foreground shadow-sm transition-colors hover:bg-teal/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {enabled ? "Désactiver sur cet appareil" : "Activer les notifications push"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
