import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/order-breakdown?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Live breakdown of Shopify orders in the range (by source, cancelled,
 * financial status) — the same numbers Shopify's admin shows.
 */
export async function GET(req: NextRequest) {
  const store = process.env.SHOPIFY_STORE_DOMAIN!;
  const token = process.env.SHOPIFY_ACCESS_TOKEN!;
  const ver = process.env.SHOPIFY_API_VERSION || "2024-10";
  const headers = { "X-Shopify-Access-Token": token, "Content-Type": "application/json" };

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }
  // end is inclusive → add a day for the exclusive max
  const maxDate = new Date(end + "T00:00:00Z");
  maxDate.setUTCDate(maxDate.getUTCDate() + 1);
  const min = `${start}T00:00:00-00:00`;
  const max = `${maxDate.toISOString().slice(0, 10)}T00:00:00-00:00`;

  try {
    let url: string | null =
      `https://${store}/admin/api/${ver}/orders.json?status=any&limit=250` +
      `&created_at_min=${min}&created_at_max=${max}` +
      `&fields=id,cancelled_at,financial_status,source_name`;
    const all: { cancelled_at: string | null; financial_status: string | null; source_name: string | null }[] = [];
    while (url) {
      const r: Response = await fetch(url, { headers, cache: "no-store" });
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`Shopify ${r.status}: ${body.slice(0, 200)}`);
      }
      const j = await r.json();
      all.push(...(j.orders ?? []));
      const link = r.headers.get("link") || "";
      const m = link.match(/<([^>]+)>;\s*rel="next"/);
      url = m ? m[1] : null;
    }

    const isDraft = (s: string | null) => s === "shopify_draft_order";
    const isPos = (s: string | null) => s === "pos";
    const web = all.filter((o) => !isDraft(o.source_name) && !isPos(o.source_name)).length;
    const draft = all.filter((o) => isDraft(o.source_name)).length;
    const pos = all.filter((o) => isPos(o.source_name)).length;
    const cancelled = all.filter((o) => o.cancelled_at).length;

    const fin: Record<string, number> = {};
    for (const o of all) {
      const k = o.financial_status || "unknown";
      fin[k] = (fin[k] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      range: { start, end },
      total: all.length,
      web,
      draft,
      pos,
      cancelled,
      financial: fin,
      countedInDashboard: web, // dashboard counts website orders (drafts excluded)
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
