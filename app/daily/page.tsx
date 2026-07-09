"use client";

import { useMemo, useState } from "react";
import { useDash } from "@/components/DataProvider";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { METRICS, fmtByKind } from "@/lib/metrics";
import { fmtMoney, fmtNum } from "@/lib/format";

const sourceColor: Record<string, string> = {
  shopify: "emerald",
  csv: "sky",
  computed: "violet",
};

export default function DailyPage() {
  const { metrics, agg, channels, days, offlineDaily, loading } = useDash();
  const [splitDate, setSplitDate] = useState<string>("");

  const activeSplit = splitDate || days[days.length - 1] || "";
  const split = useMemo(() => {
    const forDate = channels.filter((c) => c.order_date === activeSplit);
    const onRow = forDate.find((c) => c.channel === "online");
    const on = { sales: Number(onRow?.sales ?? 0), orders: Number(onRow?.orders ?? 0) };
    // Offline comes from Odoo (offline_sales), not Shopify POS. "orders" here
    // is the invoice count for that day.
    const offRow = offlineDaily.find((r) => r.day === activeSplit);
    const off = { sales: Number(offRow?.amount ?? 0), orders: Number(offRow?.invoices ?? 0) };
    return { on, off, total: { sales: on.sales + off.sales, orders: on.orders + off.orders } };
  }, [channels, offlineDaily, activeSplit]);

  return (
    <div>
      <PageHeader title="Daily Report" description="Every metric, by day, with the month total — matches your sheet." />

      <Card
        className="mb-6"
        title="Daily Numbers"
        subtitle="Green = from Shopify · Blue = imported · Purple = computed"
      >
        {metrics.length === 0 ? (
          <EmptyState loading={loading} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-left font-semibold">Metric</th>
                  {days.map((d) => (
                    <th key={d} className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      {prettyDate(d)}
                    </th>
                  ))}
                  <th className="whitespace-nowrap bg-indigo-700 px-4 py-3 text-center font-semibold">Month Total</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((def, i) => {
                  const highlight = def.key === "total_sales";
                  return (
                    <tr key={def.key} className={i % 2 ? "bg-gray-50/50" : ""}>
                      <th
                        className={`sticky left-0 z-10 px-4 py-2.5 text-left font-medium ${
                          highlight ? "bg-amber-50 text-amber-900" : i % 2 ? "bg-gray-50" : "bg-white"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {def.label}
                          <Badge color={sourceColor[def.source]}>{def.source}</Badge>
                        </span>
                      </th>
                      {metrics.map((m) => (
                        <td key={m.day} className={`px-4 py-2.5 text-center ${highlight ? "bg-amber-50 font-semibold" : ""}`}>
                          {fmtByKind(def.daily(m), def.kind)}
                        </td>
                      ))}
                      <td className={`px-4 py-2.5 text-center font-bold ${highlight ? "bg-amber-100" : "bg-indigo-50"}`}>
                        {fmtByKind(def.total(agg), def.kind)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Offline vs Online"
          subtitle="Offline = Phase 2 (Odoo)"
          action={
            <select
              value={activeSplit}
              onChange={(e) => setSplitDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {prettyDate(d)}
                </option>
              ))}
            </select>
          }
        >
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-2.5">Channel</th>
                <th className="px-5 py-2.5 text-right">Sales Amount</th>
                <th className="px-5 py-2.5 text-right">Sales Orders</th>
              </tr>
            </thead>
            <tbody>
              <SplitRow label="Online" sales={split.on.sales} orders={split.on.orders} />
              <SplitRow label="Offline" sales={split.off.sales} orders={split.off.orders} />
              <SplitRow label="Total" sales={split.total.sales} orders={split.total.orders} bold />
            </tbody>
          </table>
        </Card>

        <Card title="Month Summary">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-gray-100 text-sm">
            <Stat label="Total Sales" value={fmtMoney(agg.total_sales)} />
            <Stat label="Orders" value={fmtNum(agg.orders_count)} />
            <Stat label="AOV" value={fmtMoney(agg.orders_count ? agg.total_sales / agg.orders_count : 0)} />
            <Stat label="Items Sold" value={fmtNum(agg.items_sold)} />
            <Stat label="Visitors" value={fmtNum(agg.visitors)} />
            <Stat label="Sessions" value={fmtNum(agg.sessions)} />
          </dl>
        </Card>
      </div>
    </div>
  );
}

function SplitRow({ label, sales, orders, bold }: { label: string; sales: number; orders: number; bold?: boolean }) {
  return (
    <tr className={`border-t ${bold ? "bg-gray-50 font-bold" : ""}`}>
      <td className="px-5 py-3 font-medium">{label}</td>
      <td className="px-5 py-3 text-right">{fmtMoney(sales)}</td>
      <td className="px-5 py-3 text-right">{fmtNum(orders)}</td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-gray-900">{value}</dd>
    </div>
  );
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
