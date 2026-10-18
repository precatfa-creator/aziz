import { Capacitor, registerPlugin } from '@capacitor/core';

// The Android WebView ignores window.print(), so the APK ships a small native
// plugin (android/.../PrintPlugin.java) that hands the page to Android's print
// service, whose "Save as PDF" target produces the file.
const AzizPrint = registerPlugin<{ print(options: { name: string }): Promise<void> }>('AzizPrint');

/**
 * Prints the current page — only what `@media print` leaves visible — under
 * `name`, which browsers and Android both use as the default PDF file name.
 */
export async function printPage(name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await AzizPrint.print({ name });
    return;
  }
  const title = document.title;
  document.title = name;
  try {
    window.print();
  } finally {
    document.title = title;
  }
}
