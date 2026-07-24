-- Row Level Security policies for hungry-nomad-admin's Supabase tables.
--
-- This repo has no Supabase CLI/migrations set up, so this file is NOT applied
-- automatically. Run it manually in the Supabase Dashboard > SQL Editor.
--
-- CAVEAT: this only accounts for what the admin app (this repo) needs. If the
-- separate customer-facing app reads order status/confirmation back via the
-- anon key (e.g. an order-tracking page), the `orders` SELECT restriction
-- below will break that flow -- it would need a different mechanism (a
-- server-side route with a scoped lookup, not broad anon SELECT). Review
-- against the customer app before running this.

alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;

-- products: customer-facing menu needs public read; only admins write.
create policy "Public can view products" on public.products
  for select using (true);
create policy "Admins can insert products" on public.products
  for insert to authenticated with check (true);
create policy "Admins can update products" on public.products
  for update to authenticated using (true);
create policy "Admins can delete products" on public.products
  for delete to authenticated using (true);

-- delivery_zones: customer-facing checkout needs public read; only admins write.
create policy "Public can view delivery zones" on public.delivery_zones
  for select using (true);
create policy "Admins can insert delivery zones" on public.delivery_zones
  for insert to authenticated with check (true);
create policy "Admins can update delivery zones" on public.delivery_zones
  for update to authenticated using (true);
create policy "Admins can delete delivery zones" on public.delivery_zones
  for delete to authenticated using (true);

-- orders: customers can create an order anonymously, but only admins can
-- read the order list (contains customer name/phone), change status, or delete.
create policy "Anyone can create an order" on public.orders
  for insert with check (true);
create policy "Admins can view orders" on public.orders
  for select to authenticated using (true);
create policy "Admins can update orders" on public.orders
  for update to authenticated using (true);
create policy "Admins can delete orders" on public.orders
  for delete to authenticated using (true);
