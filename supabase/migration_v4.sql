-- =============================================================
-- Migration v4 — monthly traffic totals
-- For Shopify reports that have NO per-day breakdown (e.g.
-- "Sessions by landing page"): we sum all rows into one monthly
-- total. Used for the "Month Total" column + monthly conversion.
-- Run after migration_v3.sql.
-- =============================================================

create table if not exists public.monthly_traffic (
  month            text primary key,            -- 'YYYY-MM'
  visitors         integer not null default 0,
  sessions         integer not null default 0,
  add_to_cart      integer not null default 0,
  reached_checkout integer not null default 0,
  updated_at       timestamptz not null default now()
);

alter table public.monthly_traffic enable row level security;

drop policy if exists "public read monthly_traffic" on public.monthly_traffic;
create policy "public read monthly_traffic" on public.monthly_traffic
  for select using (true);

grant select on public.monthly_traffic to anon, authenticated;
