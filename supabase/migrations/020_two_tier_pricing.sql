-- ============================================================
-- 020 — Two-tier paid pricing with 14-day trial
--
-- Strategi baru: hapus tier Free (Solo). Sekarang cuma 2 plan:
--   - Basic         Rp 99.000/bulan  (fitur dasar)
--   - Full Service  Rp 199.000/bulan (semua fitur unlock)
--
-- Signup baru → 14-day trial akses Full Service. Setelah trial
-- berakhir, user wajib pilih plan.
--
-- IMPORTANT: pre-launch, no real billing yet → safe to wipe
-- existing subscriptions and re-trial all current users.
-- ============================================================

-- 1. Tambah 'trialing' ke subscription status check constraint
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active', 'trialing', 'canceled', 'expired', 'pending'));

-- 2. Wipe existing subscriptions (pre-launch)
delete from public.subscriptions;

-- 3. Wipe old plans
delete from public.plans;

-- 4. Insert new 2-tier plans
insert into public.plans (id, name, description, price_idr, original_price_idr, max_seats, features, ai_credits_monthly, is_popular, display_order)
values
  (
    'basic',
    'Basic',
    'Atur keuangan harian dengan fitur dasar.',
    99000,
    0,
    1,
    '[
      "Catat transaksi unlimited",
      "Anggaran bulanan",
      "Dashboard net worth",
      "Foto struk basic (OCR)",
      "Track 1 jenis aset (tabungan)",
      "50 kredit AI/bulan"
    ]'::jsonb,
    50,
    false,
    1
  ),
  (
    'full',
    'Full Service',
    'Akses penuh ke semua fitur Klunting.',
    199000,
    299000,
    4,
    '[
      "Semua fitur Basic",
      "Multi-aset lengkap (saham, RD, crypto, emas, SBN, P2P)",
      "AI Advisor unlimited",
      "AI Receipt Scanner advanced",
      "WhatsApp catat & forward struk (segera)",
      "Family sharing sampai 4 anggota",
      "Atur utang & cicilan (KPR, KTA, kartu kredit)",
      "Goal setting & laporan detail",
      "250 kredit AI/bulan"
    ]'::jsonb,
    250,
    true,
    2
  );

-- 5. Beri semua user existing 14-day trial of Full Service
insert into public.subscriptions (user_id, plan_id, status, started_at, expires_at)
select id, 'full', 'trialing', now(), now() + interval '14 days'
from auth.users;

-- 6. Update handle_new_user trigger
--    Signup baru → 14-day trial Full Service + 250 kredit AI
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

  -- 14-day trial of Full Service
  insert into public.subscriptions (user_id, plan_id, status, started_at, expires_at)
  values (new.id, 'full', 'trialing', now(), now() + interval '14 days');

  -- AI credits seed (250 — full plan amount)
  insert into public.ai_credit_ledger (user_id, delta, reason, balance_after)
  values (new.id, 250, 'signup_trial_bonus', 250);

  return new;
end;
$$ language plpgsql security definer;
