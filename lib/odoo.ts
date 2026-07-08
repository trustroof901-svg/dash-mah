/** Odoo CDS Analytics Integration — offline (استهلاكي) invoice data. */

export function odooConfig() {
  const base = process.env.ODOO_BASE_URL;
  const key = process.env.ODOO_API_KEY;
  const filter = process.env.ODOO_CUSTOMER_FILTER ?? "استهلاكي";
  if (!base || !key) {
    throw new Error("ODOO_BASE_URL / ODOO_API_KEY are not set in the environment.");
  }
  return { base: base.replace(/\/+$/, ""), key, filter };
}

export interface OdooInvoiceLine {
  customer_name: string;
  customer_id: number;
  product_template: string;
  product_id: number;
  qty: number;
  price_total: number;
  salesperson: string;
  invoice_date: string;
}

/** Fetch all invoice lines from Odoo between two dates (paginated). */
export async function fetchOdooInvoices(dateFrom: string, dateTo: string): Promise<OdooInvoiceLine[]> {
  const { base, key } = odooConfig();
  const all: OdooInvoiceLine[] = [];
  let page = 1;
  const limit = 500;

  // hard cap on pages so a bad response can't loop forever
  for (let guard = 0; guard < 1000; guard++) {
    const res = await fetch(`${base}/api/analytics/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "API-Key": key },
      body: JSON.stringify({ page, limit, date_from: dateFrom, date_to: dateTo }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Odoo ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const j = (await res.json()) as {
      status: string;
      error?: string;
      data?: OdooInvoiceLine[];
      pagination?: { page: number; total_pages: number };
    };
    if (j.status !== "success") throw new Error(j.error || "Odoo returned an error");
    all.push(...(j.data ?? []));
    const p = j.pagination;
    if (!p || page >= p.total_pages) break;
    page += 1;
  }
  return all;
}

export interface OfflineDay {
  day: string;
  invoices: number;
  amount: number;
  items: number;
}

/**
 * Aggregate invoice lines into daily offline totals for the "استهلاكي"
 * customer type. Filters by customer name (the API has no type field) and
 * counts invoices as distinct customers per day (no invoice id available).
 */
export function aggregateOffline(rows: OdooInvoiceLine[], filter: string): OfflineDay[] {
  const f = filter.trim().toLowerCase();
  const byDay = new Map<string, { amount: number; items: number; customers: Set<number> }>();
  for (const r of rows) {
    if (f && !(r.customer_name ?? "").toLowerCase().includes(f)) continue;
    const day = (r.invoice_date ?? "").slice(0, 10);
    if (!day) continue;
    const e = byDay.get(day) ?? { amount: 0, items: 0, customers: new Set<number>() };
    e.amount += Number(r.price_total || 0);
    e.items += Number(r.qty || 0);
    e.customers.add(Number(r.customer_id));
    byDay.set(day, e);
  }
  return [...byDay.entries()]
    .map(([day, e]) => ({ day, invoices: e.customers.size, amount: e.amount, items: e.items }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
