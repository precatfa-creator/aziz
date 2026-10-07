import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aziz.finance',
  appName: 'Aziz',
  webDir: 'dist',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Aziz's AI route remains hosted by Vercel while the UI is bundled in the
    // APK. Native HTTP keeps that authenticated request out of WebView CORS.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
