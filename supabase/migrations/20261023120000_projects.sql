-- Projects: investments and ventures (goods imported to sell, a tech project
-- still without returns) whose cost is followed from the first payment on.
--
-- A project is a tag on money already in the ledger, not a ledger of its own.
-- An expense paid for a project still leaves its wallet exactly as before; the
-- project only groups those rows and sums them, so no balance can drift.
--
-- notes holds the dated steps that carry no money ("the goods reached the
-- port") as an embedded array, the same pattern savings_groups.members uses.
--
-- project_id on expenses/incomes is deliberately not a foreign key. A trashed
-- expense keeps its project_id inside trash.original_data, and restoring it
-- after its project was deleted would fail an FK check and make the expense
-- unrecoverable. A dangling id reads as "no project"; deleteProject also
-- clears the links it leaves behind.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 150),
  description text check (char_length(description) <= 5000),
  notes jsonb not null default '[]'::jsonb check (jsonb_array_length(notes) <= 500),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

alter table public.expenses add column if not exists project_id uuid;
alter table public.incomes add column if not exists project_id uuid;
create index if not exists expenses_project_id_idx on public.expenses (project_id) where project_id is not null;
create index if not exists incomes_project_id_idx on public.incomes (project_id) where project_id is not null;

create trigger set_timestamps before insert or update on public.projects
  for each row execute function public.set_timestamps();

alter table public.projects enable row level security;
create policy "select own rows" on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own rows" on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own rows" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own rows" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

create trigger broadcast_aziz_user_change
  after insert or update or delete on public.projects
  for each row execute function public.broadcast_aziz_user_change();
