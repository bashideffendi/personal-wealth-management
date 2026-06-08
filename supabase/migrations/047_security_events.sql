-- 047: Security audit log — records sensitive account events (login, password
-- change, 2FA enable/disable) so the user has a visible trail of activity.
-- RLS-scoped: a user can only ever read or insert their own events.

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.security_events enable row level security;

drop policy if exists "read own security events" on public.security_events;
create policy "read own security events" on public.security_events
  for select using (auth.uid() = user_id);

drop policy if exists "insert own security events" on public.security_events;
create policy "insert own security events" on public.security_events
  for insert with check (auth.uid() = user_id);

create index if not exists security_events_user_created_idx
  on public.security_events (user_id, created_at desc);
