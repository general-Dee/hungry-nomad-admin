-- NOT YET APPLIED. Paste into the Supabase SQL editor.
--
-- Editable menu categories.
--
-- Until now the category list was hardcoded in both apps (admin menu page and
-- the storefront MenuContent). This adds a `categories` table that staff can
-- edit, and links every product to a row in it through `products.category_id`.
--
-- Backward compatibility (important):
--   * `products.category` (the text slug, e.g. 'fast_food') is KEPT and stays
--     the value the storefront filters on and that checkout pricing reads
--     (src/lib/pricing.ts charges the takeaway fee for 'regular' and 'chinese').
--   * A trigger keeps the two columns in sync in both directions:
--       - write `category_id`  -> `category` is set to that category's slug
--       - write only `category` (old admin code, other scripts) -> `category_id`
--         is looked up from the slug
--   * A category's slug is immutable once created (rename changes `name` only),
--     so existing links like /menu?category=fast_food and the pricing rule keep
--     working after a rename.
--   * Categories are never deleted by the app; they are hidden (is_active =
--     false). The storefront hides inactive categories and their items.
--   * Both apps fall back to the old hardcoded list if this table doesn't exist,
--     so the code can ship before or after this file is run.
--
-- Idempotent: safe to run more than once (create ... if not exists, on conflict
-- do nothing, backfill only where category_id is null, drop ... if exists).
-- It does not delete or rename any existing product data.
--
-- Rollback (if ever needed; run by hand):
--   drop trigger if exists trg_products_sync_category on public.products;
--   drop function if exists public.products_sync_category();
--   alter table public.products drop column if exists category_id;
--   drop table if exists public.categories;
--   drop function if exists public.categories_before_update();

begin;

-- 1. Table ------------------------------------------------------------------

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(slug) <= 40),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_sort_order_idx on public.categories (sort_order, id);

-- updated_at + slug immutability
create or replace function public.categories_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'categories.slug is immutable (category %); rename changes name only', old.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_categories_before_update on public.categories;
create trigger trg_categories_before_update
  before update on public.categories
  for each row execute function public.categories_before_update();

-- 2. Seed from the categories already in use --------------------------------
-- Known slugs get the labels and order the apps used before. Any other slug
-- found in products gets a title-cased name and goes after them.

insert into public.categories (name, slug, sort_order, is_active)
values
  ('Fast Food', 'fast_food', 10, true),
  ('Regular Dishes', 'regular', 20, true),
  ('Chinese', 'chinese', 30, true),
  ('Ice Cream', 'icecream', 40, true),
  ('Beverages', 'beverages', 50, true),
  ('Weekend packages', 'weekend', 900, true)
on conflict (slug) do nothing;

insert into public.categories (name, slug, sort_order, is_active)
select
  initcap(replace(d.category, '_', ' ')),
  d.category,
  100 + (row_number() over (order by d.category))::int * 10,
  true
from (
  select distinct p.category
  from public.products p
  where p.category is not null
    and p.category ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
) d
on conflict (slug) do nothing;

-- 3. Link products ----------------------------------------------------------

-- Same as 20261009100000_weekend_packages.sql: an old check constraint limited
-- products.category to the five original slugs, which would block moving items
-- into a new category. No-op if it is already gone.
alter table public.products drop constraint if exists products_category_check;

alter table public.products
  add column if not exists category_id bigint references public.categories(id) on delete set null;

create index if not exists products_category_id_idx on public.products (category_id);

-- Backfill only rows not linked yet (re-running never overwrites a choice).
update public.products p
set category_id = c.id
from public.categories c
where p.category_id is null
  and c.slug = p.category;

-- 4. Keep products.category and products.category_id in sync -----------------

create or replace function public.products_sync_category()
returns trigger
language plpgsql
as $$
declare
  v_slug text;
  v_id bigint;
begin
  if TG_OP = 'UPDATE' then
    if new.category_id is distinct from old.category_id and new.category_id is not null then
      select slug into v_slug from public.categories where id = new.category_id;
      if v_slug is not null then
        new.category := v_slug;
      end if;
    elsif new.category is distinct from old.category then
      select id into v_id from public.categories where slug = new.category;
      new.category_id := v_id;
    end if;
  else -- INSERT
    if new.category_id is not null then
      select slug into v_slug from public.categories where id = new.category_id;
      if v_slug is not null then
        new.category := v_slug;
      end if;
    elsif new.category is not null then
      select id into v_id from public.categories where slug = new.category;
      new.category_id := v_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_sync_category on public.products;
create trigger trg_products_sync_category
  before insert or update of category, category_id on public.products
  for each row execute function public.products_sync_category();

-- 5. Access -----------------------------------------------------------------
-- Everyone (storefront, anon) can read categories, like products.
-- Only staff (app_metadata.role = 'staff', set by the invite flow) can write,
-- matching coupons / weekend_packages. No delete policy: hide instead.

alter table public.categories enable row level security;

drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories" on public.categories
  for select to anon, authenticated
  using (true);

drop policy if exists "Staff can insert categories" on public.categories;
create policy "Staff can insert categories" on public.categories
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

drop policy if exists "Staff can update categories" on public.categories;
create policy "Staff can update categories" on public.categories
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

grant select on public.categories to anon, authenticated;
grant insert, update on public.categories to authenticated;

-- 6. Activity log (only if the activity-log migration has been applied) -------

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'log_admin_activity'
  ) then
    execute 'drop trigger if exists trg_categories_activity_log on public.categories';
    execute 'create trigger trg_categories_activity_log
               after insert or update or delete on public.categories
               for each row execute function public.log_admin_activity()';
  end if;
end;
$$;

commit;

-- 7. Verify (read-only; run after the above) ----------------------------------
-- select slug, name, sort_order, is_active from public.categories order by sort_order;
-- select count(*) filter (where category_id is null) as unlinked, count(*) as total from public.products;
-- select p.category, c.slug from public.products p left join public.categories c on c.id = p.category_id
--   where p.category is distinct from c.slug;   -- expect 0 rows
