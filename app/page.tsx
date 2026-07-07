"use client";

import Link from "next/link";
import { useDash } from "@/components/DataProvider";
import { Card, EmptyState, PageHeader, Badge, MetricCard } from "@/components/ui";
import { VisitorsPerSession, ChannelDonut, FunnelBars } from "@/components/charts";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { useEffect, useMemo, useState } from "react";

export default function OverviewPage() {
  const { rangeLabel, range, metrics, agg, channels, bestSellers, abandonedCount, loading, error } = useDash();

  const online = channels.filter((c) => c.channel === "online").reduce((s, c) => s + Number(c.sales), 0);
  const offline = channels.filter((c) => c.channel === "offline").reduce((s, c) => s + Number(c.sales), 0);
  // Sales before vs after refunds.
  const salesAfter = Number(agg.total_sales) || 0; // net (after refunds)
  const refunds = Number(agg.total_refunds) || 0;
  const salesBefore = salesAfter + refunds; // gross (before refunds)
  // Real abandoned checkouts from Shopify (not the analytics funnel).
  const totalCheckouts = agg.orders_count + abandonedCount; // checkouts started = completed + abandoned
  const abandoned = totalCheckouts > 0 ? abandonedCount / totalCheckouts : 0;
  const insights = useMemo(() => buildInsights(metrics, bestSellers), [metrics, bestSellers]);

  const funnel = [
    { label: "Visitors", value: agg.visitors },
    { label: "Sessions", value: agg.sessions },
    { label: "Add to Cart", value: agg.add_to_cart },
    { label: "Reached Checkout", value: agg.reached_checkout },
    { label: "Orders", value: agg.orders_count },
  ];

  return (
    <div>
      <PageHeader title="Overview" description={`Key performance for ${rangeLabel}.`} />

      {error && <ErrorBanner msg={error} />}

      {/* KPI cards — only the 6 requested, each showing how it's calculated */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Total Sales (before refund)"
          value={fmtMoney(salesBefore)}
          accent="sky"
          icon="🧾"
          formula={`Gross sales of ${fmtNum(agg.orders_count)} online orders, before any refunds`}
        />
        <MetricCard
          label="Total Sales (after refund)"
          value={fmtMoney(salesAfter)}
          accent="emerald"
          icon="💰"
          formula={`Before refund ${fmtMoney(salesBefore)} − refunds ${fmtMoney(refunds)} = ${fmtMoney(salesAfter)}`}
        />
        <MetricCard
          label="COD / Not Paid Yet"
          value={fmtMoney(agg.unpaid_sales)}
          accent="amber"
          icon="💵"
          formula={`${fmtNum(agg.unpaid_orders)} unpaid orders (COD / pending). Already included in Total Sales.`}
        />
        <MetricCard
          label="Number of Orders"
          value={fmtNum(agg.orders_count)}
          accent="indigo"
          icon="🧾"
          formula="All orders — website + call-center, incl. cancelled/refunded/COD; only POS excluded"
        />
        <MetricCard
          label="Total Checkout"
          value={fmtNum(totalCheckouts)}
          accent="sky"
          icon="🧮"
          formula={`${fmtNum(agg.orders_count)} orders + ${fmtNum(abandonedCount)} abandoned = ${fmtNum(totalCheckouts)}`}
        />
        <MetricCard
          label="Abandoned Checkout"
          value={fmtNum(abandonedCount)}
          accent="amber"
          icon="🛒"
          href="/abandoned"
          formula={`Real Shopify abandoned carts in ${rangeLabel}. Click to view & call →`}
        />
        <MetricCard
          label="Abandoned Checkout Rate"
          value={fmtPct(abandoned)}
          accent="rose"
          icon="📉"
          href="/abandoned"
          formula={`${fmtNum(abandonedCount)} abandoned ÷ ${fmtNum(totalCheckouts)} checkouts = ${fmtPct(abandoned)}`}
        />
      </div>

      <ShopifyBreakdown start={range.start} end={range.end} />

      {/* Sessions per unique visitor + channel split */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Sessions per Unique Visitor (daily)" subtitle={`Bars: visitors & sessions · Line: sessions ÷ unique visitor — ${rangeLabel}`}>
          {metrics.some((m) => Number(m.visitors) > 0 || Number(m.sessions) > 0) ? (
            <VisitorsPerSession data={metrics} />
          ) : (
            <EmptyState
              loading={loading}
              label="No per-day visitors yet. Import a by-day traffic report, or assign an upload to a date on the Import page."
            />
          )}
        </Card>
        <Card title="Online vs Offline" subtitle="Offline arrives in Phase 2 (Odoo)">
          {agg.total_sales > 0 ? (
            <ChannelDonut online={online} offline={offline} />
          ) : (
            <EmptyState loading={loading} />
          )}
        </Card>
      </div>

      {/* Insights + funnel + best sellers */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Insights" className="lg:col-span-1">
          <ul className="divide-y divide-gray-100">
            {insights.map((i, idx) => (
              <li key={idx} className="flex gap-3 px-5 py-3">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    i.tone === "good" ? "bg-emerald-500" : i.tone === "bad" ? "bg-rose-500" : "bg-sky-500"
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-gray-800">{i.title}</div>
                  <div className="text-xs text-gray-500">{i.text}</div>
                </div>
              </li>
            ))}
            {insights.length === 0 && <li className="px-5 py-8 text-center text-sm text-gray-400">No insights yet.</li>}
          </ul>
        </Card>

        <Card title="Conversion Funnel">
          {agg.sessions > 0 ? <FunnelBars steps={funnel} /> : <EmptyState loading={loading} label="Import traffic data to see the funnel." />}
        </Card>

        <Card
          title="Top Products"
          action={
            <Link href="/products" className="text-xs font-medium text-indigo-600 hover:underline">
              View all →
            </Link>
          }
        >
          <ol className="divide-y divide-gray-100">
            {bestSellers.slice(0, 6).map((b, i) => (
              <li key={`${b.product_id}-${i}`} className="flex items-center gap-3 px-5 py-2.5">
                <Badge color={i === 0 ? "amber" : "gray"}>{i + 1}</Badge>
                <span className="flex-1 truncate text-sm text-gray-700" title={b.title}>
                  {b.title}
                </span>
                <span className="text-sm font-semibold text-gray-900">{fmtNum(Number(b.units_sold))}</span>
              </li>
            ))}
            {bestSellers.length === 0 && <li className="px-5 py-8 text-center text-sm text-gray-400">No sales yet.</li>}
          </ol>
        </Card>
      </div>
    </div>
  );
}

interface Row {
  count: number;
  value: number;
}
interface Breakdown {
  total: Row;
  website: Row;
  draftPaid: Row;
  draftOther: Row;
  pos: Row;
  cancelled: Row;
  onlineCounted: Row;
  financial: Record<string, Row>;
}

/** Live Shopify order breakdown for the selected range — detailed table. */
function ShopifyBreakdown({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetch(`/api/order-breakdown?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.ok) setData(j);
        else setErr(j.error || "Failed to load");
      })
      .catch((e) => alive && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [start, end]);

  const TR = ({ label, row, tone, counted, note }: { label: string; row: Row; tone?: string; counted?: boolean; note?: string }) => (
    <tr className={`border-t ${counted ? "bg-indigo-50/40" : ""}`}>
      <td className={`px-4 py-2.5 ${tone ?? "text-gray-700"}`}>
        {label}
        {note && <span className="ml-2 text-xs text-gray-400">{note}</span>}
      </td>
      <td className="px-4 py-2.5 text-right font-medium">{fmtNum(row.count)}</td>
      <td className="px-4 py-2.5 text-right font-medium">{fmtMoney(row.value)}</td>
    </tr>
  );

  return (
    <Card className="mb-6" title="Order Breakdown" subtitle="Live from Shopify for the selected range — counts & values">
      <div className="p-5">
        {loading ? (
          <EmptyState loading label="Loading from Shopify…" />
        ) : err ? (
          <div className="text-sm text-rose-600">{err}</div>
        ) : data ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 text-right">Orders</th>
                    <th className="px-4 py-2 text-right">Value (gross)</th>
                  </tr>
                </thead>
                <tbody>
                  <TR label="🌐 Website orders" row={data.website} tone="text-emerald-700" />
                  <TR label="📞 Call-center drafts — paid" row={data.draftPaid} tone="text-emerald-700" note="counted" />
                  <TR label="📞 Call-center drafts — pending/cancelled" row={data.draftOther} tone="text-gray-600" note="counted" />
                  <TR label="✅ Counted as Online (dashboard)" row={data.onlineCounted} tone="font-semibold text-indigo-700" counted />
                  <TR label="🏬 POS / retail (offline)" row={data.pos} tone="text-gray-400" note="excluded" />
                  <TR label="❌ Cancelled (incl. above)" row={data.cancelled} tone="text-rose-600" />
                  <TR label="📦 All Shopify orders (any source)" row={data.total} tone="font-semibold text-gray-900" />
                </tbody>
              </table>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">By payment status</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Orders</th>
                      <th className="px-4 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.financial)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([k, v]) => (
                        <tr key={k} className="border-t">
                          <td className="px-4 py-2 capitalize text-gray-700">{k.replace(/_/g, " ")}</td>
                          <td className="px-4 py-2 text-right font-medium">{fmtNum(v.count)}</td>
                          <td className="px-4 py-2 text-right font-medium">{fmtMoney(v.value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              The dashboard’s “online” = <strong>website + all call-center orders</strong> (the highlighted row). Only POS/retail is excluded (offline). “Value” is gross (before refunds). Note: Shopify’s Sales report is accrual (returns on the refund day), so its monthly total can still differ slightly.
            </p>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      <strong>Couldn’t load data.</strong> {msg}
      <div className="mt-1 text-xs text-rose-500">
        Make sure the Supabase migrations (v2 &amp; v3) have been run.
      </div>
    </div>
  );
}
