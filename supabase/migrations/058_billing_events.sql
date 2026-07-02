-- 058_billing_events.sql — IDEMPOTEN. Run in Supabase SQL Editor.
--
-- Ledger anti-double-process untuk webhook pembayaran (Xendit). Dipakai supaya
-- callback yang dikirim berkali-kali oleh payment gateway (retry) tidak
-- mengaktifkan subscription / mengirim email ganda.
--
-- Ditulis HANYA oleh service-role (route webhook server). User TIDAK punya akses
-- (RLS enabled, tanpa policy = default deny; service-role bypass RLS & grant).
-- Aman diapply kapan saja walau BILLING_ENABLED masih false — cuma bikin tabel.

create table if not exists public.billing_events (
  id text primary key,                    -- idempotency key: "xendit:<invoice_id>:<status>"
  provider text not null default 'xendit',
  event_type text,                        -- status invoice: PAID / SETTLED / EXPIRED / FAILED
  user_id uuid references auth.users on delete set null,
  payload jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists idx_billing_events_user on public.billing_events (user_id, processed_at desc);

alter table public.billing_events enable row level security;
-- Tanpa policy apa pun → authenticated/anon tidak bisa SELECT/INSERT/UPDATE/DELETE.
revoke insert, update, delete on public.billing_events from authenticated, anon;
