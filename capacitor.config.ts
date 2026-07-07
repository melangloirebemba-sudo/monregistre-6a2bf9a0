import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monregistre.app',
  appName: 'MonRegistre',
  webDir: 'public-mini',
  server: {
    // L'app charge directement le site déployé (SSR + Supabase fonctionnent normalement)
    url: 'https://monregistre.lovable.app',
    androidScheme: 'https',
    cleartext: false,
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
  },
};

export default config;
