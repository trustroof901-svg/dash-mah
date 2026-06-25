-- =============================================================
-- Migration v2 — full sheet layout support
-- Adds: order channel (online/offline), daily_traffic (CSV-imported
-- analytics), and per-channel daily views.
-- Run this once in Supabase SQL Editor (after schema.sql).
-- =============================================================

-- ---------- 1. Channel on orders (online vs offline/POS) ----------
alter table public.orders
  add column if not exists channel text not null default 'online';

create index if not exists orders_channel_idx on public.orders (channel);

-- ---------- 2. Traffic metrics (imported from Shopify Analytics CSV) ----------
-- These cannot be fetched from the Shopify API, so they are uploaded.
create table if not exists public.daily_traffic (
  traffic_date     date primary key,
  visitors         integer not null default 0,   -- Online Store Visitors
  sessions         integer not null default 0,   -- Total Sessions
  add_to_cart      integer not null default 0,   -- Sessions with Add to Cart
  reached_checkout integer not null default 0,   -- Sessions reached checkout
  updated_at       timestamptz not null default now()
);

-- ---------- 3. Daily orders grouped by channel ----------
create or replace view public.daily_orders_by_channel as
select
  order_date,
  channel,
  count(*)                                              as orders,
  coalesce(sum(total_price), 0)                         as sales,
  count(*) filter (where fulfillment_status = 'fulfilled') as fulfilled,
  coalesce(sum(total_items), 0)                         as items
from public.orders
where cancelled_at is null
group by order_date, channel;

-- ---------- 4. Combined daily metrics view (online + traffic) ----------
-- One row per day, mirroring the top table of the Google Sheet.
create or replace view public.daily_metrics as
with online as (
  select
    order_date,
    count(*)                                               as orders,
    coalesce(sum(total_price), 0)                          as total_sales,
    count(*) filter (where fulfillment_status = 'fulfilled') as fulfilled,
    coalesce(sum(total_items), 0)                          as items_sold
  from public.orders
  where cancelled_at is null and channel = 'online'
  group by order_date
)
select
  coalesce(o.order_date, t.traffic_date)            as day,
  to_char(coalesce(o.order_date, t.traffic_date), 'YYYY-MM') as month,
  coalesce(t.visitors, 0)                           as visitors,
  coalesce(t.sessions, 0)                           as sessions,
  coalesce(t.add_to_cart, 0)                        as add_to_cart,
  coalesce(t.reached_checkout, 0)                   as reached_checkout,
  coalesce(o.orders, 0)                             as orders_count,
  -- abandoned checkouts = reached checkout - orders (per sheet logic)
  greatest(coalesce(t.reached_checkout, 0) - coalesce(o.orders, 0), 0) as checkout_count,
  coalesce(o.total_sales, 0)                        as total_sales,
  case when coalesce(o.orders, 0) > 0
       then round(o.total_sales / o.orders, 2) else 0 end as aov,
  coalesce(o.fulfilled, 0)                          as orders_fulfilled,
  coalesce(o.items_sold, 0)                         as items_sold,
  -- conversion rate = orders / sessions
  case when coalesce(t.sessions, 0) > 0
       then round(coalesce(o.orders, 0)::numeric / t.sessions, 4) else 0 end as conversion_rate,
  -- abandoned rate = (reached checkout - orders) / reached checkout
  case when coalesce(t.reached_checkout, 0) > 0
       then round(greatest(t.reached_checkout - coalesce(o.orders, 0), 0)::numeric / t.reached_checkout, 4)
       else 0 end                                   as abandoned_rate
from online o
full outer join public.daily_traffic t on t.traffic_date = o.order_date;

-- ---------- 5. RLS / grants ----------
alter table public.daily_traffic enable row level security;

drop policy if exists "public read traffic" on public.daily_traffic;
create policy "public read traffic" on public.daily_traffic
  for select using (true);

grant select on public.daily_orders_by_channel to anon, authenticated;
grant select on public.daily_metrics to anon, authenticated;
grant select on public.daily_traffic to anon, authenticated;
