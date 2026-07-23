# عزيز | Aziz — Personal Finance

React + Vite frontend, Supabase (Postgres + Auth) backend, deployed on Vercel.
`api/` holds the Gemini-backed serverless functions.

## Run locally

**Prerequisites:** Node.js, a linked Vercel project (`vercel link`), Supabase provisioned via the Vercel Marketplace (`vercel integration add supabase`).

1. Install dependencies: `npm install`
2. Pull env vars: `vercel env pull .env.local`
3. Apply `supabase/migrations/0001_init.sql` to your Supabase project
4. Run the app: `npm run dev`

## Auth

Google OAuth only, via Supabase Auth. Configure the Google provider in the
Supabase dashboard (Authentication → Providers → Google) with a redirect URI
of `https://<project-ref>.supabase.co/auth/v1/callback`.
