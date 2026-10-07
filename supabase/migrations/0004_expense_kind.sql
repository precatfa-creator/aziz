-- A wallet used to mean two things at once: the instrument whose drain you
-- measure (a prepaid card) and the container the money sits in. Withdrawing the
-- card's remaining balance as physical cash separates them — the money left the
-- card, so it is a real expense of the card, but it is still owned.
--
-- One discriminator rather than two booleans (is_withdrawal / paid_from_cash),
-- because those two allow the impossible combination "a withdrawal that was
-- itself paid from cash".
--
--   wallet_spend    money left the card and is gone (ordinary expense)
--   cash_withdrawal money left the card and became cash in hand (still owned)
--   cash_spend      that withdrawn cash is now gone
--
-- Nullable with no default, and null reads as 'wallet_spend'. Every existing
-- row therefore keeps its current meaning and no backfill runs: per wallet,
-- on-card = initial + incomes - wallet_spend - cash_withdrawal, and
-- cash-in-hand = cash_withdrawal - cash_spend, which is 0 for all data written
-- before this migration. Balances are unchanged the moment it lands.

alter table public.expenses
  add column if not exists expense_kind text
  check (expense_kind in ('wallet_spend', 'cash_withdrawal', 'cash_spend'));
