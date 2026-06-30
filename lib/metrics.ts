import type { DailyMetric } from "./types";
import { fmtMoney, fmtNum, fmtPct } from "./format";

export const CURRENCY = "EGP";

export type Kind = "num" | "money" | "pct";

export interface MetricDef {
  key: string;
  label: string;
  kind: Kind;
  daily: (m: DailyMetric) => number;
  total: (a: Aggregate) => number;
  source: "shopify" | "csv" | "computed";
}

export interface Aggregate {
  visitors: number;
  sessions: number;
  add_to_cart: number;
  reached_checkout: number;
  orders_count: number;
  checkout_count: number;
  total_sales: number;
  total_refunds: number;
  orders_fulfilled: number;
  items_sold: number;
  unpaid_orders: number;
  unpaid_sales: number;
}

/** Ordered exactly like the Google Sheet's top table. */
export const METRICS: MetricDef[] = [
  { key: "visitors", label: "Online Store Visitors", kind: "num", source: "csv", daily: (m) => m.visitors, total: (a) => a.visitors },
  { key: "sessions", label: "Total Sessions", kind: "num", source: "csv", daily: (m) => m.sessions, total: (a) => a.sessions },
  { key: "add_to_cart", label: "Add to Cart", kind: "num", source: "csv", daily: (m) => m.add_to_cart, total: (a) => a.add_to_cart },
  { key: "reached_checkout", label: "Reached Checkout", kind: "num", source: "csv", daily: (m) => m.reached_checkout, total: (a) => a.reached_checkout },
  { key: "orders_count", label: "Orders Count", kind: "num", source: "shopify", daily: (m) => m.orders_count, total: (a) => a.orders_count },
  { key: "checkout_count", label: "Abandoned Checkouts", kind: "num", source: "computed", daily: (m) => m.checkout_count, total: (a) => a.checkout_count },
  {
    key: "abandoned_rate",
    label: "Abandoned Checkout Rate",
    kind: "pct",
    source: "computed",
    daily: (m) => m.abandoned_rate,
    total: (a) => (a.reached_checkout > 0 ? a.checkout_count / a.reached_checkout : 0),
  },
  { key: "total_sales", label: "Total Sales", kind: "money", source: "shopify", daily: (m) => m.total_sales, total: (a) => a.total_sales },
  {
    key: "aov",
    label: "AOV",
    kind: "money",
    source: "shopify",
    daily: (m) => m.aov,
    total: (a) => (a.orders_count > 0 ? a.total_sales / a.orders_count : 0),
  },
  { key: "orders_fulfilled", label: "Orders Fulfilled", kind: "num", source: "shopify", daily: (m) => m.orders_fulfilled, total: (a) => a.orders_fulfilled },
  {
    key: "conversion_rate",
    label: "Conversion Rate",
    kind: "pct",
    source: "computed",
    daily: (m) => m.conversion_rate,
    total: (a) => (a.visitors > 0 ? a.orders_count / a.visitors : 0),
  },
];

export function computeAggregate(metrics: DailyMetric[]): Aggregate {
  const sum = (f: (m: DailyMetric) => number) => metrics.reduce((s, m) => s + Number(f(m)), 0);
  return {
    visitors: sum((m) => m.visitors),
    sessions: sum((m) => m.sessions),
    add_to_cart: sum((m) => m.add_to_cart),
    reached_checkout: sum((m) => m.reached_checkout),
    orders_count: sum((m) => m.orders_count),
    checkout_count: sum((m) => m.checkout_count),
    total_sales: sum((m) => m.total_sales),
    total_refunds: sum((m) => m.total_refunds),
    orders_fulfilled: sum((m) => m.orders_fulfilled),
    items_sold: sum((m) => m.items_sold),
    unpaid_orders: sum((m) => m.unpaid_orders),
    unpaid_sales: sum((m) => m.unpaid_sales),
  };
}

export function fmtByKind(value: number, kind: Kind): string {
  if (kind === "money") return fmtMoney(value, CURRENCY);
  if (kind === "pct") return fmtPct(value);
  return fmtNum(value);
}

export function zeroMetric(day: string): DailyMetric {
  return {
    day,
    month: day.slice(0, 7),
    visitors: 0,
    sessions: 0,
    add_to_cart: 0,
    reached_checkout: 0,
    orders_count: 0,
    checkout_count: 0,
    total_sales: 0,
    total_refunds: 0,
    aov: 0,
    orders_fulfilled: 0,
    items_sold: 0,
    conversion_rate: 0,
    abandoned_rate: 0,
    unpaid_orders: 0,
    unpaid_sales: 0,
  };
}
