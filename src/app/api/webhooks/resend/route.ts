import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const STATUS_BY_EVENT: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RESEND_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Must read the raw body -- the signature is computed over the exact
  // bytes, so this must happen before any JSON parsing.
  const payload = await request.text();
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = new Webhook(secret).verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event;
  } catch (err) {
    console.error('Resend webhook signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const newStatus = event.type ? STATUS_BY_EVENT[event.type] : undefined;
  const emailId = event.data?.email_id;
  if (!newStatus || !emailId) {
    // Unrecognized event type -- ack so Resend doesn't retry pointlessly.
    return NextResponse.json({ received: true });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('admin_invites')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('resend_email_id', emailId)
    .select('id');

  if (error) {
    // Real/transient failure (e.g. DB unreachable) -- 500 so Resend retries.
    console.error('Failed to update admin_invites from webhook', error);
    return NextResponse.json({ error: 'Failed to update invite status' }, { status: 500 });
  }

  if (!data || data.length === 0) {
    // No matching row -- a data-consistency issue, not a transient one, so
    // retrying wouldn't help. Log and ack rather than error.
    console.warn(`No admin_invites row found for resend_email_id=${emailId}`);
  }

  return NextResponse.json({ received: true });
}
