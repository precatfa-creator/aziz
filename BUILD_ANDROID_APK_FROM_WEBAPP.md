# Build an Android APK from a Web App — Without Android Studio

This guide explains how to package an existing React, Vite, Vue, Svelte, or
other modern web app as an Android application using Capacitor and command-line
Android tools.

Capacitor does not recreate the interface in Kotlin. It places the compiled web
app inside a native Android WebView, so the Android version uses the same HTML,
CSS, JavaScript, components, animations, responsive layout, and business logic
as the website.

The workflow used to build Aziz was:

```text
Web source → production web build → Capacitor sync → Gradle → signed APK
```

## 1. When this approach is appropriate

Capacitor is a good fit when:

- The web app is already responsive on phone-sized screens.
- You want to keep the existing web UI and codebase.
- The app uses a modern build tool that produces static assets.
- You might later need Android APIs such as camera, files, notifications, or
  biometric authentication.

Consider a Trusted Web Activity instead when the Android app should always load
the hosted website and does not need a native bridge. Do not rewrite the app in
Flutter, React Native, or Kotlin merely to produce an APK unless you specifically
want a separate native UI.

## 2. Prerequisites

The versions used for the Aziz build in July 2026 were:

| Tool | Version |
| --- | --- |
| Node.js | 22 |
| Capacitor | 8.4.2 |
| Java | OpenJDK 21 |
| Android compile/target SDK | 36 |
| Minimum Android SDK | 24 |
| Gradle | 8.14.3 |

These versions will change over time. Check the current Capacitor Android
requirements before starting a new project. Keep all Capacitor packages on
compatible versions—preferably the same exact version where available.

You need:

- Node.js and npm
- JDK 21 or the Java version required by your Capacitor release
- Android SDK Command-line Tools
- Android SDK Platform and Build Tools
- A web app that builds successfully

You do **not** need Android Studio.

## 3. Verify the web app first

From the web project root:

```bash
npm install
npm run lint
npm run build
```

Confirm the output directory. Common values are:

| Framework/tool | Typical output |
| --- | --- |
| Vite | `dist` |
| Create React App | `build` |
| Angular | `dist/<project-name>` |
| Next.js static export | `out` |

Capacitor needs an `index.html` at the root of this output directory.

Before packaging, test the website at phone widths such as 360, 390, and 412
CSS pixels. Converting a desktop-only site into an APK does not automatically
make its layout mobile-friendly.

## 4. Install Capacitor

Install the Capacitor runtime, CLI, Android platform, and App plugin:

```bash
npm install --save-exact \
  @capacitor/core@8.4.2 \
  @capacitor/android@8.4.2 \
  @capacitor/app@8.1.1

npm install --save-dev --save-exact @capacitor/cli@8.4.2
```

For a future project, replace these versions with the current compatible
versions.

Initialize Capacitor:

```bash
npx cap init "My App" com.example.myapp --web-dir dist
```

Choose the application ID carefully. It becomes the permanent Android package
name and should use reverse-domain format:

```text
com.company.product
```

Changing it after publishing creates complications, so do not leave a sample ID
such as `com.example.app` in a real product.

## 5. Create the Capacitor configuration

Create `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.myapp',
  appName: 'My App',
  webDir: 'dist',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
```

Do not configure `server.url` to load the production website. Capacitor reserves
that setting for live reload and development. A production APK should bundle the
compiled web assets from `webDir`.

## 6. Add the Android project

Build the web app before adding Android:

```bash
npm run build
npx cap add android
```

This creates an `android/` Gradle project. The important generated values are:

- `android/app/build.gradle`: package version and Android settings
- `android/variables.gradle`: minimum, compile, and target SDK versions
- `android/app/src/main/AndroidManifest.xml`: permissions and native activities
- `android/app/src/main/res/`: icons, splash screens, and Android resources

Keep the `android/` directory in version control. Ignore generated directories
such as `android/.gradle/` and `android/app/build/`.

## 7. Install the Android command-line SDK

Download **Android SDK Command-line Tools for Linux** from the official Android
developer site and arrange it like this:

```text
android-sdk/
└── cmdline-tools/
    └── latest/
        ├── bin/
        └── lib/
```

Set environment variables:

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_SDK_ROOT=/path/to/android-sdk
export PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"
```

Accept SDK licenses:

```bash
yes | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" --licenses
```

Install the packages required by the generated Capacitor project:

```bash
"$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0"
```

If your generated `android/variables.gradle` uses another compile SDK, install
that platform instead.

Create `android/local.properties`:

```properties
sdk.dir=/absolute/path/to/android-sdk
```

This file is machine-specific and should normally remain ignored by Git.

## 8. Add repeatable npm scripts

For a Vite app, add:

```json
{
  "scripts": {
    "build:native": "vite build --mode native",
    "android:sync": "npm run build:native && cap sync android",
    "android:apk": "npm run android:sync && cd android && ./gradlew assembleDebug"
  }
}
```

For a framework other than Vite, replace `vite build --mode native` with its
production build command.

The ongoing development cycle becomes:

```bash
npm run android:apk
```

Always rebuild and sync after changing web files:

```bash
npm run build:native
npx cap sync android
```

`cap sync` copies the latest web bundle and updates installed native plugins.

## 9. Disable the PWA service worker in native builds

A Capacitor APK already bundles its web assets. Registering the website's PWA
service worker inside the native WebView can create stale or double-cached
assets.

For Vite PWA, conditionally omit the plugin in native mode:

```ts
export default defineConfig(({ mode }) => {
  const isNativeBuild = mode === 'native';

  return {
    plugins: [
      react(),
      ...(!isNativeBuild
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              // Existing PWA configuration
            }),
          ]
        : []),
    ],
  };
});
```

After a native build, verify that `dist/sw.js` is absent:

```bash
test ! -f dist/sw.js && echo "Native service worker is disabled"
```

## 10. Fix relative backend API URLs

This is one of the most important compatibility checks.

In a website, this request reaches the site's backend:

```ts
fetch('/api/report');
```

Inside a bundled APK, the WebView origin is normally `https://localhost`.
Consequently, `/api/report` incorrectly points to the local WebView rather than
the hosted server.

Create an API URL helper:

```ts
import { Capacitor } from '@capacitor/core';

const NATIVE_API_ORIGIN = 'https://app.example.com';

export function apiUrl(path: `/${string}`): string {
  if (!Capacitor.isNativePlatform()) return path;
  return `${NATIVE_API_ORIGIN}${path}`;
}
```

Use it for server-owned routes:

```ts
const response = await fetch(apiUrl('/api/report'), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify(payload),
});
```

Do not move server secrets into the APK. API keys that must remain secret must
stay in serverless functions, API servers, or edge functions.

### CORS options

Cross-origin requests from the WebView can be handled in either of two ways:

1. Add explicit server CORS support for the native origin, commonly
   `https://localhost`, including `OPTIONS` requests.
2. Enable Capacitor's native HTTP bridge.

Native HTTP configuration:

```ts
const config: CapacitorConfig = {
  // ...
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};
```

Continue authenticating protected API requests even when using native HTTP.
Bypassing browser CORS is not a substitute for server-side authorization.

## 11. Preserve safe areas and edge-to-edge layouts

Android 15 and newer can render the WebView underneath the status and navigation
bars. Without inset handling, headers and bottom buttons can be obscured.

Update the viewport meta tag:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, viewport-fit=cover"
/>
```

Use CSS safe-area variables:

```css
.app-header {
  padding-top: calc(0.875rem + env(safe-area-inset-top, 0px));
}

.bottom-navigation {
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
}
```

Also test landscape orientation, display cutouts, gesture navigation, and the
on-screen keyboard.

## 12. Handle Android's Back button

Install `@capacitor/app`, then add a native-only listener:

```ts
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;

  let disposed = false;
  let removeListener: (() => Promise<void>) | undefined;

  void CapacitorApp.addListener('backButton', () => {
    if (isModalOpen) {
      closeModal();
    } else if (currentScreen !== 'home') {
      navigateToHome();
    } else {
      void CapacitorApp.exitApp();
    }
  }).then((handle) => {
    if (disposed) {
      void handle.remove();
    } else {
      removeListener = () => handle.remove();
    }
  });

  return () => {
    disposed = true;
    void removeListener?.();
  };
}, [currentScreen, isModalOpen]);
```

Adapt the order to the app's navigation model. Usually Back should:

1. Close a dialog or menu.
2. Return to the previous app screen.
3. Exit only from the home screen.

## 13. Generate Android icons and splash screens

Prepare a square source icon of at least 1024×1024 pixels. Then temporarily
install the Capacitor asset generator:

```bash
npm install --save-dev --save-exact @capacitor/assets
mkdir -p assets
cp /path/to/source-icon.png assets/icon.png
npx capacitor-assets generate --android
```

This produces legacy and adaptive launcher icons plus light and dark splash
resources under `android/app/src/main/res/`.

The generator can be removed after it creates the files:

```bash
npm uninstall --save-dev @capacitor/assets
```

The generated Android resource files remain in the project.

## 14. Permissions and native features

Capacitor adds the Internet permission by default:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Only add permissions required by actual features. Examples include camera,
notifications, or location. Modern Android versions often require both a
manifest declaration and a runtime permission request.

Prefer official Capacitor plugins where available:

```bash
npm install @capacitor/camera
npx cap sync android
```

Web features requiring special attention include:

- File downloads and generated CSV/PDF files
- Camera capture and image selection
- Clipboard access
- Notifications
- OAuth redirects and deep links
- Passkeys and WebAuthn
- Background tasks
- Sharing files
- Opening external links

Test every one on a real Android device. Browser success does not guarantee
identical WebView behavior.

## 15. Build an installable debug APK

From the project root:

```bash
npm run android:apk
```

Or run the individual commands:

```bash
npm run build:native
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon
```

The APK is generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

This APK is automatically signed with the Android debug key and can be installed
directly for development and testing.

Install it through USB debugging:

```bash
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The `-r` option updates an existing installation while retaining its app data.

## 16. Verify the APK

Locate `aapt` and `apksigner` in the installed Android Build Tools:

```bash
export BUILD_TOOLS="$ANDROID_SDK_ROOT/build-tools/36.0.0"
export APK="android/app/build/outputs/apk/debug/app-debug.apk"
```

Inspect package metadata:

```bash
"$BUILD_TOOLS/aapt" dump badging "$APK" | head -20
```

Verify the signature:

```bash
"$BUILD_TOOLS/apksigner" verify \
  --verbose \
  --print-certs \
  "$APK"
```

Generate an integrity checksum:

```bash
sha256sum "$APK"
```

At minimum, confirm:

- Correct application ID
- Correct application label
- Intended version name and version code
- Correct minimum and target SDK
- Required permissions only
- Signature verification succeeds

## 17. Produce a release APK or Play Store AAB

A debug APK is for testing. Do not publish it.

For production, create one permanent upload/release keystore and protect it
carefully:

```bash
keytool -genkeypair \
  -v \
  -keystore my-app-upload.jks \
  -alias my-app-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Never commit:

- The keystore
- Keystore passwords
- `keystore.properties`
- CI signing secrets

Configure the Android `release` signing configuration using environment
variables or an ignored `keystore.properties` file.

Build a release APK:

```bash
cd android
./gradlew assembleRelease
```

Typical output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Build an Android App Bundle for Google Play:

```bash
./gradlew bundleRelease
```

Typical output:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

An APK is directly installable. An AAB is a publishing format used by Google
Play to generate optimized APKs for each device.

Back up the production keystore and its credentials in secure, redundant
locations. Losing the signing key can prevent future updates to installations
that trust that key.

## 18. Real-device parity checklist

Test at least:

- Small phone width and tall phone width
- Android 15/16 edge-to-edge behavior
- Portrait and landscape
- Light and dark themes
- RTL and LTR languages when supported
- Status-bar icon contrast
- Bottom gesture-navigation inset
- Keyboard opened in every important form or dialog
- Android Back button
- Login, logout, and session persistence
- All backend calls
- File uploads and downloads
- Camera/image selection
- Offline launch and reconnection
- External links
- App relaunch after the OS terminates it

For high UI fidelity, capture the web app and APK at the same viewport and
compare screenshots. Minor font rasterization or system-bar differences can
still occur because Chrome and Android WebView are different runtime surfaces.

## 19. Common failures

### Capacitor cannot find web assets

The configured `webDir` is wrong or the web build has not run:

```bash
npm run build:native
npx cap sync android
```

Confirm that `<webDir>/index.html` exists.

### Relative `/api` calls return HTML, 404, or an empty response

The request is going to the WebView's local origin. Use an absolute deployed API
origin for native builds and configure native HTTP or server CORS.

### Content appears under the status bar

Add `viewport-fit=cover` and apply `env(safe-area-inset-top)` to the top-level
header or page container.

### Bottom navigation is obscured

Position it with `env(safe-area-inset-bottom)` and test gesture navigation and
three-button navigation.

### The APK displays stale JavaScript

Rebuild and sync:

```bash
npm run build:native
npx cap sync android
```

Ensure the native build does not register the PWA service worker.

### Gradle cannot find Java

Set `JAVA_HOME` and add its `bin` directory to `PATH`:

```bash
export JAVA_HOME=/absolute/path/to/jdk-21
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

### Gradle cannot find the Android SDK

Set `ANDROID_SDK_ROOT` and create `android/local.properties`:

```properties
sdk.dir=/absolute/path/to/android-sdk
```

### Missing Android SDK package

Check the requested compile SDK in `android/variables.gradle`, then install it:

```bash
"$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
  "platforms;android-36" \
  "build-tools;36.0.0"
```

### OAuth works on the web but not in the APK

Embedded WebViews are often unsuitable for provider login pages. Use the system
browser, register an Android deep link or App Link, and configure the auth
provider to redirect back to the application.

### File download does nothing

WebView download behavior varies. For important exports, use Capacitor Filesystem
and Share plugins instead of relying only on an `<a download>` element.

## 20. Security checklist

- Never embed server, admin, service-role, or private API secrets in the APK.
- Treat everything compiled by Vite/Webpack as public and extractable.
- Keep privileged AI/payment/email operations behind authenticated servers.
- Validate access tokens on the server.
- Enforce row/object ownership in the database or storage layer.
- Keep HTTPS enabled and `allowMixedContent` disabled.
- Request only required Android permissions.
- Pin important dependencies and commit the lockfile.
- Run dependency audits, but review fixes instead of applying breaking
  `--force` upgrades blindly.
- Protect the production signing key.
- Test logout, token refresh, and session restoration on a real device.

## 21. Aziz implementation reference

The Aziz Android build uses:

```text
App ID:       com.aziz.finance
App name:     Aziz
Web output:   dist
Native API:   https://aziz-finance.vercel.app
Minimum SDK:  24
Target SDK:   36
```

Its reusable commands are:

```bash
npm run lint
npm run build:native
npm run android:sync
npm run android:apk
```

Its debug APK output is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For each new web app, repeat the same structure but change:

1. Application ID and application name
2. Web build/output directory
3. Native API origin
4. Icons and splash assets
5. Required Android permissions/plugins
6. Navigation and Back-button behavior
7. Release keystore and version numbers

