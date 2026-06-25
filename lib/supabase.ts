import { createClient } from "@supabase/supabase-js";

// Read env vars lazily (inside the functions) so that tools which load env
// after import — e.g. the dotenv-based backfill script — work correctly.

/**
 * Browser/anon client — read-only access (RLS allows public select).
 * Safe to use in client components.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}

/**
 * Service-role client — FULL access, bypasses RLS.
 * Server-side ONLY (sync job, backfill). Never import into a client component.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
