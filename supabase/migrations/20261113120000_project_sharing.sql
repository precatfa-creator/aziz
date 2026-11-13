-- Shared projects: split 50/50 with one partner.
--
-- is_shared on the project turns the split on. project_settled on a linked
-- expense or income (and `settled` inside a project-only entry's jsonb) marks
-- that the partner has paid their half; false means the user paid it all and
-- is still owed (or, for an income, still owes the partner their half).
-- The flag lives on the row, not as an id list on the project, because a
-- backup restore gives every row a new id.

alter table public.projects
  add column if not exists is_shared boolean not null default false;

alter table public.expenses
  add column if not exists project_settled boolean not null default false;

alter table public.incomes
  add column if not exists project_settled boolean not null default false;
