-- =============================================================
-- Migration v6 — abandoned cart call-center follow-ups
-- Stores why each customer didn't complete checkout + call status.
-- Run after migration_v5.sql.
-- =============================================================

create table if not exists public.abandoned_followups (
  checkout_id text primary key,        -- Shopify checkout id (as text)
  reasons     jsonb not null default '[]'::jsonb,  -- selected reason keys
  call_status text,                    -- e.g. 'not_called','no_answer','will_buy','refused','recovered'
  note        text,
  updated_at  timestamptz not null default now()
);

alter table public.abandoned_followups enable row level security;

-- Open dashboard (no login): allow read + write to anon.
drop policy if exists "read followups" on public.abandoned_followups;
create policy "read followups" on public.abandoned_followups for select using (true);

drop policy if exists "write followups" on public.abandoned_followups;
create policy "write followups" on public.abandoned_followups for all using (true) with check (true);

grant select, insert, update, delete on public.abandoned_followups to anon, authenticated;
