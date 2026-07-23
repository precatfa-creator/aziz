/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Names match what the Vercel Supabase Marketplace integration injects
// (Next.js convention) — vite.config.ts extends envPrefix to expose these to
// the client bundle instead of hand-duplicating them under a VITE_ prefix,
// which would silently go stale on the next `vercel env pull`.
// experimental.passkey turns on auth.signInWithPasskey()/registerPasskey() in
// the SDK — the project's Auth server must also have Passkeys enabled
// (Dashboard -> Authentication -> Sign In / Providers -> Passkeys), otherwise
// those calls fail with a clear "Passkeys are disabled" error.
export const supabase = createClient(
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string,
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { experimental: { passkey: true } } },
);

// The /api/ai/* functions verify this bearer token server-side before
// calling Gemini — without it every request 401s.
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
