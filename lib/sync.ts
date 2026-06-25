import { createServiceClient } from "./supabase";
import { fetchOrders, toOrderRow, toItemRows } from "./shopify";

export interface SyncResult {
  ordersUpserted: number;
  itemsUpserted: number;
  since: string | null;
  newCursor: string | null;
}

/**
 * Incremental sync: pull orders updated since the stored cursor,
 * upsert orders + line items, advance the cursor.
 *
 * @param fullBackfill  when true, ignore the stored cursor and pull everything.
 */
export async function runSync(fullBackfill = false): Promise<SyncResult> {
  const supabase = createServiceClient();

  // 1. Read cursor
  let since: string | null = null;
  if (!fullBackfill) {
    const { data } = await supabase
      .from("sync_state")
      .select("last_synced_at")
      .eq("id", "orders")
      .single();
    since = data?.last_synced_at ?? null;
  }

  // 2. Fetch from Shopify — ONLINE (website) orders only.
  //    Offline/retail sales are Phase 2 (imported from Odoo), not Shopify.
  const orders = await fetchOrders({ updatedAtMin: since, onlyWeb: true });

  let ordersUpserted = 0;
  let itemsUpserted = 0;
  let newCursor = since;

  if (orders.length > 0) {
    const orderRows = orders.map(toOrderRow);
    const itemRows = orders.flatMap(toItemRows);

    // 3. Upsert orders (chunked)
    for (const chunk of chunked(orderRows, 500)) {
      const { error } = await supabase
        .from("orders")
        .upsert(chunk, { onConflict: "id" });
      if (error) throw new Error(`orders upsert: ${error.message}`);
      ordersUpserted += chunk.length;
    }

    // 4. Upsert line items (chunked)
    for (const chunk of chunked(itemRows, 1000)) {
      const { error } = await supabase
        .from("order_items")
        .upsert(chunk, { onConflict: "id" });
      if (error) throw new Error(`order_items upsert: ${error.message}`);
      itemsUpserted += chunk.length;
    }

    // 5. New cursor = max updated_at we saw. We requested order=updated_at asc,
    //    so the last order's updated_at is the high-water mark.
    const maxUpdated = orders
      .map((o) => (o as unknown as { updated_at?: string }).updated_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop();
    newCursor = maxUpdated ?? newCursor;
  }

  // 6. Persist cursor + status
  await supabase
    .from("sync_state")
    .update({
      last_synced_at: newCursor,
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      note: `${ordersUpserted} orders, ${itemsUpserted} items`,
    })
    .eq("id", "orders");

  return { ordersUpserted, itemsUpserted, since, newCursor };
}

function* chunked<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}
