-- NOT YET APPLIED -- see supabase/migrations/README.md for the convention.
--
-- Notifies staff by SMS whenever a new order is placed. Orders are inserted
-- by the separate customer-facing app (hungry-nomad) via its own
-- service-role client during checkout -- nothing in this repo's application
-- code runs at that moment. As with trg_orders_activity_log
-- (20260728120000_admin_activity_log.sql), an AFTER INSERT trigger is used
-- because triggers are DB-level and fire regardless of which client/role
-- performed the insert, unlike RLS-gated application code.
--
-- supabase_functions.http_request is the same built-in function the
-- Supabase Dashboard's "Database Webhooks" UI generates for an "HTTP
-- Request" webhook -- no new extension needs enabling. It fires
-- asynchronously (via pg_net under the hood) so the triggering INSERT is
-- not blocked waiting on this repo's API route or on Twilio.
--
-- IMPORTANT before running this in the SQL Editor: replace
-- <YOUR_ADMIN_APP_DOMAIN> and <ORDER_SMS_WEBHOOK_SECRET_VALUE> below with
-- real values (the deployed admin app's HTTPS domain, and this project's
-- ORDER_SMS_WEBHOOK_SECRET env var value). supabase_functions.http_request
-- only accepts a literal headers jsonb value -- it cannot read env vars from
-- inside Postgres -- so the secret has to be pasted in as plain text here.
-- Do NOT commit the real values to git; this file must only ever contain
-- the placeholders below. Rotate the secret if it's ever accidentally
-- committed.

create or replace function public.notify_staff_of_new_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform supabase_functions.http_request(
    'https://<YOUR_ADMIN_APP_DOMAIN>/api/webhooks/order-created',
    'POST',
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-order-sms-webhook-secret', '<ORDER_SMS_WEBHOOK_SECRET_VALUE>'
    ),
    jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(new),
      'old_record', null
    ),
    5000
  );
  return new;
end;
$$;

create trigger trg_notify_staff_of_new_order
  after insert on public.orders
  for each row execute function public.notify_staff_of_new_order();
