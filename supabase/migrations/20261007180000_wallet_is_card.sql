-- Wallet type. A card holds a balance and can have cash withdrawn from it; a
-- cash wallet is all cash. Every existing wallet was modelled as a card, so the
-- column defaults to true and nothing already recorded is recounted. The app
-- sends false for new wallets unless the user ticks "This is a card".

alter table public.wallets add column if not exists is_card boolean not null default true;

create or replace function public.viewer_wallets()
returns table (
  wallet_id uuid,
  name text,
  color text,
  icon text,
  primary_currency text,
  mode text,
  compartment text,
  owner_name text,
  initial_balance numeric,
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
    -- A cash wallet has no sides to scope: its share is always the whole of it.
    select s.wallet_id, s.mode, case when w.is_card then s.compartment else 'all' end as compartment, w.name, w.color, w.icon, w.currency as primary_currency,
           w.initial_balance, coalesce(p.name, '') as owner_name, w.is_card
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
  -- A compartment-scoped share gets only its own side: the other side comes
  -- back null. The opening balance opens the card, so a cash share omits it.
  select sh.wallet_id, sh.name, sh.color, sh.icon, sh.primary_currency, sh.mode, sh.compartment,
         sh.owner_name,
         case when sh.compartment = 'cash' then null else sh.initial_balance end,
         c.currency,
         -- A cash wallet is all cash, same total (walletBalance() does the same).
         case when sh.compartment = 'cash' or not sh.is_card then null else
           (case when c.currency = sh.primary_currency then sh.initial_balance else 0 end)
             + coalesce(inc.total, 0) - coalesce(exp.card_spend, 0) - coalesce(exp.drawn, 0)
         end as on_card,
         case
           when sh.compartment = 'card' then null
           when not sh.is_card then
             (case when c.currency = sh.primary_currency then sh.initial_balance else 0 end)
               + coalesce(inc.total, 0) - coalesce(exp.card_spend, 0) - coalesce(exp.cash_spend, 0)
           else coalesce(exp.drawn, 0) - coalesce(exp.cash_spend, 0)
         end as in_cash
  from shared sh
  join currencies c on c.wallet_id = sh.wallet_id
  left join inc on inc.wallet_id = sh.wallet_id and inc.currency = c.currency
  left join exp on exp.wallet_id = sh.wallet_id and exp.currency = c.currency
  order by sh.name, (c.currency <> sh.primary_currency), c.currency;
$$;

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
    -- A cash wallet has no sides to scope: its share is always the whole of it.
    select case when w.is_card then s.compartment else 'all' end as compartment
    from public.wallet_shares s
    join public.wallets w on w.id = s.wallet_id
    where s.wallet_id = p_wallet_id and s.viewer_id = auth.uid() and s.mode = 'all'
  ),
  rows as (
    select i.id, 'income'::text as type, i.date, i.amount, i.currency, null::text as expense_kind,
           i.transfer_id is not null as is_transfer, i.category_id, i.category_name, i.created_at
    from public.incomes i where i.wallet_id = p_wallet_id
    union all
    select e.id, 'expense', e.date, case when coalesce(e.is_refunded, false) then 0 else e.amount end,
           e.currency, e.expense_kind, e.transfer_id is not null,
           e.category_id, e.category_name, e.created_at
    from public.expenses e where e.wallet_id = p_wallet_id
  ),
  numbered as (
    -- Oldest first, so "معاملة 1" is the earliest. A new back-dated row
    -- renumbers everything after it.
    select r.*, case when not r.is_transfer
      then row_number() over (partition by r.is_transfer order by r.date, r.created_at, r.id)
    end as n
    from rows r, share sh
    -- Same rule as inCompartment() in src/lib/walletBalance.ts: incomes land
    -- on the card, a withdrawal is in both, untagged expenses are card spends.
    where sh.compartment = 'all'
       or (sh.compartment = 'card' and (r.type = 'income' or coalesce(r.expense_kind, 'wallet_spend') in ('wallet_spend', 'cash_withdrawal')))
       or (sh.compartment = 'cash' and r.type = 'expense' and r.expense_kind in ('cash_withdrawal', 'cash_spend'))
  )
  select n.id, n.type, n.date, n.amount, n.currency, n.expense_kind, n.is_transfer,
         not n.is_transfer,
         case when n.is_transfer then 'تحويل' else 'معاملة ' || n.n end,
         case when n.is_transfer then null else coalesce(c.name, nullif(n.category_name, '')) end,
         null::text
  from numbered n
  left join public.categories c on c.id = n.category_id
  order by n.date desc, n.created_at desc;
$$;
