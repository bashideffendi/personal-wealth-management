-- Migration 022 — stock_research_cache: shared cache untuk AI-generated
-- equity research per ticker. First user yang generate bayar AI credits;
-- user lain dapet free dari cache.
--
-- Bedanya dengan markdown bundled (BBCA.md, GTSI.md): yang bundled itu
-- pre-curated, yang ini hasil generate Claude on-demand dari data laporan
-- keuangan yang udah ada di server.

create table if not exists public.stock_research_cache (
  ticker text primary key,
  content text not null,
  frontmatter jsonb not null default '{}',
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users,
  model text not null default 'claude-haiku-4-5',
  input_tokens integer,
  output_tokens integer
);

alter table public.stock_research_cache enable row level security;

-- Anyone authenticated bisa baca cache
create policy "research_cache_read_all" on public.stock_research_cache
  for select using (auth.uid() is not null);

-- Insert/upsert dilakukan via API route pakai service-role atau RLS yang
-- dilonggarin (di sini: pemilik auth.uid sebagai generated_by saja yang
-- bisa upsert)
create policy "research_cache_upsert_own" on public.stock_research_cache
  for insert with check (auth.uid() = generated_by);

create policy "research_cache_update_own" on public.stock_research_cache
  for update using (auth.uid() = generated_by);

create index if not exists stock_research_generated_at_idx
  on public.stock_research_cache(generated_at desc);
