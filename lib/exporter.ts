import { METRICS, Aggregate } from "./metrics";
import type { DailyMetric, ChannelSales, BestSeller } from "./types";

function round(v: number, kind: string): number {
  if (kind === "pct") return Number((v * 100).toFixed(2));
  return Number(Number(v).toFixed(2));
}

/** Build & download a multi-sheet .xlsx mirroring the dashboard. */
export async function exportWorkbook(opts: {
  month: string;
  metrics: DailyMetric[];
  agg: Aggregate;
  channels: ChannelSales[];
  bestSellers: BestSeller[];
}) {
  const { month, metrics, agg, channels, bestSellers } = opts;
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Daily numbers — metrics as rows, days as columns + Month Total
  const days = metrics.map((m) => m.day);
  const header = ["Metric", ...days, "Month Total"];
  const body = METRICS.map((def) => {
    const row: (string | number)[] = [def.label];
    for (const m of metrics) row.push(round(def.daily(m), def.kind));
    row.push(round(def.total(agg), def.kind));
    return row;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), "Daily Numbers");

  // Offline vs Online by day
  const byDate = new Map<string, { on: { s: number; o: number }; off: { s: number; o: number } }>();
  for (const c of channels) {
    const e = byDate.get(c.order_date) ?? { on: { s: 0, o: 0 }, off: { s: 0, o: 0 } };
    if (c.channel === "online") e.on = { s: Number(c.sales), o: Number(c.orders) };
    else e.off = { s: Number(c.sales), o: Number(c.orders) };
    byDate.set(c.order_date, e);
  }
  const splitRows: (string | number)[][] = [
    ["Date", "Online Sales", "Online Orders", "Offline Sales", "Offline Orders", "Total Sales", "Total Orders"],
  ];
  for (const [date, e] of [...byDate.entries()].sort()) {
    splitRows.push([
      date,
      e.on.s,
      e.on.o,
      e.off.s,
      e.off.o,
      e.on.s + e.off.s,
      e.on.o + e.off.o,
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(splitRows), "Offline vs Online");

  // Best sellers
  const best = XLSX.utils.json_to_sheet(
    bestSellers.map((b, i) => ({
      Rank: i + 1,
      Product: b.title,
      "Units Sold": Number(b.units_sold),
      Revenue: Number(b.revenue),
    }))
  );
  XLSX.utils.book_append_sheet(wb, best, "Best Sellers");

  XLSX.writeFile(wb, `sales_dashboard_${month}.xlsx`);
}
