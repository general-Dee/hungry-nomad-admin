-- NOT YET APPLIED -- see supabase/migrations/README.md for the convention.
--
-- Fixes a bug in log_admin_activity() (20260728120000_admin_activity_log.sql):
-- TG_OP is always uppercase ('INSERT'/'UPDATE'/'DELETE'), but the old_data/
-- new_data case expressions compared it against lowercase literals
-- ('insert'/'update'/'delete'), so those comparisons never matched and both
-- columns were always written as null regardless of action. Confirmed live:
-- creating a test product produced a row with old_data = new_data = null.
-- (The `action` column itself was unaffected -- it explicitly used
-- lower(tg_op) already.)
--
-- create or replace function is sufficient here; the existing triggers on
-- products/delivery_zones/orders already point at this function by name and
-- don't need to be recreated.

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
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    auth.uid(),
    auth.email()
  );
  return coalesce(new, old);
end;
$$;
