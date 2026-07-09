// Build config used ONLY for the mobile app (Capacitor).
// The web app on Lovable keeps using vite.config.ts (SSR) untouched.
// This produces a static, client-only build (TanStack Start "SPA mode")
// that can be bundled inside the Android/iOS app and works fully offline.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    spa: {
      enabled: true,
      maskPath: "/",
    },
  },
  vite: {
    preview: {
      host: "127.0.0.1",
    },
  },
});

