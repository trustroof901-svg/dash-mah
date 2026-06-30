-- =============================================================
-- Migration v8 — expose COD / not-yet-paid orders
--   Adds unpaid_orders + unpaid_sales to daily_metrics.
--   Unpaid = financial_status in (pending, authorized, partially_paid)
--   (COD orders sit as "pending" until delivered/collected).
--   Run after migration_v7.sql.
-- =============================================================

create or replace view public.daily_metrics as
with online as (
  select
    order_date,
    count(*)                                                 as orders,
    coalesce(sum(net_sales), 0)                              as total_sales,
    coalesce(sum(total_price - net_sales), 0)                as total_refunds,
    count(*) filter (where fulfillment_status = 'fulfilled') as fulfilled,
    coalesce(sum(total_items), 0)                            as items_sold,
    count(*) filter (
      where financial_status in ('pending', 'authorized', 'partially_paid')
    )                                                        as unpaid_orders,
    coalesce(sum(net_sales) filter (
      where financial_status in ('pending', 'authorized', 'partially_paid')
    ), 0)                                                    as unpaid_sales
  from public.orders
  where channel = 'online'
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
  coalesce(o.total_refunds, 0)                                 as total_refunds,
  case when coalesce(o.orders, 0) > 0
       then round(o.total_sales / o.orders, 2) else 0 end      as aov,
  coalesce(o.fulfilled, 0)                                     as orders_fulfilled,
  coalesce(o.items_sold, 0)                                    as items_sold,
  case when coalesce(t.visitors, 0) > 0
       then round(coalesce(o.orders, 0)::numeric / t.visitors, 4) else 0 end as conversion_rate,
  case when coalesce(t.reached_checkout, 0) > 0
       then round(greatest(t.reached_checkout - coalesce(o.orders, 0), 0)::numeric / t.reached_checkout, 4)
       else 0 end                                              as abandoned_rate,
  coalesce(o.unpaid_orders, 0)                                 as unpaid_orders,
  coalesce(o.unpaid_sales, 0)                                  as unpaid_sales
from online o
full outer join public.daily_traffic t on t.traffic_date = o.order_date;

grant select on public.daily_metrics to anon, authenticated;
