/**
 * One-time historical backfill of all website orders.
 * Run locally after setting up .env.local:
 *
 *   npm run backfill
 *
 * Loads env from .env.local, then pulls every order from Shopify.
 */
import { config } from "dotenv";
import { runSync } from "../lib/sync";

config({ path: ".env.local" });

(async () => {
  console.log("Starting full backfill from Shopify...");
  const result = await runSync(true);
  console.log("Done:", result);
  process.exit(0);
})().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
