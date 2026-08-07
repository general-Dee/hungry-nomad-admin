import { NextResponse } from 'next/server';

interface OrderRecord {
  id: number;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface DatabaseWebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: OrderRecord;
  old_record?: OrderRecord | null;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ORDER_SMS_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error('ORDER_SMS_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const providedSecret = request.headers.get('x-order-sms-webhook-secret');
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as DatabaseWebhookPayload | null;
  const order = payload?.record;
  if (payload?.type !== 'INSERT' || payload?.table !== 'orders' || !order) {
    // Not the shape we expect -- ack rather than error, since retrying
    // wouldn't change a malformed/unexpected payload.
    return NextResponse.json({ received: true });
  }

  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID;
  const staffNumbersRaw = process.env.STAFF_NOTIFICATION_PHONE_NUMBERS;
  if (!apiKey || !senderId || !staffNumbersRaw) {
    console.error('Termii / staff notification env vars are not fully configured');
    return NextResponse.json({ error: 'SMS notification not configured' }, { status: 500 });
  }

  const staffNumbers = staffNumbersRaw.split(',').map((n) => n.trim()).filter(Boolean);
  if (staffNumbers.length === 0) {
    console.error('STAFF_NOTIFICATION_PHONE_NUMBERS is empty after parsing');
    return NextResponse.json({ error: 'No staff numbers configured' }, { status: 500 });
  }

  const body =
    `New order #${order.id} from ${order.customer_name} (${order.customer_phone}) -- ` +
    `₦${order.total_amount.toLocaleString()} -- status: ${order.status}`;

  const termiiUrl = 'https://api.ng.termii.com/api/sms/send';

  const results = await Promise.allSettled(
    staffNumbers.map(async (to) => {
      const res = await fetch(termiiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          to: to.replace(/^\+/, ''),
          from: senderId,
          sms: body,
          type: 'plain',
          channel: 'dnd',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(`Termii send to ${to} failed: ${data?.message || res.statusText}`);
      }
      return to;
    })
  );

  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected'
  );
  if (failures.length > 0) {
    // Per-recipient send failures (e.g. a bad number) are logged but don't
    // fail the whole request -- one bad number shouldn't block delivery to
    // the rest of the staff list, and Supabase has no meaningful way to
    // retry a partial failure anyway.
    failures.forEach((f) => console.error(f.reason));
  }
  if (failures.length === staffNumbers.length) {
    // Every send failed -- treat this as a real/transient failure so
    // Supabase's webhook delivery retries (e.g. Termii outage, bad auth).
    return NextResponse.json({ error: 'All SMS sends failed' }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    sent: staffNumbers.length - failures.length,
    failed: failures.length,
  });
}
