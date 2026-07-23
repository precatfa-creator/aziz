-- Aziz | عزيز — initial Postgres schema, replacing Firestore.
-- Design notes (see /home/omix/.claude/plans/reactive-jingling-seahorse.md for full context):
--   * Fixed columns per table close the ghost-field/mass-assignment gap the old
--     Firestore rules had (finding #1) — a client can't smuggle an unknown field
--     into a row the way it could into a loosely key-counted Firestore document.
--   * set_timestamps() trigger forces created_at/updated_at server-side on every
--     table, regardless of what a client sends (finding #3).
--   * RLS policies use auth.uid() = user_id ownership checks (closes ownership-
--     theft payloads); Google OAuth via Supabase Auth means every session is
--     already email-verified (finding #4, no extra check needed).
--   * savings_groups.members/receiving_order size capped at 20 (finding #5 —
--     spec said 20, the old Firestore rule said 100).
-- ponytail: members/receiving_order stay JSONB (embedded arrays), trash.original_data
-- stays JSONB (snapshot blob) — normalizing either into join tables is scope
-- creep for a fresh-start migration with no data to migrate; revisit if the
-- app ever needs to query inside a member list server-side.

-- ============================================================================
-- Tables
-- ============================================================================

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 150),
  initial_balance numeric not null,
  currency text not null check (currency in ('LYD', 'USD')),
  color text not null check (char_length(color) <= 50),
  icon text not null check (char_length(icon) <= 50),
  is_hidden boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  email text not null check (char_length(email) <= 150),
  preferred_language text not null default 'ar' check (preferred_language in ('ar', 'en')),
  preferred_currency text not null default 'LYD' check (preferred_currency in ('LYD', 'USD')),
  exchange_rate_usd_lyd numeric not null default 6.15 check (exchange_rate_usd_lyd between 0.1 and 50.0),
  -- soft reference, not a real FK: mirrors the old Firestore field, which was
  -- never enforced as a relation either.
  default_expense_wallet_id uuid references public.wallets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  type text not null check (type in ('income', 'expense', 'purchase')),
  color text not null check (char_length(color) <= 30),
  icon text not null check (char_length(icon) <= 50),
  is_archived boolean not null default false,
  parent_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  currency text not null check (currency in ('LYD', 'USD')),
  title text not null check (char_length(title) <= 150),
  date text not null check (char_length(date) <= 30),
  category_id uuid not null references public.categories(id) on delete restrict,
  wallet_id uuid references public.wallets(id) on delete set null,
  notes text check (char_length(notes) <= 5000),
  image_url text check (char_length(image_url) <= 1048576),
  priority text check (priority in ('low', 'medium', 'high')),
  is_historical boolean,
  is_opening boolean,
  category_name text check (char_length(category_name) <= 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  currency text not null check (currency in ('LYD', 'USD')),
  title text not null check (char_length(title) <= 150),
  date text not null check (char_length(date) <= 30),
  category_id uuid not null references public.categories(id) on delete restrict,
  wallet_id uuid references public.wallets(id) on delete set null,
  notes text check (char_length(notes) <= 5000),
  image_url text check (char_length(image_url) <= 1048576),
  priority text check (priority in ('low', 'medium', 'high')),
  is_historical boolean,
  category_name text check (char_length(category_name) <= 150),
  original_amount numeric check (original_amount >= 0),
  is_refunded boolean,
  refunded_at text check (char_length(refunded_at) <= 30),
  is_due boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.future_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null check (char_length(item_name) <= 150),
  expected_price numeric not null check (expected_price >= 0),
  currency text not null check (currency in ('LYD', 'USD')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  is_purchased boolean not null default false,
  expected_date text check (char_length(expected_date) <= 30),
  category_id uuid references public.categories(id) on delete set null,
  notes text check (char_length(notes) <= 5000),
  matched_expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.savings_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 200),
  currency text not null check (currency in ('LYD', 'USD')),
  total_amount numeric not null check (total_amount >= 0),
  num_members integer not null check (num_members >= 2 and num_members <= 100),
  payment_per_member numeric not null check (payment_per_member >= 0),
  payment_cycle text not null check (payment_cycle in ('monthly', 'weekly', 'custom')),
  start_date text not null check (char_length(start_date) <= 30),
  members jsonb not null default '[]'::jsonb check (jsonb_array_length(members) <= 20),
  receiving_order jsonb not null default '[]'::jsonb check (jsonb_array_length(receiving_order) <= 20),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title_ar text not null check (char_length(title_ar) <= 200),
  title_en text not null check (char_length(title_en) <= 200),
  message_ar text not null check (char_length(message_ar) <= 2000),
  message_en text not null check (char_length(message_en) <= 2000),
  type text not null check (type in ('general', 'saving_group', 'purchase', 'budget')),
  date timestamptz not null default now(),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  user_name text not null check (char_length(user_name) <= 200),
  user_email text not null check (char_length(user_email) <= 200),
  text text not null check (char_length(text) <= 5000),
  created_at timestamptz not null default now()
);

create table public.trash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  deleted_by text not null check (char_length(deleted_by) <= 150),
  original_id uuid not null,
  original_type text not null check (original_type in ('income', 'expense', 'future_purchase', 'savings_group', 'wallet', 'comment')),
  original_data jsonb not null
);

create index incomes_user_id_idx on public.incomes (user_id);
create index expenses_user_id_idx on public.expenses (user_id);
create index categories_user_id_idx on public.categories (user_id);
create index future_purchases_user_id_idx on public.future_purchases (user_id);
create index savings_groups_user_id_idx on public.savings_groups (user_id);
create index notifications_user_id_idx on public.notifications (user_id);
create index wallets_user_id_idx on public.wallets (user_id);
create index comments_user_id_idx on public.comments (user_id);
create index comments_transaction_idx on public.comments (transaction_id, transaction_type);
create index trash_user_id_idx on public.trash (user_id);

-- ============================================================================
-- Timestamp integrity trigger (finding #3) — applied to every table with
-- created_at/updated_at. Overwrites whatever the client sent; a raw REST call
-- setting created_at can't get past this the way it could get past a
-- Firestore rule that only checked the field's *type*.
-- ============================================================================

create or replace function public.set_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  elsif tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  if to_jsonb(new) ? 'updated_at' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles','wallets','categories','incomes','expenses','future_purchases','savings_groups','notifications','comments']
  loop
    execute format('create trigger set_timestamps before insert or update on public.%I for each row execute function public.set_timestamps()', t);
  end loop;
end $$;
-- trash is exempt: it has no update policy at all (immutable once written,
-- same as the old firestore.rules `allow update: if false`), so there is
-- nothing for this trigger to guard.

-- ============================================================================
-- New-user bootstrap — replaces the client-side profile create + 17-category
-- seed loop (AppContext.tsx:365-494, 526-552) with one server-side trigger.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'مستخدم عزيز'),
    coalesce(new.email, '')
  );

  insert into public.categories (user_id, name, type, color, icon) values
    (new.id, 'راتب / Salary', 'income', 'emerald', 'Wallet'),
    (new.id, 'عمل إضافي أو مستقل / Side Hustle', 'income', 'teal', 'Coins'),
    (new.id, 'استثمارات وعوائد / Investments', 'income', 'indigo', 'TrendingUp'),
    (new.id, 'مدخرات أو هدايا / Other Savings', 'income', 'cyan', 'Gift'),
    (new.id, 'إيجار وسكن / Rent & Housing', 'expense', 'rose', 'Home'),
    (new.id, 'تموين ومواد غذائية / Groceries & Food', 'expense', 'amber', 'ShoppingBag'),
    (new.id, 'فواتير وخدمات / Bills & Utilities', 'expense', 'sky', 'Zap'),
    (new.id, 'مواصلات ووقود / Fuel & Cars', 'expense', 'orange', 'Car'),
    (new.id, 'علاج وصحة / Medical & Healthcare', 'expense', 'red', 'Heart'),
    (new.id, 'ترفيه وعائلة / Recreation & Family', 'expense', 'purple', 'Smile'),
    (new.id, 'دراسة وتدريب / Studies & Training', 'expense', 'violet', 'BookOpen'),
    (new.id, 'نفقات أخرى / Other Expenses', 'expense', 'slate', 'BadgeAlert'),
    (new.id, 'إلكترونيات وهواتف / Electronics & Phones', 'purchase', 'indigo', 'Smartphone'),
    (new.id, 'سيارات وصيانة / Vehicles & Auto', 'purchase', 'amber', 'Key'),
    (new.id, 'منزل وأثاث / Home & Furniture', 'purchase', 'emerald', 'Bed'),
    (new.id, 'سفر وتجوال / Travel & Trips', 'purchase', 'purple', 'Compass'),
    (new.id, 'أخرى / Other Purchases', 'purchase', 'slate', 'Box');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security-definer functions in `public` are otherwise callable directly by
-- anon/authenticated (Postgres grants EXECUTE to PUBLIC by default) — this
-- one only makes sense invoked as a trigger, so close that surface off.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================================
-- RLS — every table scoped to its owner. Matches the isOwner()/userId==uid
-- pattern from the old firestore.rules, but structurally simpler: fixed
-- columns mean there's no per-field ghost-field validator to get wrong.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.future_purchases enable row level security;
alter table public.savings_groups enable row level security;
alter table public.notifications enable row level security;
alter table public.comments enable row level security;
alter table public.trash enable row level security;

create policy "select own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- no insert/delete policy: profiles are created only by handle_new_user() (security definer trigger) and cascade-deleted with the auth user.

do $$
declare
  t text;
begin
  foreach t in array array['wallets','categories','incomes','expenses','future_purchases','savings_groups','notifications']
  loop
    execute format('create policy "select own rows" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "insert own rows" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "update own rows" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "delete own rows" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- comments: no update flow exists in the app (addComment/deleteComment only).
create policy "select own comments" on public.comments for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own comments" on public.comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "delete own comments" on public.comments for delete to authenticated using ((select auth.uid()) = user_id);

-- trash: select/insert/delete only — no update policy, matching the old
-- `allow update: if false`. Inserts/deletes normally go through the RPCs
-- below, which run as the calling user and are therefore still bound by
-- these same policies.
create policy "select own trash" on public.trash for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own trash" on public.trash for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "delete own trash" on public.trash for delete to authenticated using ((select auth.uid()) = user_id);

-- ============================================================================
-- Trash RPCs — replace the non-atomic "write trash doc, then delete original"
-- sequence duplicated 6x in AppContext.tsx with one transactional function
-- per direction. security invoker (not definer): the calling user already
-- has INSERT/DELETE via the RLS policies above, so the function only needs
-- to run its two statements as one transaction, not to escalate privilege.
-- ============================================================================

create or replace function public.move_to_trash(p_type text, p_id uuid, p_deleted_by text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table text;
  v_row jsonb;
begin
  v_table := case p_type
    when 'income' then 'incomes'
    when 'expense' then 'expenses'
    when 'future_purchase' then 'future_purchases'
    when 'savings_group' then 'savings_groups'
    when 'wallet' then 'wallets'
    when 'comment' then 'comments'
    else null
  end;
  if v_table is null then
    raise exception 'invalid original_type: %', p_type;
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_table)
    into v_row using p_id;
  if v_row is null then
    raise exception 'row not found: % %', p_type, p_id;
  end if;

  insert into public.trash (user_id, deleted_by, original_id, original_type, original_data)
  values ((select auth.uid()), p_deleted_by, p_id, p_type, v_row);

  execute format('delete from public.%I where id = $1', v_table) using p_id;
end;
$$;

create or replace function public.restore_from_trash(p_trash_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trash public.trash;
  v_table text;
begin
  select * into v_trash from public.trash where id = p_trash_id;
  if v_trash is null then
    raise exception 'trash row not found: %', p_trash_id;
  end if;

  v_table := case v_trash.original_type
    when 'income' then 'incomes'
    when 'expense' then 'expenses'
    when 'future_purchase' then 'future_purchases'
    when 'savings_group' then 'savings_groups'
    when 'wallet' then 'wallets'
    when 'comment' then 'comments'
    else null
  end;
  if v_table is null then
    raise exception 'invalid original_type: %', v_trash.original_type;
  end if;

  -- ponytail: restored rows get a fresh created_at (set_timestamps trigger
  -- overwrites whatever's in original_data on insert) rather than the exact
  -- original creation time — acceptable history loss for a fresh-start
  -- migration, revisit only if audit history ever needs to be exact.
  execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', v_table, v_table)
    using v_trash.original_data;

  delete from public.trash where id = p_trash_id;
end;
$$;

create or replace function public.permanently_delete_trash(p_trash_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trash public.trash;
begin
  select * into v_trash from public.trash where id = p_trash_id;
  if v_trash is null then
    raise exception 'trash row not found: %', p_trash_id;
  end if;

  if v_trash.original_type in ('income', 'expense') then
    delete from public.comments where transaction_id = v_trash.original_id;
  end if;

  delete from public.trash where id = p_trash_id;
end;
$$;
