import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Creating and deleting auth users needs the service role, which bypasses RLS.
// It never leaves this function: every action below first proves the caller is
// a signed-in owner (not a viewer) and that the viewer they name is theirs.
const anon = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string);

const admin = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return createClient(process.env.SUPABASE_URL as string, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPassword = (p: unknown): p is string => typeof p === 'string' && p.length >= 8 && p.length <= 72;

async function ownerId(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const { data, error } = await anon.auth.getUser(header.slice('Bearer '.length));
  if (error || !data.user) return null;
  // A viewer must not be able to mint more viewers.
  if (data.user.app_metadata?.role === 'viewer') return null;
  return data.user.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const owner = await ownerId(req);
  if (!owner) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const db = admin();
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (req.method === 'POST') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!name || name.length > 100) return res.status(400).json({ error: 'invalid_name' });
      if (!EMAIL.test(email) || email.length > 150) return res.status(400).json({ error: 'invalid_email' });
      if (!validPassword(body.password)) return res.status(400).json({ error: 'invalid_password' });

      const { data, error } = await db.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        app_metadata: { role: 'viewer' },
        user_metadata: { full_name: name },
      });
      if (error || !data.user) {
        const taken = /already|registered|exists/i.test(error?.message ?? '');
        return res.status(taken ? 409 : 500).json({ error: taken ? 'email_taken' : 'create_failed' });
      }
      const { error: rowError } = await db.from('viewers').insert({ id: data.user.id, owner_id: owner, email, name });
      if (rowError) {
        // Without its row the account would be unreachable from the owner's
        // screen and impossible to delete there, so undo it.
        await db.auth.admin.deleteUser(data.user.id);
        return res.status(500).json({ error: 'create_failed' });
      }
      return res.status(201).json({ id: data.user.id, email, name });
    }

    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const raw = body.viewerId ?? req.query.viewerId;
      const viewerId = typeof raw === 'string' ? raw : '';
      const { data: row } = await db.from('viewers').select('id').eq('id', viewerId).eq('owner_id', owner).maybeSingle();
      if (!row) return res.status(404).json({ error: 'not_found' });

      if (req.method === 'PATCH') {
        if (!validPassword(body.password)) return res.status(400).json({ error: 'invalid_password' });
        const { error } = await db.auth.admin.updateUserById(viewerId, { password: body.password });
        if (error) return res.status(500).json({ error: 'update_failed' });
        return res.status(204).end();
      }

      // Cascades to the viewers row and every share.
      const { error } = await db.auth.admin.deleteUser(viewerId);
      if (error) return res.status(500).json({ error: 'delete_failed' });
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('viewers', e);
    return res.status(500).json({ error: 'server_error' });
  }
}
