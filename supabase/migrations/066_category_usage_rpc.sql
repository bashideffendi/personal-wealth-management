-- 066_category_usage_rpc.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- RPC hitung pemakaian kategori (jumlah transaksi per type+category) DI SERVER.
-- Dulu loadCategoryUsage narik SEMUA baris transaksi sepanjang masa cuma buat
-- di-count per kategori di client — boros bandwidth DAN kena cap 1000 row
-- PostgREST, jadi begitu transaksi user lewat 1000 hitungannya salah diam-diam.
--
-- Aman diapply kapan saja. Kode app pakai fallback: kalau fungsi ini belum ada,
-- jatuh ke perilaku lama (tidak ada urutan-deploy yang bisa bikin live rusak).

-- Pemakaian kategori: owner-only (scope auth.uid())
create or replace function public.category_usage()
returns table(type text, category text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.type, t.category, count(*)::bigint
    from public.transactions t
   where t.user_id = auth.uid()
   group by 1, 2
$$;
revoke all on function public.category_usage() from public, anon;
grant execute on function public.category_usage() to authenticated;
