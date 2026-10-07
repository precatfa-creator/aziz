-- Viewers no longer receive a transaction's category: like the title, it says
-- what the money was for. They keep amount, date, card/cash and the "معاملة N"
-- label. category_name stays in the result (always null) so the return type,
-- and every client reading it, is unchanged.

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
    -- On a cash wallet every row is cash: a card-only share gets none, any
    -- other scope gets all (same rule as inCompartment()).
    select case when w.is_card then s.compartment
                when s.compartment = 'card' then 'none'
                else 'all' end as compartment
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
         null::text,  -- category: not shared (see header)
         null::text
  from numbered n
  order by n.date desc, n.created_at desc;
$$;
