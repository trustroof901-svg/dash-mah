-- =============================================================
-- Migration v3 — net sales (after refunds)
-- "Total Sales" should reflect Shopify's net figure (current_total_price),
-- i.e. original total minus refunds/returns. Run after migration_v2.sql.
-- =============================================================

alter table public.orders
  add column if not exists net_sales numeric(12,2) not null default 0;

-- For existing rows (synced before this column existed), seed net_sales
-- from total_price so nothing is zero until the next sync refreshes them.
update public.orders set net_sales = total_price where net_sales = 0;

-- ---------- Rebuild views to use net_sales for "Total Sales" ----------
create or replace view public.daily_orders_by_channel as
select
  order_date,
  channel,
  count(*)                                                 as orders,
  coalesce(sum(net_sales), 0)                              as sales,
  count(*) filter (where fulfillment_status = 'fulfilled') as fulfilled,
  coalesce(sum(total_items), 0)                            as items
from public.orders
where cancelled_at is null
group by order_date, channel;

create or replace view public.daily_metrics as
with online as (
  select
    order_date,
    count(*)                                                 as orders,
    coalesce(sum(net_sales), 0)                              as total_sales,
    count(*) filter (where fulfillment_status = 'fulfilled') as fulfilled,
    coalesce(sum(total_items), 0)                            as items_sold
  from public.orders
  where cancelled_at is null and channel = 'online'
  group by order_date
)
select
  coalesce(o.order_date, t.traffic_date)                       as day,
  to_char(coalesce(o.order_date, t.traffic_date), 'YYYY-MM')   as month,
  coalesce(t.visitors, 0)                                      as visitors,
  coalesce(t.sessions, 0)                                      as sessions,
  coalesce(t.add_to_cart, 0)                                   as add_to_cart,
  coalesce(t.reached_checkout, 0)                              as reached_checkout,
  coalesce(o.orders, 0)                                        as orders_count,
  greatest(coalesce(t.reached_checkout, 0) - coalesce(o.orders, 0), 0) as checkout_count,
  coalesce(o.total_sales, 0)                                   as total_sales,
  case when coalesce(o.orders, 0) > 0
       then round(o.total_sales / o.orders, 2) else 0 end      as aov,
  coalesce(o.fulfilled, 0)                                     as orders_fulfilled,
  coalesce(o.items_sold, 0)                                    as items_sold,
  case when coalesce(t.sessions, 0) > 0
       then round(coalesce(o.orders, 0)::numeric / t.sessions, 4) else 0 end as conversion_rate,
  case when coalesce(t.reached_checkout, 0) > 0
       then round(greatest(t.reached_checkout - coalesce(o.orders, 0), 0)::numeric / t.reached_checkout, 4)
       else 0 end                                              as abandoned_rate
from online o
full outer join public.daily_traffic t on t.traffic_date = o.order_date;

grant select on public.daily_orders_by_channel to anon, authenticated;
grant select on public.daily_metrics to anon, authenticated;
