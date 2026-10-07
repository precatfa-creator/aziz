-- Sharing has two modes now: 'balance' and 'all'. 'all' no longer exposes
-- what a transaction was: every row's title becomes "معاملة N" (numbered
-- oldest first) and notes are dropped. Amount, date, category and card/cash
-- stay. Transfers keep the generic "تحويل" and lose their category, as before.
--
-- The per-transaction "hide from viewers" flag has nothing left to do; the
-- column stays so existing data and backups round-trip unchanged.

update public.wallet_shares set mode = 'all' where mode = 'partial';

alter table public.wallet_shares drop constraint if exists wallet_shares_mode_check;
alter table public.wallet_shares add constraint wallet_shares_mode_check check (mode in ('balance', 'all'));

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
  with rows as (
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
    from rows r
    where exists (
      select 1 from public.wallet_shares s
      where s.wallet_id = p_wallet_id and s.viewer_id = auth.uid() and s.mode = 'all'
    )
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
