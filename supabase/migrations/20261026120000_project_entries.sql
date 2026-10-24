-- Project-only money: what a project spent or earned without touching any
-- wallet, category or the ledger ({id, kind, amount, currency, title, date,
-- notes?}). It counts in the project's totals and nowhere else in the app.
--
-- An embedded array, the pattern notes and attachments already use: an entry
-- has no life of its own outside its project.

alter table public.projects
  add column if not exists entries jsonb not null default '[]'::jsonb
  check (jsonb_array_length(entries) <= 2000);
