import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monregistre.app',
  appName: 'MonRegistre',
  // Build local et offline-first : les fichiers de l'app sont embarqués dans
  // l'APK (voir `npm run build:mobile`), l'app ne dépend plus d'une URL
  // distante pour s'ouvrir. Les données (classes, élèves, notes, absences,
  // EDT...) fonctionnent hors ligne via la file d'attente IndexedDB
  // (src/lib/offline-queue.ts) + le cache de lecture persistant (src/router.tsx).
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#1a1a2e',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1a1a2e',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
    },
    CapacitorUpdater: {
      // Mode manuel : pas de serveur Capgo — le bundle web est récupéré
      // depuis les Releases GitHub par src/lib/live-update.ts.
      autoUpdate: false,
      appReadyTimeout: 10000,
    },
  },
};

export default config;
