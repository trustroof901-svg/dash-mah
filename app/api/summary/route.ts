import { NextRequest, NextResponse } from "next/server";
import { fetchOdooInvoices, odooConfig, isRefund } from "@/lib/odoo";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Channel summary (like the ops sheet): orders + value per channel for the
 * selected period, MTD and last month.
 *  - Physical branches (Maadi, Semoha, …) come from the Odoo NS Home invoices.
 *  - Online ("Website") comes from Shopify (daily_metrics: total_sales,
 *    orders_count) — the same numbers as the rest of the dashboard.
 * ?day=YYYY-MM-DD for a single day, or ?from=&to= for a range.
 */

const WEBSITE = "Website";
const KNOWN: { test: (b: string) => boolean; label: string }[] = [
  { test: (b) => b.includes("المعادي") || b.includes("زهراء"), label: "Maadi" },
  { test: (b) => b.includes("سموحة") || b.includes("الاسكندر"), label: "Semoha" },
];
function branchLabel(branch: string): string {
  return KNOWN.find((k) => k.test(branch))?.label ?? branch ?? "—";
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const { filter, excludeBranches } = odooConfig();
    const sp = req.nextUrl.searchParams;
    const day = sp.get("day");
    const from = sp.get("from") || day || ymd(new Date());
    const to = sp.get("to") || day || from;

    // Reference = end date → derive MTD and last-month windows from it.
    const [ey, em] = to.split("-").map(Number);
    const monthStart = `${ey}-${String(em).padStart(2, "0")}-01`;
    const lm = new Date(Date.UTC(ey, em - 2, 1)); // previous month
    const lmStart = ymd(new Date(Date.UTC(lm.getUTCFullYear(), lm.getUTCMonth(), 1)));
    const lmEnd = ymd(new Date(Date.UTC(lm.getUTCFullYear(), lm.getUTCMonth() + 1, 0)));

    const fetchFrom = [from, monthStart, lmStart].sort()[0];

    // --- Branches: Odoo invoices, online (shopify) branch excluded ---
    const rows = await fetchOdooInvoices(fetchFrom, to);
    const f = filter.trim().toLowerCase();
    const skip = new Set(excludeBranches.map((b) => b.toLowerCase()));
    const est = rows.filter(
      (r) =>
        (!f || (r.customer_type ?? "").toLowerCase().includes(f)) &&
        !skip.has((r.branch ?? "").toLowerCase())
    );

    // --- Online: Shopify daily_metrics (same source as the dashboard) ---
    const sb = createServiceClient();
    const { data: dmRows } = await sb
      .from("daily_metrics")
      .select("day,total_sales,orders_count")
      .gte("day", fetchFrom)
      .lte("day", to);
    const online = (dmRows ?? []) as { day: string; total_sales: number; orders_count: number }[];

    // Channels: physical branches (sorted) first, then Website (online).
    const branchLabels = [...new Set(est.map((r) => branchLabel(r.branch ?? "")))].sort((a, b) =>
      a.localeCompare(b)
    );
    const channels = [
      ...branchLabels.map((label) => ({ label, type: "Branches" as const })),
      { label: WEBSITE, type: "Online" as const },
    ];

    const periodAgg = (pf: string, pt: string) => {
      const res: Record<string, { orders: Set<string>; value: number }> = {};
      for (const label of branchLabels) res[label] = { orders: new Set(), value: 0 };
      // Branches from Odoo — refunds (R-prefix) subtract and aren't counted as orders.
      for (const r of est) {
        const d = (r.invoice_date ?? "").slice(0, 10);
        if (d < pf || d > pt) continue;
        const label = branchLabel(r.branch ?? "");
        const refund = isRefund(r.invoice_number);
        res[label].value += Number(r.price_total || 0) * (refund ? -1 : 1);
        if (!refund) res[label].orders.add(r.invoice_number);
      }
      // Online from Shopify daily_metrics
      let webOrders = 0;
      let webValue = 0;
      for (const m of online) {
        const d = (m.day ?? "").slice(0, 10);
        if (d < pf || d > pt) continue;
        webOrders += Number(m.orders_count || 0);
        webValue += Number(m.total_sales || 0);
      }

      const out: Record<string, { orders: number; value: number }> = {};
      let tOrders = 0;
      let tValue = 0;
      for (const label of branchLabels) {
        out[label] = { orders: res[label].orders.size, value: res[label].value };
        tOrders += res[label].orders.size;
        tValue += res[label].value;
      }
      out[WEBSITE] = { orders: webOrders, value: webValue };
      tOrders += webOrders;
      tValue += webValue;
      out.Total = { orders: tOrders, value: tValue };
      return out;
    };

    return NextResponse.json({
      ok: true,
      channels,
      period: periodAgg(from, to),
      mtd: periodAgg(monthStart, to),
      lastMonth: periodAgg(lmStart, lmEnd),
      meta: { from, to, monthStart, lmStart, lmEnd, single: from === to },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
