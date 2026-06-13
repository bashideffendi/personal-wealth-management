-- 051 — Trial 14 → 21 hari (selaraskan dengan copy publik)
--
-- Konteks: copy UI (landing, terms, register) sudah menjanjikan "trial 21 hari",
-- tapi trigger signup di 020 masih memberi `interval '14 days'` → user baru cuma
-- dapat 14 hari (janji ≠ realisasi). RevenueCat: trial 17–32 hari konversi ~1.7×.
--
-- Fix: redefine handle_new_user dengan interval '21 days'. Body lain identik dgn
-- 020 (profile + Cash account + 250 kredit AI). Idempoten (create or replace).
--
-- Catatan: user yang SEDANG trialing tetap pakai expires_at lama (tidak diubah —
-- menghindari mengubah ketentuan retroaktif). Hanya signup baru yang dapat 21 hari.
-- Kalau mau perpanjang trialing existing ke 21 hari, jalankan manual:
--   update public.subscriptions set expires_at = started_at + interval '21 days'
--    where status = 'trialing' and expires_at = started_at + interval '14 days';

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_account_id uuid;
begin
  -- Profile dengan ai_credits 250 (full plan trial)
  insert into public.profiles (id, full_name, ai_credits)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 250);

  -- Default Cash account
  insert into public.accounts (user_id, name, type, starting_balance, current_balance)
  values (new.id, 'Cash', 'cash', 0, 0)
  returning id into new_account_id;

  update public.profiles
     set default_account_id = new_account_id
   where id = new.id;

  -- 21-day trial of Full Service (naik dari 14)
  insert into public.subscriptions (user_id, plan_id, status, started_at, expires_at)
  values (new.id, 'full', 'trialing', now(), now() + interval '21 days');

  -- AI credits seed (250 — full plan amount)
  insert into public.ai_credit_ledger (user_id, delta, reason, balance_after)
  values (new.id, 250, 'signup_trial_bonus', 250);

  return new;
end;
$$ language plpgsql security definer;
