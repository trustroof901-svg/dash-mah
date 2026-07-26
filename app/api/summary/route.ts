import { NextRequest, NextResponse } from "next/server";
import { fetchOdooInvoices, odooConfig } from "@/lib/odoo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Channel summary (like the ops sheet): orders + value per branch for the
 * selected period, MTD and last month. Branches come from the Odoo NS Home
 * invoices, split by `branch` (Website = shopify, physical branches = offline).
 * ?day=YYYY-MM-DD for a single day, or ?from=&to= for a range.
 */

type ChannelType = "Branches" | "Online";
const KNOWN: { test: (b: string) => boolean; label: string; type: ChannelType }[] = [
  { test: (b) => b === "shopify", label: "Website", type: "Online" },
  { test: (b) => b.includes("المعادي") || b.includes("زهراء"), label: "Maadi", type: "Branches" },
  { test: (b) => b.includes("سموحة") || b.includes("الاسكندر"), label: "Semoha", type: "Branches" },
];
function channelOf(branch: string): { label: string; type: ChannelType } {
  const m = KNOWN.find((k) => k.test(branch));
  return m ?? { label: branch || "—", type: "Branches" };
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const { filter } = odooConfig();
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
    const rows = await fetchOdooInvoices(fetchFrom, to);
    const f = filter.trim().toLowerCase();
    const est = rows.filter((r) => !f || (r.customer_type ?? "").toLowerCase().includes(f));

    // Channels present, ordered: physical branches first, Website (online) last.
    const chMap = new Map<string, ChannelType>();
    for (const r of est) {
      const c = channelOf(r.branch ?? "");
      chMap.set(c.label, c.type);
    }
    const channels = [...chMap.entries()]
      .map(([label, type]) => ({ label, type }))
      .sort((a, b) => (a.type === b.type ? a.label.localeCompare(b.label) : a.type === "Online" ? 1 : -1));

    const periodAgg = (pf: string, pt: string) => {
      const res: Record<string, { orders: Set<string>; value: number }> = {};
      for (const c of channels) res[c.label] = { orders: new Set(), value: 0 };
      const tOrders = new Set<string>();
      let tValue = 0;
      for (const r of est) {
        const d = (r.invoice_date ?? "").slice(0, 10);
        if (d < pf || d > pt) continue;
        const label = channelOf(r.branch ?? "").label;
        res[label].orders.add(r.invoice_number);
        res[label].value += Number(r.price_total || 0);
        tOrders.add(r.invoice_number);
        tValue += Number(r.price_total || 0);
      }
      const out: Record<string, { orders: number; value: number }> = {
        Total: { orders: tOrders.size, value: tValue },
      };
      for (const c of channels) out[c.label] = { orders: res[c.label].orders.size, value: res[c.label].value };
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
