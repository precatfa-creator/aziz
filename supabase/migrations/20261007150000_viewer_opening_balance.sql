-- Viewers see the wallet's opening balance (wallets.initial_balance, the
-- "الافتتاحي" figure on the owner's wallet card) in every share mode. It is a
-- property of the wallet, not a transaction, so balance-only shares get it too.
--
-- Adding an output column changes the function's return type, which
-- `create or replace` cannot do — drop and recreate, then restore the grants.

drop function if exists public.viewer_wallets();

create function public.viewer_wallets()
returns table (
  wallet_id uuid,
  name text,
  color text,
  icon text,
  primary_currency text,
  mode text,
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
         sh.initial_balance, c.currency,
         (case when c.currency = sh.primary_currency then sh.initial_balance else 0 end)
           + coalesce(inc.total, 0) - coalesce(exp.card_spend, 0) - coalesce(exp.drawn, 0) as on_card,
         coalesce(exp.drawn, 0) - coalesce(exp.cash_spend, 0) as in_cash
  from shared sh
  join currencies c on c.wallet_id = sh.wallet_id
  left join inc on inc.wallet_id = sh.wallet_id and inc.currency = c.currency
  left join exp on exp.wallet_id = sh.wallet_id and exp.currency = c.currency
  order by sh.name, (c.currency <> sh.primary_currency), c.currency;
$$;

revoke execute on function public.viewer_wallets() from public, anon;
grant execute on function public.viewer_wallets() to authenticated;
