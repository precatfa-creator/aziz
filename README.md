# عزيز | Aziz — Personal Finance

Wallets, transactions, transfers, receipts, reports, and a Gemini-backed AI
advisor. Ships as a web app/PWA on Vercel and as an Android APK via Capacitor.

| Layer | Stack |
| --- | --- |
| Frontend | React + Vite + Tailwind (`src/`) |
| Backend | Supabase — Postgres, Auth, Storage, Realtime (`supabase/migrations/`) |
| API | Vercel functions calling Gemini (`api/`) |
| Android | Capacitor 8 WebView wrapper (`android/`, `capacitor.config.ts`) |

## Run locally

**Prerequisites:** Node.js 22+, a linked Vercel project (`vercel link`), and
Supabase provisioned through the Vercel Marketplace
(`vercel integration add supabase`).

1. `npm install`
2. `vercel env pull .env.local` — variables are documented in `.env.example`
3. Apply every file in `supabase/migrations/` to your Supabase project, in
   filename order
4. `npm run dev`

## Auth

Google OAuth only, through Supabase Auth. Enable the Google provider in the
Supabase dashboard (Authentication → Providers → Google) with the redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`.

## Wallet sharing

An owner can share a wallet with a **viewer**: a separate email-and-password
account that opens a read-only portal showing only the wallets shared with it.
Per wallet and viewer, the owner picks *balance only*, *all transactions*, or
*all except the ones I hide* (hidden rows arrive as "معاملة N", amount and date
only).

All of it is enforced in Postgres (`supabase/migrations/20261007120000_wallet_sharing.sql`):
viewers have no table access and read through two security-definer functions
that apply the share mode. Viewer accounts are created by `api/viewers.ts` with
`SUPABASE_SERVICE_ROLE_KEY`. The Email provider must be enabled in Supabase so
viewers can sign in with a password.

`node supabase/sharing.check.mjs` runs every migration against an in-memory
Postgres (PGlite) and asserts what owners, viewers and strangers can see.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production web build into `dist/` |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npx tsx src/lib/<name>.check.ts` | Run one self-check; each exits non-zero on failure |
| `npm run android:sync` | Native build + `cap sync android` |
| `npm run android:apk` | Sync, then build a debug APK with Gradle |

## Android

The APK bundles the UI and serves it from `https://localhost`. API calls go to
the deployed Vercel origin (`src/lib/apiUrl.ts`) over Capacitor's native HTTP.
Android Studio is not required; see
[BUILD_ANDROID_APK_FROM_WEBAPP.md](BUILD_ANDROID_APK_FROM_WEBAPP.md) for the
SDK setup and signing steps.

The debug APK is written to `android/app/build/outputs/apk/debug/`.

## Releases

Versions follow [Semantic Versioning](https://semver.org). Tags are named
`vX.Y.Z`. On each release, keep `package.json` `version` and the Android
`versionName` equal, and increment `versionCode` in
`android/app/build.gradle`.
