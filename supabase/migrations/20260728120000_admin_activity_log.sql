-- NOT YET APPLIED -- see supabase/migrations/README.md for the convention:
-- paste this into the Supabase Dashboard SQL Editor once, then update this
-- header comment to "ALREADY APPLIED" in the same commit as any follow-up.
--
-- admin_activity_log: audit trail for admin-driven changes to products,
-- delivery_zones, and orders. These tables are mutated directly from the
-- browser (anon-key client, see src/lib/supabaseClient.ts) under permissive
-- RLS -- see 20260724152536_products_delivery_zones_orders_rls.sql -- so
-- there is currently no record of who changed what. Rather than adding a
-- logging call to every save/delete handler (easy to forget on a future
-- mutation), this is captured with an AFTER trigger on each table, so it's
-- automatic and can't be bypassed from the client.
--
-- Note: `orders` rows are also inserted by the separate customer-facing
-- app's service-role client during checkout (no admin session involved) --
-- those rows will have changed_by/changed_by_email = null, which the admin
-- UI should render as "System", not attribute to a specific admin.

create table public.admin_activity_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  -- Cast to text so this works uniformly regardless of each table's PK type.
  record_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  -- Denormalized on purpose, same reasoning as admin_invites.invited_by_email:
  -- the authenticated/anon API roles have no access to the auth schema, so
  -- joining auth.users from the client isn't possible.
  changed_by_email text,
  created_at timestamptz not null default now()
);

create index admin_activity_log_created_at_idx on public.admin_activity_log (created_at desc);
create index admin_activity_log_table_name_idx on public.admin_activity_log (table_name);

alter table public.admin_activity_log enable row level security;

-- Admins can view the log. Deliberately no insert/update/delete policy for
-- authenticated/anon -- rows are written exclusively by the security-definer
-- trigger function below, so an admin's own browser session can't forge or
-- erase history via a direct client call.
create policy "Admins can view activity log" on public.admin_activity_log
  for select to authenticated using (true);

-- security definer so this can insert into admin_activity_log even though
-- the calling role (authenticated) has no grant there. This only changes
-- which role's privileges apply for the insert -- auth.uid()/auth.email()
-- still resolve from the calling request's JWT, not the function owner, so
-- the captured identity is still the real admin who made the change.
create or replace function public.log_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_activity_log
    (table_name, record_id, action, old_data, new_data, changed_by, changed_by_email)
  values (
    tg_table_name,
    coalesce((new).id, (old).id)::text,
    lower(tg_op),
    case when tg_op in ('update', 'delete') then to_jsonb(old) else null end,
    case when tg_op in ('insert', 'update') then to_jsonb(new) else null end,
    auth.uid(),
    auth.email()
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_products_activity_log
  after insert or update or delete on public.products
  for each row execute function public.log_admin_activity();

create trigger trg_delivery_zones_activity_log
  after insert or update or delete on public.delivery_zones
  for each row execute function public.log_admin_activity();

create trigger trg_orders_activity_log
  after insert or update or delete on public.orders
  for each row execute function public.log_admin_activity();
