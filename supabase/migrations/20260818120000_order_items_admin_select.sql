-- ALREADY APPLIED (retroactively catalogued as a migration -- see
-- supabase/migrations/README.md). This repo has no Supabase CLI wired up, so
-- migrations here are not auto-applied; each is pasted into the Supabase
-- Dashboard > SQL Editor once, then committed here as the permanent record.
--
-- order_items has RLS enabled (via the customer-facing app's own script --
-- see hungry-nomad/docs/sql/enable-rls.sql) but no policy was ever added
-- granting `authenticated` (i.e. logged-in admins) read access, unlike
-- `orders` which already got one in
-- supabase/migrations/20260724152536_products_delivery_zones_orders_rls.sql.
-- The admin order-details modal needs to read line items for display, so
-- add the matching select policy here. The customer-facing app still
-- reads/writes order_items exclusively through its service-role client,
-- which bypasses RLS entirely -- this grant does not change that app's
-- behavior.

create policy "Admins can view order items" on public.order_items
  for select to authenticated using (true);
