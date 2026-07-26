-- ALREADY APPLIED (retroactively catalogued as a migration -- see
-- supabase/migrations/README.md). This repo has no Supabase CLI wired up, so
-- migrations here are not auto-applied; each is pasted into the Supabase
-- Dashboard > SQL Editor once, then committed here as the permanent record.
--
-- Row Level Security policies for hungry-nomad-admin's Supabase tables.
--
-- Reviewed against the separate customer-facing app (hungry-nomad) --
-- specifically hungry-nomad/docs/sql/enable-rls.sql and
-- hungry-nomad/docs/PLATFORM-CONTRACT.md sec7. That app creates, reads, and
-- updates `orders`/`order_items` exclusively through its own server-only
-- service-role client (src/lib/supabaseAdmin.ts), which bypasses RLS
-- entirely and never touches the anon key -- so the `authenticated`-only
-- restrictions below do not break its checkout/track/verify-payment flows.
-- Its own script enables RLS on `orders`/`order_items` as default-deny for
-- `anon` (zero policies granted), on purpose: anon order creation would let
-- anyone POST an arbitrary total_amount straight to Supabase's REST API,
-- bypassing that app's server-derived pricing and Paystack verification.
-- This file must not grant `anon`/`public` any access to `orders` for the
-- same reason -- this admin app only ever needs the `authenticated` role,
-- since admins sign in via Supabase Auth and act as that role once logged
-- in.

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

-- orders: no anon/public policy of any kind. Order creation is handled
-- exclusively by the customer-facing app's service-role client (see header
-- comment) -- this repo must not grant INSERT to anon/public here, or it
-- reopens the price-tampering hole that app's RLS setup deliberately closes.
-- Only admins (authenticated, via Supabase Auth) get any access to this
-- table from this repo: viewing the order list, changing status, or deleting.
create policy "Admins can view orders" on public.orders
  for select to authenticated using (true);
create policy "Admins can update orders" on public.orders
  for update to authenticated using (true);
create policy "Admins can delete orders" on public.orders
  for delete to authenticated using (true);
