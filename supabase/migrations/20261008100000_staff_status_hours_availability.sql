-- NOT YET APPLIED. Paste into the Supabase SQL editor. Not auto-applied.
-- Covers sold-out, kitchen notes, editable hours, staff-only RLS, and
-- a guard so authenticated users cannot mark an order paid.

alter table public.products add column if not exists is_available boolean not null default true;
alter table public.orders add column if not exists customer_note text;

create table if not exists public.store_settings (
  id integer primary key,
  open_minutes integer not null default 660,
  close_minutes integer not null default 1290,
  closed_override boolean not null default false,
  hours_label text not null default '11:00am – 9:30pm'
);
insert into public.store_settings (id) values (1) on conflict (id) do nothing;
alter table public.store_settings enable row level security;
drop policy if exists "Public can view store settings" on public.store_settings;
create policy "Public can view store settings" on public.store_settings for select using (true);
drop policy if exists "Staff can update store settings" on public.store_settings;
create policy "Staff can update store settings" on public.store_settings
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

-- Replace broad authenticated policies with staff-role policies.
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;
create policy "Staff can insert products" on public.products for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
create policy "Staff can update products" on public.products for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
create policy "Staff can delete products" on public.products for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

drop policy if exists "Admins can insert delivery zones" on public.delivery_zones;
drop policy if exists "Admins can update delivery zones" on public.delivery_zones;
drop policy if exists "Admins can delete delivery zones" on public.delivery_zones;
create policy "Staff can insert delivery zones" on public.delivery_zones for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
create policy "Staff can update delivery zones" on public.delivery_zones for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
create policy "Staff can delete delivery zones" on public.delivery_zones for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

drop policy if exists "Admins can view orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can delete orders" on public.orders;
create policy "Staff can view orders" on public.orders for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');
create policy "Staff can update orders" on public.orders for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff');

-- Staff may not set paid, and may not edit money columns.
create or replace function public.guard_order_staff_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' or auth.role() = 'supabase_admin' then
    return new;
  end if;
  if new.total_amount is distinct from old.total_amount
     or new.delivery_fee is distinct from old.delivery_fee
     or new.payment_reference is distinct from old.payment_reference then
    raise exception 'Staff cannot edit order totals or payment reference';
  end if;
  if new.status = 'paid' and old.status is distinct from 'paid' then
    raise exception 'Only a verified Paystack payment can mark an order paid';
  end if;
  if not (
    (old.status = 'paid' and new.status = 'delivered')
    or (old.status = 'pending' and new.status = 'failed')
    or old.status = new.status
  ) then
    raise exception 'Illegal order status transition';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_order_staff_update on public.orders;
create trigger trg_guard_order_staff_update
  before update on public.orders
  for each row execute function public.guard_order_staff_update();

-- Staff SMS on paid, not on insert. Replace placeholders before running.
create or replace function public.notify_staff_of_paid_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform supabase_functions.http_request(
      'https://<YOUR_ADMIN_APP_DOMAIN>/api/webhooks/order-created',
      'POST',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-order-sms-webhook-secret', '<ORDER_SMS_WEBHOOK_SECRET_VALUE>'
      ),
      jsonb_build_object(
        'type', 'UPDATE',
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', to_jsonb(new),
        'old_record', to_jsonb(old)
      ),
      5000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_staff_of_new_order on public.orders;
drop trigger if exists trg_notify_staff_of_paid_order on public.orders;
create trigger trg_notify_staff_of_paid_order
  after update on public.orders
  for each row execute function public.notify_staff_of_paid_order();

-- Abandoned checkouts. Schedule this in Supabase, or run it by hand.
create or replace function public.fail_abandoned_pending_orders()
returns integer
language plpgsql
security definer
as $$
declare
  updated_count integer;
begin
  update public.orders
  set status = 'failed'
  where status = 'pending'
    and created_at < now() - interval '6 hours';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- Existing staff accounts will not match the new policies until this is set.
-- update auth.users set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role','staff') where email in ('you@hungrynomad.ng');
