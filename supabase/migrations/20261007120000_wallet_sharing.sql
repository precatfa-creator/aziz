-- Wallet sharing: view-only "viewer" accounts that see only the wallets an
-- owner shares with them, in one of three modes.
--
--   balance  — totals only; no transaction row ever leaves the database.
--   all      — every transaction, in full.
--   partial  — every transaction, but rows flagged hidden_from_viewers arrive
--              as "معاملة N" with only amount, date and currency.
--
-- Viewer accounts are created server-side (api/viewers.ts, service role) with
-- app_metadata.role = 'viewer'. app_metadata is not writable by the user, so
-- a viewer cannot promote itself and an owner cannot become a viewer.
--
-- Redaction happens here, not in the client: RLS is row-level only and cannot
-- strip a column, so viewers get no table access at all and read through two
-- security-definer functions that return exactly what their share allows.

-- ============================================================================
-- Viewer role
-- ============================================================================

create or replace function public.is_viewer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'viewer', false);
$$;

-- Every existing "own rows" policy matches any signed-in user, viewers
-- included — a viewer could otherwise create its own wallets through the REST
-- API and use the whole app. A restrictive policy is ANDed with all of them.
do $$
declare
  t text;
begin
  foreach t in array array['profiles','wallets','categories','incomes','expenses','future_purchases','savings_groups','notifications','comments','trash']
  loop
    execute format('drop policy if exists "viewers have no table access" on public.%I', t);
    execute format(
      'create policy "viewers have no table access" on public.%I as restrictive for all to authenticated '
      'using (not (select public.is_viewer())) with check (not (select public.is_viewer()))',
      t
    );
  end loop;
end $$;

-- Receipts are never shared. Scoped to the receipts bucket so other buckets
-- keep their own rules.
drop policy if exists "viewers have no receipt access" on storage.objects;
create policy "viewers have no receipt access" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'receipts' or not (select public.is_viewer()))
  with check (bucket_id <> 'receipts' or not (select public.is_viewer()));

-- A viewer gets no profile and no seeded categories: they own nothing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'viewer' then
    return new;
  end if;

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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================================
-- Tables
-- ============================================================================

alter table public.expenses add column if not exists hidden_from_viewers boolean;
alter table public.incomes  add column if not exists hidden_from_viewers boolean;

-- One row per viewer account; id is the viewer's auth user id. Written only by
-- api/viewers.ts with the service role, so there is no insert/update policy.
create table if not exists public.viewers (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (char_length(email) <= 150),
  name text not null check (char_length(name) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists viewers_owner_id_idx on public.viewers (owner_id);

create table if not exists public.wallet_shares (
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  viewer_id uuid not null references public.viewers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('balance', 'all', 'partial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wallet_id, viewer_id)
);
create index if not exists wallet_shares_viewer_id_idx on public.wallet_shares (viewer_id);

drop trigger if exists set_timestamps on public.wallet_shares;
create trigger set_timestamps before insert or update on public.wallet_shares
  for each row execute function public.set_timestamps();

alter table public.viewers enable row level security;
alter table public.wallet_shares enable row level security;

drop policy if exists "owner reads own viewers" on public.viewers;
create policy "owner reads own viewers" on public.viewers for select to authenticated
  using ((select auth.uid()) = owner_id);

-- An owner may share only a wallet they own, only with a viewer they created.
drop policy if exists "owner manages own shares" on public.wallet_shares;
create policy "owner manages own shares" on public.wallet_shares for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = (select auth.uid()))
    and exists (select 1 from public.viewers v where v.id = viewer_id and v.owner_id = (select auth.uid()))
  );

-- ============================================================================
-- Viewer reads
-- ============================================================================

-- One row per shared wallet per currency it holds, with the same compartment
-- math as src/lib/walletBalance.ts: incomes (opening rows excluded, transfers
-- in included) land on the card; wallet_spend and withdrawals leave it;
-- withdrawals arrive as cash and cash_spend leaves it.
create or replace function public.viewer_wallets()
returns table (
  wallet_id uuid,
  name text,
  color text,
  icon text,
  primary_currency text,
  mode text,
  owner_name text,
  currency text,
  on_card numeric,
  in_cash numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with shared as (
    select s.wallet_id, s.mode, w.name, w.color, w.icon, w.currency as primary_currency,
           w.initial_balance, coalesce(p.name, '') as owner_name
    from public.wallet_shares s
    join public.wallets w on w.id = s.wallet_id
    left join public.profiles p on p.id = s.owner_id
    where s.viewer_id = auth.uid()
  ),
  currencies as (
    select sh.wallet_id, sh.primary_currency as currency from shared sh
    union
    select i.wallet_id, i.currency from public.incomes i join shared sh on sh.wallet_id = i.wallet_id
    union
    select e.wallet_id, e.currency from public.expenses e join shared sh on sh.wallet_id = e.wallet_id
  ),
  inc as (
    select i.wallet_id, i.currency, sum(i.amount) filter (where not coalesce(i.is_opening, false)) as total
    from public.incomes i join shared sh on sh.wallet_id = i.wallet_id
    group by i.wallet_id, i.currency
  ),
  exp as (
    -- mapExpense reads a refunded row's amount as 0; mirror it.
    select e.wallet_id, e.currency,
      sum(case when coalesce(e.is_refunded, false) then 0 else e.amount end)
        filter (where coalesce(e.expense_kind, 'wallet_spend') = 'wallet_spend') as card_spend,
      sum(case when coalesce(e.is_refunded, false) then 0 else e.amount end)
        filter (where e.expense_kind = 'cash_withdrawal') as drawn,
      sum(case when coalesce(e.is_refunded, false) then 0 else e.amount end)
        filter (where e.expense_kind = 'cash_spend') as cash_spend
    from public.expenses e join shared sh on sh.wallet_id = e.wallet_id
    group by e.wallet_id, e.currency
  )
  select sh.wallet_id, sh.name, sh.color, sh.icon, sh.primary_currency, sh.mode, sh.owner_name,
         c.currency,
         (case when c.currency = sh.primary_currency then sh.initial_balance else 0 end)
           + coalesce(inc.total, 0) - coalesce(exp.card_spend, 0) - coalesce(exp.drawn, 0) as on_card,
         coalesce(exp.drawn, 0) - coalesce(exp.cash_spend, 0) as in_cash
  from shared sh
  join currencies c on c.wallet_id = sh.wallet_id
  left join inc on inc.wallet_id = sh.wallet_id and inc.currency = c.currency
  left join exp on exp.wallet_id = sh.wallet_id and exp.currency = c.currency
  order by sh.name, (c.currency <> sh.primary_currency), c.currency;
$$;

-- Transactions of one shared wallet. Returns nothing for a balance-only share
-- or a wallet not shared with the caller. Receipts are never returned, and a
-- transfer's title, category and notes are dropped so nothing about the other
-- wallet leaks.
create or replace function public.viewer_wallet_transactions(p_wallet_id uuid)
returns table (
  id uuid,
  type text,
  date text,
  amount numeric,
  currency text,
  expense_kind text,
  is_transfer boolean,
  is_masked boolean,
  title text,
  category_name text,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  with share as (
    select s.mode from public.wallet_shares s
    where s.wallet_id = p_wallet_id and s.viewer_id = auth.uid() and s.mode <> 'balance'
  ),
  rows as (
    select i.id, 'income'::text as type, i.date, i.amount, i.currency, null::text as expense_kind,
           i.transfer_id is not null as is_transfer, coalesce(i.hidden_from_viewers, false) as hidden,
           i.title, i.category_id, i.category_name, i.notes, i.created_at
    from public.incomes i where i.wallet_id = p_wallet_id
    union all
    select e.id, 'expense', e.date, case when coalesce(e.is_refunded, false) then 0 else e.amount end,
           e.currency, e.expense_kind, e.transfer_id is not null,
           coalesce(e.hidden_from_viewers, false),
           e.title, e.category_id, e.category_name, e.notes, e.created_at
    from public.expenses e where e.wallet_id = p_wallet_id
  ),
  shaped as (
    select r.*, (r.hidden and (select mode from share) = 'partial') as masked
    from rows r
    where exists (select 1 from share)
  ),
  numbered as (
    -- Numbered oldest first, so "معاملة 1" is the earliest hidden row. Hiding
    -- or unhiding an older row renumbers the newer ones.
    select s.*, case when s.masked
      then row_number() over (partition by s.masked order by s.date, s.created_at, s.id)
    end as n
    from shaped s
  )
  select n.id, n.type, n.date, n.amount, n.currency, n.expense_kind, n.is_transfer, n.masked,
         case
           when n.masked then 'معاملة ' || n.n
           when n.is_transfer then 'تحويل'
           else n.title
         end,
         case when n.masked or n.is_transfer then null else coalesce(c.name, nullif(n.category_name, '')) end,
         case when n.masked or n.is_transfer then null else nullif(n.notes, '') end
  from numbered n
  left join public.categories c on c.id = n.category_id
  order by n.date desc, n.created_at desc;
$$;

revoke execute on function public.viewer_wallets() from public, anon;
revoke execute on function public.viewer_wallet_transactions(uuid) from public, anon;
grant execute on function public.viewer_wallets() to authenticated;
grant execute on function public.viewer_wallet_transactions(uuid) to authenticated;
