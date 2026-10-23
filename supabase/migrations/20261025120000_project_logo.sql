-- A project's logo, shown on its card. Same storage and shape as a receipt:
-- an object path in the private "receipts" bucket ("<user_id>/<uuid>.jpg"),
-- signed on display, so it needs no bucket or policy of its own. A restored
-- backup may hold an inline "data:image/..." value instead, which renders as is
-- — the same rule image_url follows, with the same 1 MiB cap.

alter table public.projects
  add column if not exists logo_url text check (char_length(logo_url) <= 1048576);
