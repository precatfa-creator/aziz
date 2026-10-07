-- Transfers and currency exchanges are not income and not spending. Money
-- changes wallet, or changes currency, but the amount owned does not change.
--
-- Both halves are still ordinary rows — an expense on the source side, an
-- income on the destination side — so every balance, wallet filter, receipt and
-- backup path keeps working untouched. `transfer_id` is what pairs them: two
-- rows carrying the same value are two legs of one movement, and a row with a
-- null value is an ordinary transaction, which is every row written until now.
--
-- Why pair rows instead of adding a `transfers` table: the legs already need to
-- live in `expenses` and `incomes` for wallet balances to see them at all. A
-- third table would mean every balance, report and backup learns a third row
-- shape, to express something the two existing shapes already express.
--
-- Deliberately not a foreign key to anything. The pairing is symmetric — there
-- is no parent leg and no child leg — and it spans two tables, which no single
-- reference can describe. The client writes both legs or rolls back the first.
--
-- Not stored, because the two legs already say it: the exchange rate is
-- out_amount / in_amount. 912 LYD paired with 100 USD is a rate of 9.12, and
-- storing that separately only creates a third number that can disagree.

alter table public.expenses add column if not exists transfer_id uuid;
alter table public.incomes  add column if not exists transfer_id uuid;

-- Reading a transfer always means fetching its other leg, and pairs are a tiny
-- fraction of rows, so the partial index stays small.
create index if not exists expenses_transfer_id_idx
  on public.expenses (transfer_id) where transfer_id is not null;
create index if not exists incomes_transfer_id_idx
  on public.incomes (transfer_id) where transfer_id is not null;
