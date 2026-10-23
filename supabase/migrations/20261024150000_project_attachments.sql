-- Project attachments: invoices, contracts, photos, spreadsheets.
--
-- The files live in their own private bucket rather than "receipts", which
-- only takes images: a project needs PDFs and office documents too. Ownership
-- is the first path segment ("<user_id>/<uuid>.<ext>"), the same rule the
-- receipts bucket uses, and every read goes through a signed URL.
--
-- The list itself is an embedded array on the project ({id, path, name, type,
-- size, date}), the pattern notes already use: an attachment has no life of
-- its own outside its project.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-files', 'project-files', false, 10485760, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
])
on conflict (id) do nothing;

drop policy if exists "select own project files" on storage.objects;
drop policy if exists "insert own project files" on storage.objects;
drop policy if exists "delete own project files" on storage.objects;

create policy "select own project files" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "insert own project files" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "delete own project files" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.projects
  add column if not exists attachments jsonb not null default '[]'::jsonb
  check (jsonb_array_length(attachments) <= 200);
