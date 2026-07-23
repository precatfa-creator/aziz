import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string,
);

/**
 * Verifies the caller's Supabase session before letting a request reach the
 * (metered, paid) Gemini API — closes the unauthenticated-proxy finding from
 * the security audit. Returns the user id on success, null otherwise.
 */
export async function verifyUser(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
