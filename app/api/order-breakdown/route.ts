import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = { count: number; value: number };
const add = (r: Row, v: number) => {
  r.count += 1;
  r.value += v;
};
const zero = (): Row => ({ count: 0, value: 0 });

/**
 * GET /api/order-breakdown?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Detailed live breakdown of Shopify orders in the range — counts + values,
 * split by source (website / paid drafts / other drafts / POS), cancelled,
 * and payment status. Matches how the dashboard counts "online".
 */
export async function GET(req: NextRequest) {
  const store = process.env.SHOPIFY_STORE_DOMAIN!;
  const token = process.env.SHOPIFY_ACCESS_TOKEN!;
  const ver = process.env.SHOPIFY_API_VERSION || "2024-10";
  const headers = { "X-Shopify-Access-Token": token, "Content-Type": "application/json" };

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ error: "start and end required" }, { status: 400 });

  const maxDate = new Date(end + "T00:00:00Z");
  maxDate.setUTCDate(maxDate.getUTCDate() + 1);
  const min = `${start}T00:00:00-00:00`;
  const max = `${maxDate.toISOString().slice(0, 10)}T00:00:00-00:00`;

  try {
    let url: string | null =
      `https://${store}/admin/api/${ver}/orders.json?status=any&limit=250` +
      `&created_at_min=${min}&created_at_max=${max}` +
      `&fields=id,cancelled_at,financial_status,source_name,total_price`;
    type O = { cancelled_at: string | null; financial_status: string | null; source_name: string | null; total_price: string };
    const all: O[] = [];
    while (url) {
      const r: Response = await fetch(url, { headers, cache: "no-store" });
      if (!r.ok) throw new Error(`Shopify ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      all.push(...(j.orders ?? []));
      const m = (r.headers.get("link") || "").match(/<([^>]+)>;\s*rel="next"/);
      url = m ? m[1] : null;
    }

    const isDraft = (s: string | null) => s === "shopify_draft_order";
    const isPos = (s: string | null) => s === "pos";

    const website = zero();
    const draftPaid = zero(); // counted as online
    const draftOther = zero(); // excluded
    const pos = zero();
    const cancelled = zero();
    const total = zero();
    const financial: Record<string, Row> = {};

    for (const o of all) {
      const v = Number(o.total_price || 0);
      add(total, v);
      const fs = o.financial_status || "unknown";
      if (!financial[fs]) financial[fs] = zero();
      add(financial[fs], v);
      if (o.cancelled_at) add(cancelled, v);

      if (isPos(o.source_name)) add(pos, v);
      else if (isDraft(o.source_name)) {
        if (o.financial_status === "paid" && !o.cancelled_at) add(draftPaid, v);
        else add(draftOther, v);
      } else add(website, v);
    }

    // What the dashboard counts as "online" = website + paid drafts.
    const onlineCounted: Row = {
      count: website.count + draftPaid.count,
      value: website.value + draftPaid.value,
    };

    return NextResponse.json({
      ok: true,
      range: { start, end },
      total,
      website,
      draftPaid,
      draftOther,
      pos,
      cancelled,
      onlineCounted,
      financial,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
