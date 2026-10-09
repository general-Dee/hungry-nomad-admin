-- NOT YET APPLIED. Paste into the Supabase SQL editor.
-- Coupons are validated only by the storefront service role. Staff manage them.

create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  code text unique not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  min_subtotal integer not null default 0,
  max_uses integer,
  uses_count integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount integer not null default 0;

alter table public.coupons enable row level security;
drop policy if exists "Staff can manage coupons" on public.coupons;
create policy "Staff can manage coupons" on public.coupons
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
