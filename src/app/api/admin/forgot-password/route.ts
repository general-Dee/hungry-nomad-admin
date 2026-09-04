import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = 'Something went wrong. Please try again later.';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !fromAddress) {
    console.error('Forgot-password requested but Resend is not configured');
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  const admin = getSupabaseAdmin();
  const origin = new URL(request.url).origin;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/admin/reset-password` },
  });

  // Never branch on *why* this failed (e.g. "user not found") in the response --
  // doing so would let a caller enumerate which emails have admin accounts. Log
  // the real reason server-side and always report success to the client.
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('generateLink failed for recovery', linkError);
    return NextResponse.json({ success: true });
  }

  // Don't email the raw action_link -- mail providers (Gmail, corporate
  // proxies) auto-prefetch links in incoming email for phishing scanning,
  // which silently consumes the single-use token before the real user ever
  // clicks. Link to our own confirmation page instead; it only exchanges
  // the token on an actual button click.
  const confirmUrl = `${origin}/admin/reset-password?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: email,
      subject: 'Reset your Hungry Nomad Admin password',
      html: `<p>We received a request to reset your Hungry Nomad admin password.</p><p><a href="${confirmUrl}">Reset your password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    }),
  });

  if (!resendRes.ok) {
    const resendData = await resendRes.json().catch(() => null);
    console.error('Failed to send password reset email', resendData || resendRes.statusText);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
