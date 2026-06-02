-- 036_subscriptions.sql
-- Langganan digital (Spotify, Netflix, ChatGPT, dll) — beda dari `contracts`
-- (polis/pinjaman/kerja/properti). Fokus: pelacakan pemakaian + saran cabut.
--
-- IDEMPOTEN (create if not exists + drop/create policy). RLS own-row.
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  provider text not null default '',
  price bigint not null default 0,
  cycle text not null default 'monthly' check (cycle in ('weekly', 'monthly', 'yearly')),
  billing_day int not null default 1,
  -- status review: active = pertahankan, consider = pertimbangkan, cancel = cabut
  status text not null default 'active' check (status in ('active', 'consider', 'cancel')),
  usage_note text not null default '',
  account_id uuid references public.accounts on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;

drop policy if exists "subs_select" on public.subscriptions;
create policy "subs_select" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "subs_insert" on public.subscriptions;
create policy "subs_insert" on public.subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists "subs_update" on public.subscriptions;
create policy "subs_update" on public.subscriptions for update using (auth.uid() = user_id);
drop policy if exists "subs_delete" on public.subscriptions;
create policy "subs_delete" on public.subscriptions for delete using (auth.uid() = user_id);
