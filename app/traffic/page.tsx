"use client";

import Link from "next/link";
import { useDash } from "@/components/DataProvider";
import { PageHeader, MetricCard } from "@/components/ui";
import { fmtNum, fmtPct } from "@/lib/format";

export default function TrafficPage() {
  const { agg, rangeLabel } = useDash();

  const hasTraffic = agg.sessions > 0 || agg.visitors > 0;
  const orders = agg.orders_count;
  const conv = agg.visitors > 0 ? orders / agg.visitors : 0;
  const cartRate = agg.sessions > 0 ? agg.add_to_cart / agg.sessions : 0;
  const checkoutRate = agg.sessions > 0 ? agg.reached_checkout / agg.sessions : 0;

  return (
    <div>
      <PageHeader title="Traffic & Funnel" description={`Storefront traffic (imported) and the path to purchase — ${rangeLabel}.`} />

      {!hasTraffic && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No traffic data imported for this range yet.{" "}
          <Link href="/import" className="font-semibold underline">
            Import a Shopify Analytics report
          </Link>{" "}
          (Visitors / Sessions / Add to Cart / Reached Checkout).
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Visitors" value={fmtNum(agg.visitors)} icon="👥" accent="violet" formula="Σ unique NS Home visitors from your imported analytics" />
        <MetricCard label="Sessions" value={fmtNum(agg.sessions)} icon="🖱️" accent="sky" formula="Σ sessions from your imported analytics" />
        <MetricCard label="Add-to-Cart Rate" value={fmtPct(cartRate)} icon="🛒" accent="amber" formula={`${fmtNum(agg.add_to_cart)} cart adds ÷ ${fmtNum(agg.sessions)} sessions = ${fmtPct(cartRate)}`} />
        <MetricCard label="Reached-Checkout Rate" value={fmtPct(checkoutRate)} icon="➡️" accent="indigo" formula={`${fmtNum(agg.reached_checkout)} reached checkout ÷ ${fmtNum(agg.sessions)} sessions = ${fmtPct(checkoutRate)}`} />
        <MetricCard label="Conversion Rate" value={fmtPct(conv)} icon="🎯" accent="emerald" formula={`${fmtNum(orders)} orders ÷ ${fmtNum(agg.visitors)} unique NS Home visitors = ${fmtPct(conv)}`} />
      </div>
    </div>
  );
}
