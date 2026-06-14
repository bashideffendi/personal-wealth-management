-- 052 — LOCK billing `subscriptions` RLS to SELECT-only (CRITICAL security fix)
--
-- Bug: migration 036 (digital-subscription tracker, since abandoned) added
-- INSERT/UPDATE/DELETE policies to public.subscriptions — the SAME physical table
-- migration 014 created to hold BILLING ENTITLEMENTS (plan_id, status, expires_at).
-- Karena tabel 014 sudah ada, `create table if not exists` di 036 jadi no-op, tapi
-- policy-nya tetap nempel → user login bisa jalanin dari browser console:
--   supabase.from('subscriptions').update({ plan_id:'full', status:'active',
--     expires_at:'2099-01-01' }).eq('user_id', myId)
-- → self-grant paket berbayar + naikin cap kredit AI, GRATIS (revenue bypass).
--
-- Fix: drop policy write dari client, balik ke posture SELECT-only milik 014.
-- Perubahan plan HANYA boleh dari server/service-role setelah pembayaran terverifikasi
-- (webhook payment gateway). Idempoten & aman diulang.

drop policy if exists "subs_insert" on public.subscriptions;
drop policy if exists "subs_update" on public.subscriptions;
drop policy if exists "subs_delete" on public.subscriptions;

-- Pastikan read-only untuk pemilik baris tetap ada (sama seperti 014).
drop policy if exists "subs_select" on public.subscriptions;
create policy "subs_select" on public.subscriptions
  for select using (auth.uid() = user_id);

-- CATATAN: kalau nanti fitur "tracker langganan digital" (036) dihidupkan lagi,
-- bikin tabel TERPISAH (mis. public.tracked_subscriptions) — JANGAN berbagi tabel
-- dengan billing entitlement.
