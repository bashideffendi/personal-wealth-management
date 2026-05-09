-- ============================================================
-- 011 — Receipt photo support on transactions
-- - Adds receipt_url column to transactions
-- - Creates Storage bucket "receipts" (private, per-user folder)
-- - RLS so each user can only read/write their own folder
-- ============================================================

-- 1. Column on transactions
alter table public.transactions
  add column if not exists receipt_url text;

-- 2. Create the storage bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 3. RLS policies on storage.objects for the "receipts" bucket
--    Path convention: <user_id>/<filename>
--    Each user can only read/write/delete files under their own user_id folder.

drop policy if exists "Users can upload own receipts" on storage.objects;
create policy "Users can upload own receipts"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can view own receipts" on storage.objects;
create policy "Users can view own receipts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own receipts" on storage.objects;
create policy "Users can update own receipts"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own receipts" on storage.objects;
create policy "Users can delete own receipts"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
