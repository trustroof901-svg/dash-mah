import type { DailyMetric, BestSeller } from "./types";
import { fmtMoney, fmtNum, fmtPct } from "./format";

export interface Insight {
  tone: "good" | "bad" | "neutral";
  title: string;
  text: string;
}

/** Derive plain-language insights from the month's data. */
export function buildInsights(metrics: DailyMetric[], bestSellers: BestSeller[]): Insight[] {
  const out: Insight[] = [];
  const withData = metrics.filter((m) => m.orders_count > 0 || m.sessions > 0);
  if (withData.length === 0) return out;

  // Best sales day
  const bestDay = [...metrics].sort((a, b) => b.total_sales - a.total_sales)[0];
  if (bestDay && bestDay.total_sales > 0) {
    out.push({
      tone: "good",
      title: "Best sales day",
      text: `${fmtDate(bestDay.day)} brought ${fmtMoney(bestDay.total_sales)} from ${fmtNum(
        bestDay.orders_count
      )} orders.`,
    });
  }

  // Conversion leader
  const conv = metrics.filter((m) => m.sessions > 0);
  if (conv.length) {
    const best = [...conv].sort((a, b) => b.conversion_rate - a.conversion_rate)[0];
    out.push({
      tone: "neutral",
      title: "Top conversion day",
      text: `${fmtDate(best.day)} converted at ${fmtPct(best.conversion_rate)} (${fmtNum(
        best.orders_count
      )} orders / ${fmtNum(best.sessions)} sessions).`,
    });
  }

  // Abandonment warning
  const ab = metrics.filter((m) => m.reached_checkout > 0);
  if (ab.length) {
    const avgAb =
      ab.reduce((s, m) => s + m.abandoned_rate, 0) / ab.length;
    out.push({
      tone: avgAb > 0.5 ? "bad" : "neutral",
      title: "Checkout abandonment",
      text: `Average abandoned-checkout rate is ${fmtPct(avgAb)} this month${
        avgAb > 0.5 ? " — worth investigating shipping/payment friction." : "."
      }`,
    });
  }

  // Top product
  if (bestSellers[0]) {
    out.push({
      tone: "good",
      title: "Best seller",
      text: `“${bestSellers[0].title}” sold ${fmtNum(Number(bestSellers[0].units_sold))} units.`,
    });
  }

  // Fulfillment
  const totalOrders = metrics.reduce((s, m) => s + m.orders_count, 0);
  const fulfilled = metrics.reduce((s, m) => s + m.orders_fulfilled, 0);
  if (totalOrders > 0) {
    const rate = fulfilled / totalOrders;
    out.push({
      tone: rate >= 0.8 ? "good" : "bad",
      title: "Fulfillment",
      text: `${fmtPct(rate)} of orders fulfilled (${fmtNum(fulfilled)} of ${fmtNum(totalOrders)}).`,
    });
  }

  return out;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
