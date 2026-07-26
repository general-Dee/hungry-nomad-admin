-- admin_invites: tracks Resend email delivery status for admin-invite emails,
-- since Supabase's own built-in mailer (auth.admin.inviteUserByEmail) has no
-- delivery-tracking webhooks. This repo has no Supabase CLI/migrations set up
-- (see supabase/rls-policies.sql header) -- run this manually in the
-- Supabase Dashboard > SQL Editor.
--
-- Rows are written exclusively by this repo's server-side service-role
-- client: src/app/api/admin/invite/route.ts (insert on send) and
-- src/app/api/webhooks/resend/route.ts (update on delivery events). Both use
-- getSupabaseAdmin(), which bypasses RLS entirely. The admin UI only ever
-- needs to *read* this table to show delivery status.

create table public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  -- Denormalized on purpose: the anon/authenticated API role has no access
  -- to the auth schema, so joining auth.users from the client isn't
  -- possible. Capturing the inviter's email at insert time avoids that.
  invited_by_email text,
  -- Correlates this row to a Resend send. Null only in the 'failed' case,
  -- where generateLink succeeded (the auth user now exists) but the Resend
  -- API call itself failed before returning an id.
  resend_email_id text,
  status text not null default 'sent'
    check (status in ('sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_invites_resend_email_id_idx on public.admin_invites (resend_email_id);
create index admin_invites_email_idx on public.admin_invites (email);

alter table public.admin_invites enable row level security;

-- Admins can view invite history/status. No insert/update/delete policy for
-- `authenticated` -- unlike products/delivery_zones/orders, this table is
-- never mutated from the browser client; both writers above use the
-- service-role key and bypass RLS, so granting authenticated write access
-- here would only be an unused attack surface.
create policy "Admins can view invites" on public.admin_invites
  for select to authenticated using (true);
