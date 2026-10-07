-- The original app treats a transaction's category as optional (the exported
-- backup has ~72% of incomes/expenses with no category). 0001 made category_id
-- NOT NULL, which is stricter than the real data. Relax it so restored data
-- round-trips faithfully. The FK (ON DELETE RESTRICT) still applies to non-null
-- values, so a set category still can't be deleted out from under a transaction.
alter table public.incomes  alter column category_id drop not null;
alter table public.expenses alter column category_id drop not null;
