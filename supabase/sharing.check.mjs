// Run: node supabase/sharing.check.mjs
// Runs every migration against an in-memory Postgres with Supabase's auth /
// storage / realtime schemas stubbed, then exercises the sharing rules as
// owner, viewer and stranger. Touches nothing outside this process.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const repo = process.argv[2] ?? '.';
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema storage; create schema realtime;
  create table auth.users (id uuid primary key, email text,
    raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql as
    $$ select string_to_array(name, '/') $$;
  create table realtime.messages (id serial, extension text);
  create function realtime.topic() returns text language sql as $$ select '' $$;
  create function realtime.broadcast_changes(a text, b text, c text, d text, e text, f record, g record)
    returns void language plpgsql as $$ begin end $$;
`);

for (const f of readdirSync(`${repo}/supabase/migrations`).sort()) {
  try {
    await db.exec(readFileSync(`${repo}/supabase/migrations/${f}`, 'utf8'));
  } catch (e) {
    throw new Error(`${f}: ${e.message}`);
  }
}
await db.exec(`
  grant usage on schema public, auth, storage to authenticated;
  grant all on all tables in schema public to authenticated;
  grant all on all tables in schema storage to authenticated;
  grant execute on all functions in schema auth to authenticated;
  alter table storage.objects enable row level security;
`);

const O = '00000000-0000-0000-0000-00000000000a';
const V = '00000000-0000-0000-0000-00000000000b';
const V2 = '00000000-0000-0000-0000-00000000000c';
const W1 = '10000000-0000-0000-0000-000000000001';
const W2 = '10000000-0000-0000-0000-000000000002';

await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values ('${O}', 'o@x', '{"full_name":"Owner"}');
  insert into auth.users (id, email, raw_app_meta_data) values
    ('${V}', 'v@x', '{"role":"viewer"}'), ('${V2}', 'v2@x', '{"role":"viewer"}');
`);
const seeded = await db.query(`select count(*)::int n from public.profiles`);
assert.equal(seeded.rows[0].n, 1, 'viewers must not get a profile');
const cats = await db.query(`select count(*)::int n from public.categories where user_id <> '${O}'`);
assert.equal(cats.rows[0].n, 0, 'viewers must not get seeded categories');

const cat = (await db.query(`select id from public.categories where user_id='${O}' and type='expense' limit 1`)).rows[0].id;
await db.exec(`
  insert into public.wallets (id, user_id, name, initial_balance, currency, color, icon) values
    ('${W1}', '${O}', 'Card', 1000, 'LYD', 'indigo', 'CreditCard'),
    ('${W2}', '${O}', 'Other', 0, 'LYD', 'emerald', 'Wallet');
  insert into public.viewers (id, owner_id, email, name) values ('${V}', '${O}', 'v@x', 'Friend'), ('${V2}', '${O}', 'v2@x', 'Other friend');
  insert into public.incomes (user_id, amount, currency, title, date, wallet_id, is_opening) values
    ('${O}', 999, 'LYD', 'opening', '2026-01-01', '${W1}', true),
    ('${O}', 500, 'LYD', 'Salary', '2026-01-02', '${W1}', null),
    ('${O}', 20, 'LYD', 'from Other', '2026-01-03', '${W1}', null);
  update public.incomes set transfer_id = gen_random_uuid(), category_name = 'Other wallet', notes = 'Other wallet' where title = 'from Other';
  insert into public.expenses (user_id, amount, currency, title, date, wallet_id, expense_kind, hidden_from_viewers, notes, category_id, is_refunded) values
    ('${O}', 100, 'LYD', 'Groceries', '2026-01-04', '${W1}', null, null, 'milk', '${cat}', null),
    ('${O}', 300, 'LYD', 'ATM', '2026-01-05', '${W1}', 'cash_withdrawal', null, null, null, null),
    ('${O}', 50, 'LYD', 'Secret gift', '2026-01-06', '${W1}', 'cash_spend', true, 'for X', '${cat}', null),
    ('${O}', 70, 'LYD', 'Returned', '2026-01-07', '${W1}', null, null, null, null, true),
    ('${O}', 10, 'USD', 'App store', '2026-01-08', '${W1}', null, true, null, null, null);
`);

const as = async (uid, role, fn) => {
  await db.exec(`set role authenticated`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: uid, app_metadata: role ? { role } : {} }),
  ]);
  try { return await fn(); } finally { await db.exec(`reset role`); }
};
const rejects = async (p, msg) => assert.rejects(p, undefined, msg);

// Owner shares W1 with V (partial). Owner can't share with a non-viewer uuid.
await as(O, null, async () => {
  await db.exec(`insert into public.wallet_shares (wallet_id, viewer_id, owner_id, mode) values ('${W1}', '${V}', '${O}', 'partial')`);
  await rejects(db.exec(`insert into public.wallet_shares (wallet_id, viewer_id, owner_id, mode) values ('${W1}', '${O}', '${O}', 'all')`),
    'shared with a uuid that is not one of my viewers');
  const own = await db.query(`select count(*)::int n from public.expenses`);
  assert.equal(own.rows[0].n, 5, 'owner lost access to own rows');
});

// Viewer: no table access, no writes, redacted reads.
await as(V, 'viewer', async () => {
  for (const t of ['expenses', 'incomes', 'wallets', 'profiles', 'categories', 'wallet_shares']) {
    const r = await db.query(`select count(*)::int n from public.${t}`);
    assert.equal(r.rows[0].n, 0, `viewer can read ${t}`);
  }
  await rejects(db.exec(`insert into public.wallets (user_id, name, initial_balance, currency, color, icon) values ('${V}', 'mine', 0, 'LYD', 'x', 'x')`),
    'viewer created a wallet');
  await rejects(db.exec(`insert into storage.objects (bucket_id, name) values ('receipts', '${V}/a.jpg')`),
    'viewer uploaded a receipt');

  const bal = (await db.query(`select * from public.viewer_wallets()`)).rows;
  assert.equal(bal.length, 2, 'expected LYD and USD buckets');
  const lyd = bal.find((b) => b.currency === 'LYD');
  // 1000 + 500 + 20 (transfer in) - 100 - 300 (withdrawn); refunded counts 0; opening excluded.
  assert.equal(Number(lyd.on_card), 1120);
  assert.equal(Number(lyd.in_cash), 250);
  assert.equal(Number(bal.find((b) => b.currency === 'USD').on_card), -10);
  assert.equal(lyd.owner_name, 'Owner');
  assert.equal(Number(lyd.initial_balance), 1000, 'opening balance missing');

  const tx = (await db.query(`select * from public.viewer_wallet_transactions('${W1}')`)).rows;
  assert.equal(tx.length, 8);
  const masked = tx.filter((t) => t.is_masked);
  assert.deepEqual(masked.map((t) => t.title).sort(), ['معاملة 1', 'معاملة 2']);
  for (const m of masked) {
    assert.equal(m.category_name, null);
    assert.equal(m.notes, null);
  }
  assert.equal(masked.find((t) => t.title === 'معاملة 1').date, '2026-01-06', 'numbering must be oldest first');
  assert.equal(tx.find((t) => t.is_transfer).title, 'تحويل', 'transfer title leaked');
  assert.ok(!JSON.stringify(tx).includes('Other wallet'), 'other wallet name leaked through a transfer');
  const groceries = tx.find((t) => t.title === 'Groceries');
  assert.equal(groceries.notes, 'milk');
  assert.ok(groceries.category_name, 'unmasked row lost its category');
  assert.equal(Number(tx.find((t) => t.title === 'Returned').amount), 0, 'refunded row must read 0');
  assert.ok(!tx.some((t) => JSON.stringify(t).includes('Secret') || JSON.stringify(t).includes('for X')), 'hidden content leaked');

  assert.equal((await db.query(`select * from public.viewer_wallet_transactions('${W2}')`)).rows.length, 0, 'unshared wallet leaked');
});

// Mode switches: all shows hidden rows in full; balance returns no rows.
await as(O, null, () => db.exec(`update public.wallet_shares set mode = 'all'`));
await as(V, 'viewer', async () => {
  const tx = (await db.query(`select * from public.viewer_wallet_transactions('${W1}')`)).rows;
  assert.ok(tx.some((t) => t.title === 'Secret gift') && !tx.some((t) => t.is_masked));
});
await as(O, null, () => db.exec(`update public.wallet_shares set mode = 'balance'`));
await as(V, 'viewer', async () => {
  assert.equal((await db.query(`select * from public.viewer_wallet_transactions('${W1}')`)).rows.length, 0, 'balance mode leaked rows');
  assert.equal((await db.query(`select * from public.viewer_wallets()`)).rows.length, 2, 'balance mode lost the balance');
  assert.equal(Number((await db.query(`select initial_balance from public.viewer_wallets() limit 1`)).rows[0].initial_balance), 1000, 'balance mode lost the opening balance');
});

// A different viewer sees nothing.
await as(V2, 'viewer', async () => {
  assert.equal((await db.query(`select * from public.viewer_wallets()`)).rows.length, 0);
  assert.equal((await db.query(`select * from public.viewer_wallet_transactions('${W1}')`)).rows.length, 0);
});

console.log('sharing.check: all assertions passed');
