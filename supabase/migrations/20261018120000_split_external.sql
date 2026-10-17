-- Two optional columns on expenses. Both start null on every existing row, so
-- nothing already recorded changes meaning and no backfill runs.
--
-- split_id        The parts of one purchase paid from several places share it,
--                 so the history can show the purchase once with its total and
--                 delete or restore it as one.
--
-- external_source Where a part was paid from outside the app ("ذهب", "Gold").
--                 Such a row has no wallet and is recorded for reference only:
--                 it moves no balance and counts in no spending total. Viewer
--                 functions select by wallet_id, so they never see it.

alter table public.expenses add column if not exists split_id uuid;
alter table public.expenses add column if not exists external_source text;

alter table public.expenses
  add constraint expenses_external_source_check
  check (external_source is null or (wallet_id is null and length(btrim(external_source)) > 0));

create index if not exists expenses_split_id_idx on public.expenses (split_id) where split_id is not null;
