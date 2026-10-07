import { Capacitor } from '@capacitor/core';

const NATIVE_API_ORIGIN = 'https://aziz-finance.vercel.app';

/**
 * Browser builds keep same-origin /api calls. The APK serves its UI from
 * https://localhost, so native builds must address the deployed Vercel API.
 */
export function apiUrl(path: `/${string}`): string {
  if (!Capacitor.isNativePlatform()) return path;
  return `${NATIVE_API_ORIGIN}${path}`;
}
