-- Per-branch offline (Odoo) daily totals, so the Summary page can read branch
-- splits (Maadi/Semoha/…) from Supabase instead of hitting Odoo live (which
-- times out on Vercel). Orders exclude refunds; value is refund-signed.

create table if not exists offline_branch_sales (
  day        date        not null,
  branch     text        not null,
  orders     integer     not null default 0,
  value      numeric     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, branch)
);

alter table offline_branch_sales enable row level security;

drop policy if exists "offline_branch_sales public read" on offline_branch_sales;
create policy "offline_branch_sales public read"
  on offline_branch_sales for select
  using (true);

grant select on offline_branch_sales to anon, authenticated;
