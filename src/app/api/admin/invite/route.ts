import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Create the invited user and get the action link, without letting
  // Supabase's own mailer send anything -- we send via Resend instead so
  // delivery status is trackable. redirectTo must be set explicitly: this
  // Supabase project is shared with the customer-facing app, so its default
  // Site URL points there, not here.
  const origin = new URL(request.url).origin;
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: `${origin}/admin` },
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    if (linkError?.code === 'email_exists') {
      return NextResponse.json({ error: 'This person already has admin access.' }, { status: 409 });
    }
    return NextResponse.json({ error: linkError?.message || 'Failed to generate invite link' }, { status: 400 });
  }
  // Don't email the raw action_link -- mail providers (Gmail, corporate
  // proxies) auto-prefetch links in incoming email for phishing scanning,
  // which silently consumes the single-use token before the real user ever
  // clicks. Link to our own confirmation page instead; it only exchanges
  // the token on an actual button click.
  const confirmUrl = `${origin}/admin/accept-invite?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}`;

  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !fromAddress) {
    return NextResponse.json({ error: 'Resend is not configured' }, { status: 500 });
  }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: email,
      subject: "You've been invited to Hungry Nomad Admin",
      html: `<p>You've been invited to join the Hungry Nomad admin panel.</p><p><a href="${confirmUrl}">Accept the invite</a></p>`,
    }),
  });
  const resendData = await resendRes.json().catch(() => null);

  if (!resendRes.ok) {
    // The auth user now exists (generateLink already created it) but no
    // email went out -- record it as 'failed' so it's visible in the
    // invites list rather than silently lost.
    await admin.from('admin_invites').insert({
      email,
      invited_by: user.id,
      invited_by_email: user.email,
      resend_email_id: null,
      status: 'failed',
    });
    return NextResponse.json(
      { error: `Invite link created but email failed to send: ${resendData?.message || resendRes.statusText}` },
      { status: 502 }
    );
  }

  const { error: insertError } = await admin.from('admin_invites').insert({
    email,
    invited_by: user.id,
    invited_by_email: user.email,
    resend_email_id: resendData?.id,
    status: 'sent',
  });
  if (insertError) {
    // The email genuinely went out and the invited user can still accept it
    // -- this isn't a failure of the invite itself, just of our own delivery
    // tracking, so don't report an error. Do surface a warning though, since
    // this invite won't show up in the invites list until that's fixed.
    console.error('Failed to record admin_invites row', insertError);
    return NextResponse.json({
      success: true,
      warning: 'Invite email sent, but its status could not be recorded and it may not appear in the invites list.',
    });
  }

  return NextResponse.json({ success: true });
}
