-- Secure, per-account realtime synchronization for Aziz.
--
-- Database changes are broadcast to a private topic that contains the row
-- owner's auth user id. The realtime.messages policy only lets that same user
-- join the topic, so another account cannot listen to these changes.

create policy "aziz users can receive their own database changes"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'aziz:user:' || (select auth.uid())::text
);

create or replace function public.broadcast_aziz_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_row jsonb;
  owner_id uuid;
begin
  changed_row := case
    when tg_op = 'DELETE' then to_jsonb(old)
    else to_jsonb(new)
  end;

  owner_id := case
    when tg_table_name = 'profiles'
      then (changed_row ->> 'id')::uuid
    else (changed_row ->> 'user_id')::uuid
  end;

  perform realtime.broadcast_changes(
    'aziz:user:' || owner_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  return null;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'wallets',
    'categories',
    'incomes',
    'expenses',
    'future_purchases',
    'savings_groups',
    'notifications',
    'comments',
    'trash'
  ]
  loop
    execute format(
      'create trigger broadcast_aziz_user_change '
      'after insert or update or delete on public.%I '
      'for each row execute function public.broadcast_aziz_user_change()',
      table_name
    );
  end loop;
end
$$;
