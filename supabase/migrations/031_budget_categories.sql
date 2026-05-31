-- Hierarchical, ordered budget categories (kategori → subkategori) per user.
--
-- Stored as ONE row per (user_id, type) holding an ordered JSONB tree, so
-- edit / delete / drag-reorder are a single upsert. Budget AMOUNTS in
-- public.budgets stay string-keyed by category name (a subcategory uses the
-- composite key "Kategori > Subkategori"), so this migration does NOT touch or
-- migrate any existing budget data — it only adds the category structure.
--
-- tree JSONB shape:
--   [ { "id": "<uuid>", "name": "Makanan",
--       "subs": [ { "id": "<uuid>", "name": "Restoran" }, ... ] }, ... ]
--
-- Safe to run multiple times (idempotent guards). RLS: each user only sees and
-- writes their own rows.

create table if not exists public.budget_categories (
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in ('income', 'expense', 'saving', 'investment')),
  tree       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

alter table public.budget_categories enable row level security;

drop policy if exists "budget_categories_select_own" on public.budget_categories;
create policy "budget_categories_select_own"
  on public.budget_categories for select
  using (auth.uid() = user_id);

drop policy if exists "budget_categories_insert_own" on public.budget_categories;
create policy "budget_categories_insert_own"
  on public.budget_categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "budget_categories_update_own" on public.budget_categories;
create policy "budget_categories_update_own"
  on public.budget_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budget_categories_delete_own" on public.budget_categories;
create policy "budget_categories_delete_own"
  on public.budget_categories for delete
  using (auth.uid() = user_id);
