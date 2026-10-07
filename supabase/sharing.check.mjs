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

// Owner shares W1 with V. The retired 'partial' mode is refused; so is a
// share with a uuid that is not one of the owner's viewers.
await as(O, null, async () => {
  await rejects(db.exec(`insert into public.wallet_shares (wallet_id, viewer_id, owner_id, mode) values ('${W1}', '${V}', '${O}', 'partial')`),
    'retired partial mode accepted');
  await db.exec(`insert into public.wallet_shares (wallet_id, viewer_id, owner_id, mode) values ('${W1}', '${V}', '${O}', 'all')`);
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
  // Every non-transfer row is "معاملة N", oldest first; notes never leave.
  const numbered = tx.filter((t) => !t.is_transfer).sort((a, b) => a.date.localeCompare(b.date));
  assert.deepEqual(numbered.map((t) => t.title), [1, 2, 3, 4, 5, 6, 7].map((n) => `معاملة ${n}`));
  assert.ok(numbered.every((t) => t.is_masked && t.notes === null));
  assert.equal(numbered[0].date, '2026-01-01', 'numbering must be oldest first');
  assert.ok(numbered.find((t) => t.date === '2026-01-04').category_name, 'category should stay visible');
  assert.equal(tx.find((t) => t.is_transfer).title, 'تحويل', 'transfer title leaked');
  assert.ok(!JSON.stringify(tx).includes('Other wallet'), 'other wallet name leaked through a transfer');
  assert.equal(Number(tx.find((t) => t.date === '2026-01-07').amount), 0, 'refunded row must read 0');
  for (const secret of ['Groceries', 'milk', 'Secret', 'for X', 'Salary', 'ATM', 'Returned', 'App store', 'opening']) {
    assert.ok(!JSON.stringify(tx).includes(secret), `real title or note leaked: ${secret}`);
  }

  assert.equal((await db.query(`select * from public.viewer_wallet_transactions('${W2}')`)).rows.length, 0, 'unshared wallet leaked');
});

// Compartment scope: a cash-only share sees cash rows and the cash balance,
// a card-only share the card side; numbering counts only what is received.
await as(O, null, () => db.exec(`update public.wallet_shares set compartment = 'cash'`));
await as(V, 'viewer', async () => {
  const tx = (await db.query(`select * from public.viewer_wallet_transactions('${W1}')`)).rows;
  assert.deepEqual(tx.map((t) => t.date).sort(), ['2026-01-05', '2026-01-06'], 'cash share must see only the withdrawal and cash spend');
  assert.deepEqual(tx.map((t) => t.title).sort(), ['معاملة 1', 'معاملة 2']);
  const lyd = (await db.query(`select * from public.viewer_wallets()`)).rows.find((b) => b.currency === 'LYD');
  assert.equal(lyd.on_card, null, 'cash share leaked the card balance');
  assert.equal(lyd.initial_balance, null, 'cash share leaked the opening balance');
  assert.equal(Number(lyd.in_cash), 250);
  assert.equal(lyd.compartment, 'cash');
});
await as(O, null, () => db.exec(`update public.wallet_shares set compartment = 'card'`));
await as(V, 'viewer', async () => {
  const tx = (await db.query(`select * from public.viewer_wallet_transactions('${W1}')`)).rows;
  assert.equal(tx.length, 7, 'card share must drop only the cash spend');
  assert.ok(!tx.some((t) => t.expense_kind === 'cash_spend'));
  const lyd = (await db.query(`select * from public.viewer_wallets()`)).rows.find((b) => b.currency === 'LYD');
  assert.equal(lyd.in_cash, null, 'card share leaked the cash balance');
  assert.equal(Number(lyd.on_card), 1120);
  assert.equal(Number(lyd.initial_balance), 1000);
});
await as(O, null, async () => {
  await rejects(db.exec(`update public.wallet_shares set compartment = 'pocket'`), 'unknown compartment accepted');
  await db.exec(`update public.wallet_shares set compartment = 'all'`);
});

// Wallet type: existing wallets default to card (W1's numbers above are
// unchanged). A cash wallet is all cash, and a card/cash scope on it is moot.
await db.exec(`
  update public.wallets set is_card = false where id = '${W2}';
  insert into public.incomes (user_id, amount, currency, title, date, wallet_id) values ('${O}', 300, 'LYD', 'Gift', '2026-02-01', '${W2}');
  insert into public.expenses (user_id, amount, currency, title, date, wallet_id) values ('${O}', 50, 'LYD', 'Bread', '2026-02-02', '${W2}');
`);
await as(O, null, () => db.exec(`insert into public.wallet_shares (wallet_id, viewer_id, owner_id, mode, compartment) values ('${W2}', '${V}', '${O}', 'all', 'card')`));
// A card-only share of a cash wallet receives nothing — unticking "card"
// must never widen what a viewer was given.
await as(V, 'viewer', async () => {
  const w2 = (await db.query(`select * from public.viewer_wallets()`)).rows.find((b) => b.wallet_id === W2);
  assert.equal(w2.on_card, null, 'a cash wallet has no card balance');
  assert.equal(w2.in_cash, null, 'a card-only share of a cash wallet leaked its cash');
  assert.equal(w2.initial_balance, null, 'a card-only share of a cash wallet leaked its opening balance');
  assert.equal((await db.query(`select * from public.viewer_wallet_transactions('${W2}')`)).rows.length, 0,
    'a card-only share of a cash wallet leaked rows');
});
await as(O, null, () => db.exec(`update public.wallet_shares set compartment = 'cash' where wallet_id = '${W2}'`));
await as(V, 'viewer', async () => {
  const w2 = (await db.query(`select * from public.viewer_wallets()`)).rows.find((b) => b.wallet_id === W2);
  assert.equal(w2.on_card, null, 'a cash wallet has no card balance');
  assert.equal(Number(w2.in_cash), 250, 'a cash wallet holds its whole total as cash');
  assert.equal(Number(w2.initial_balance), 0, 'a cash wallet\'s opening balance is its cash opening');
  const tx = (await db.query(`select * from public.viewer_wallet_transactions('${W2}')`)).rows;
  assert.equal(tx.length, 2, 'a cash-only share of a cash wallet must see every row');
  const w1 = (await db.query(`select * from public.viewer_wallets()`)).rows.find((b) => b.wallet_id === W1 && b.currency === 'LYD');
  assert.equal(Number(w1.on_card), 1120, 'existing card wallet changed');
  assert.equal(Number(w1.in_cash), 250, 'existing card wallet changed');
});
await as(O, null, () => db.exec(`delete from public.wallet_shares where wallet_id = '${W2}'`));

// Balance mode returns no rows.
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
