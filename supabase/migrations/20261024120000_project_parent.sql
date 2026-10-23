-- Sub-projects: a project may sit under another one ("China goods" under
-- "Trading"). Each keeps its own transactions; the parent can show its own
-- figures or roll its sub-projects' figures into them.
--
-- A real FK this time (unlike expenses.project_id): projects never go through
-- the trash, so there is no restore to break. Deleting a parent lifts its
-- sub-projects to the top level instead of deleting them.

alter table public.projects
  add column if not exists parent_id uuid references public.projects(id) on delete set null;

alter table public.projects
  add constraint projects_parent_not_self check (parent_id is null or parent_id <> id);

create index if not exists projects_parent_id_idx on public.projects (parent_id) where parent_id is not null;
