-- =============================================================
-- Shopify Sales Dashboard — Supabase schema
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run
-- =============================================================

-- ---------- Orders (one row per Shopify online order) ----------
create table if not exists public.orders (
  id                bigint primary key,            -- Shopify order id
  order_number      text,                          -- e.g. #1001
  created_at        timestamptz not null,
  processed_at      timestamptz,
  source_name       text,                          -- 'web', 'pos', etc.
  financial_status  text,
  fulfillment_status text,
  currency          text,
  total_price       numeric(12,2) not null default 0,
  subtotal_price    numeric(12,2) not null default 0,
  total_discounts   numeric(12,2) not null default 0,
  total_tax         numeric(12,2) not null default 0,
  total_items       integer not null default 0,    -- sum of line item quantities
  customer_email    text,
  customer_name     text,
  cancelled_at      timestamptz,
  -- store-local date (derived from Shopify created_at by the sync job),
  -- used for daily grouping
  order_date        date not null,
  raw               jsonb,                          -- full payload for safety
  synced_at         timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at);
create index if not exists orders_order_date_idx on public.orders (order_date);
create index if not exists orders_source_name_idx on public.orders (source_name);

-- ---------- Line items (one row per product line within an order) ----------
create table if not exists public.order_items (
  id            bigint primary key,                -- Shopify line item id
  order_id      bigint not null references public.orders(id) on delete cascade,
  product_id    bigint,
  variant_id    bigint,
  title         text,
  variant_title text,
  sku           text,
  quantity      integer not null default 0,
  price         numeric(12,2) not null default 0,
  order_date    date,
  source_name   text
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists order_items_order_date_idx on public.order_items (order_date);

-- ---------- Sync bookkeeping (incremental cursor) ----------
create table if not exists public.sync_state (
  id            text primary key,                  -- 'orders'
  last_synced_at timestamptz,                       -- updated_at high-water mark
  last_run_at   timestamptz,
  last_status   text,
  note          text
);

insert into public.sync_state (id, last_synced_at)
values ('orders', null)
on conflict (id) do nothing;

-- =============================================================
-- Daily summary view — mirrors the Google Sheet columns
-- Total Sales / Total Invoices / AOV / Items Sold per day
-- =============================================================
create or replace view public.daily_sales as
select
  order_date,
  to_char(order_date, 'YYYY-MM')          as month,
  count(*)                                as total_invoices,
  coalesce(sum(total_price), 0)           as total_sales,
  case when count(*) > 0
       then round(coalesce(sum(total_price), 0) / count(*), 2)
       else 0 end                         as aov,
  coalesce(sum(total_items), 0)           as items_sold
from public.orders
where cancelled_at is null
group by order_date
order by order_date;

-- =============================================================
-- Best selling products in a date range (returns ranked list)
-- =============================================================
create or replace function public.best_selling_products(
  start_date date,
  end_date   date,
  max_rows   integer default 20
)
returns table (
  product_id    bigint,
  title         text,
  units_sold    bigint,
  revenue       numeric
)
language sql
stable
as $$
  select
    oi.product_id,
    max(oi.title)                as title,
    sum(oi.quantity)::bigint     as units_sold,
    sum(oi.quantity * oi.price)  as revenue
  from public.order_items oi
  where oi.order_date between start_date and end_date
  group by oi.product_id
  order by units_sold desc
  limit max_rows;
$$;

-- =============================================================
-- Row Level Security
-- Dashboard is public-read (you chose no login). Writes happen
-- only via the service_role key on the server (bypasses RLS).
-- =============================================================
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "public read orders" on public.orders;
create policy "public read orders" on public.orders
  for select using (true);

drop policy if exists "public read order_items" on public.order_items;
create policy "public read order_items" on public.order_items
  for select using (true);

-- allow anon to call the RPC
grant execute on function public.best_selling_products(date, date, integer) to anon, authenticated;
grant select on public.daily_sales to anon, authenticated;
