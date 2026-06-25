# Shopify Sales Dashboard

Automatically pulls your Shopify **website** orders into Supabase every hour and shows
a filterable dashboard: Total Sales, Invoices, AOV, Items Sold, daily breakdown,
best-selling products, a chart, and **Export to Excel** — mirroring your Google Sheet.

- **Frontend / backend:** Next.js (App Router) + React + TypeScript + Tailwind
- **Database:** Supabase (Postgres)
- **Auto-sync:** Vercel Cron → `/api/sync` (hourly)
- **Access:** open (no login), per your choice

---

## 1. Prerequisites

- Node.js 18+ installed
- A **Supabase** project (free): https://supabase.com
- Your **Shopify Admin API access token** — ⚠️ **rotate the one shared earlier**
  (Shopify Admin → Settings → Apps and sales channels → Develop apps → your app →
  API credentials → *Uninstall/regenerate* to get a fresh `shpat_...` token).

## 2. Create the database

In Supabase: **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
This creates the `orders`, `order_items`, `sync_state` tables, the `daily_sales`
view, and the `best_selling_products` function.

## 3. Configure environment variables

Copy the example and fill in real values:

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `gv7tc1-4b.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Shopify custom app → API credentials (the **new** token) |
| `SHOPIFY_API_VERSION` | leave as `2024-10` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key (secret!) |
| `CRON_SECRET` | any long random string you make up |

> The Shopify token must have **`read_orders`** scope (and `read_products` is helpful).

## 4. Install & run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## 5. Load historical data (first time)

This pulls **all** past website orders into Supabase:

```bash
npm run backfill
```

After that, the hourly sync only fetches new/updated orders.

---

## 6. Deploy to Vercel (auto-sync)

1. Push this folder to a GitHub repo.
2. On https://vercel.com → **New Project** → import the repo.
3. Add the **same env vars** from `.env.local` in Vercel → Project → Settings →
   Environment Variables.
4. Deploy. The cron in [`vercel.json`](vercel.json) runs `/api/sync` **every hour**
   automatically (Vercel sends the `CRON_SECRET` as a Bearer token).

### Trigger a sync manually
```
https://YOUR-APP.vercel.app/api/sync?secret=YOUR_CRON_SECRET
```
Add `&full=1` to re-pull everything.

---

## How the metrics map to your Google Sheet

| Sheet column | Source |
|---|---|
| Month / Date | order created date |
| Total Sales | sum of order `total_price` |
| Total Invoices | count of orders |
| AOV | Total Sales ÷ Total Invoices |
| Items Sold | sum of line-item quantities |
| Best Selling Product | `best_selling_products()` ranked by units |

Cancelled orders are excluded from sales totals.

## Notes & next steps

- Currently tracks **website** orders only (`source_name = 'web'`). To include POS /
  retail branches later, set `onlyWeb: false` in `lib/shopify.ts` and add a branch
  column from the order's `location_id`.
- To add login later, enable Supabase Auth and tighten the RLS policies in
  `schema.sql`.
- The free Vercel plan caps function duration at 60s; very large first backfills are
  best run locally with `npm run backfill`.

## Security

- Real secrets live only in `.env.local` / Vercel env vars — never committed
  (`.gitignore` covers them).
- `service_role` key is used **only** server-side in the sync job.
- ⚠️ Rotate any credential that was shared in plain text.
