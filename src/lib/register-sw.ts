// Guarded service worker registration.
// Registers only in production, top-level window, and non-preview hostnames.
// Supports ?sw=off to unregister.

const SW_URL = "/sw.js";

function isPreviewHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => r.active?.scriptURL.endsWith(SW_URL) || r.installing?.scriptURL.endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const inIframe = window.self !== window.top;
  const disabled = url.searchParams.get("sw") === "off";
  const isProd = import.meta.env.PROD;
  const preview = isPreviewHost(window.location.hostname);

  if (!isProd || inIframe || preview || disabled) {
    void unregisterMatching();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL).catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}
