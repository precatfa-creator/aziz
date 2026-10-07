-- Receipts used to live inside expenses.image_url / incomes.image_url as
-- "|"-joined Base64 data URLs. That made every boot download every receipt the
-- account had ever taken (8.35 MB across 35 rows in the 2026-07-23 backup),
-- because fetchAllData() selects the whole row. Move the bytes to Storage and
-- keep only short object paths in the column.
--
-- image_url keeps its shape and its 1 MiB check: a "|"-joined list, now of
-- paths like "<user_id>/<uuid>.jpg". Legacy "data:image/..." values stay valid
-- and still render — the client passes them through untouched — so this
-- migration needs no data backfill to be safe. Settings has a button that moves
-- the old rows over; it is re-runnable and skips anything already a path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Private bucket: receipts are financial documents, so every read goes through
-- a signed URL rather than a guessable public one.
--
-- Ownership is the first path segment, matching the auth.uid() = user_id shape
-- the table policies in 0001 use. No update policy: a receipt is written once
-- and replaced by uploading a new object, mirroring the immutable-trash choice.
--
-- Dropped first so the whole file can be pasted again after a partial run —
-- create policy has no "if not exists".
drop policy if exists "select own receipts" on storage.objects;
drop policy if exists "insert own receipts" on storage.objects;
drop policy if exists "delete own receipts" on storage.objects;

create policy "select own receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "insert own receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "delete own receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
