-- NOT YET APPLIED. Paste into the Supabase SQL editor.
-- Weekend packages the admin can toggle and edit. Each package has a linked
-- product so checkout can price it the same way as a menu item.

alter table public.products add column if not exists is_available boolean not null default true;

alter table public.products drop constraint if exists products_category_check;

insert into public.products (name, description, price, category, image_url, is_available)
select v.name, v.description, v.price, 'weekend', '', true
from (values
  ('Weekend grill combo for four', 'Fries, chicken, suya, salad and drinks for four people.', 18000),
  ('Weekend special wrap', 'A weekend-only wrap. Edit the price and description before selling.', 4500),
  ('Family platter', 'A sharing platter for the table. Edit the price and what is included before selling.', 22000)
) as v(name, description, price)
where not exists (
  select 1 from public.products p where p.name = v.name and p.category = 'weekend'
);

create table if not exists public.weekend_packages (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  description text not null,
  includes text[] not null default '{}',
  price integer not null check (price >= 0),
  serves text,
  is_active boolean not null default true,
  product_id bigint references public.products(id),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.weekend_packages (slug, name, description, includes, price, serves, is_active, product_id, sort_order)
select 'grill-combo-four', 'Weekend grill combo for four', 'Fries, chicken, suya, salad and drinks for four people.',
  array['Fries', 'Chicken', 'Suya', 'Salad', 'Drinks'], 18000, '4 people', true, p.id, 1
from public.products p
where p.name = 'Weekend grill combo for four' and p.category = 'weekend'
  and not exists (select 1 from public.weekend_packages w where w.slug = 'grill-combo-four');

insert into public.weekend_packages (slug, name, description, includes, price, serves, is_active, product_id, sort_order)
select 'weekend-special-wrap', 'Weekend special wrap', 'A weekend-only wrap. Change the filling and price here.',
  array['Wrap', 'Filling', 'Sauce'], 4500, '1 person', true, p.id, 2
from public.products p
where p.name = 'Weekend special wrap' and p.category = 'weekend'
  and not exists (select 1 from public.weekend_packages w where w.slug = 'weekend-special-wrap');

insert into public.weekend_packages (slug, name, description, includes, price, serves, is_active, product_id, sort_order)
select 'family-platter', 'Family platter', 'A sharing platter. Edit what is on it before you turn it on.',
  array['Rice', 'Protein', 'Sides', 'Drinks'], 22000, 'Family', true, p.id, 3
from public.products p
where p.name = 'Family platter' and p.category = 'weekend'
  and not exists (select 1 from public.weekend_packages w where w.slug = 'family-platter');

alter table public.weekend_packages enable row level security;
drop policy if exists "Public can view active weekend packages" on public.weekend_packages;
create policy "Public can view active weekend packages" on public.weekend_packages
  for select using (is_active = true);
drop policy if exists "Staff can manage weekend packages" on public.weekend_packages;
create policy "Staff can manage weekend packages" on public.weekend_packages
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
