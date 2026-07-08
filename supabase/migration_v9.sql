-- =============================================================
-- Migration v9 — offline (Odoo) sales
--   Stores the daily "استهلاكي" invoice totals synced from Odoo's
--   CDS Analytics API, used for the Online vs Offline split.
-- =============================================================

create table if not exists public.offline_sales (
  day        date primary key,
  invoices   integer not null default 0,  -- distinct customers/day (invoice proxy)
  amount     numeric not null default 0,  -- Σ price_total
  items      numeric not null default 0,  -- Σ qty
  updated_at timestamptz default now()
);

alter table public.offline_sales enable row level security;

drop policy if exists "offline_sales read" on public.offline_sales;
create policy "offline_sales read" on public.offline_sales for select using (true);

grant select on public.offline_sales to anon, authenticated;
