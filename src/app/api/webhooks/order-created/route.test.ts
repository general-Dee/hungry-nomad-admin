import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { POST } from './route';

const order = {
  id: 42,
  customer_name: 'Ada Lovelace',
  customer_phone: '+15559990000',
  total_amount: 5000,
  status: 'paid',
  created_at: '2026-08-06T12:00:00.000Z',
};

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/webhooks/order-created', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'x-order-sms-webhook-secret': 'test-secret',
      ...headers,
    },
  });
}

function insertPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'INSERT',
    table: 'orders',
    schema: 'public',
    record: order,
    old_record: null,
    ...overrides,
  };
}

describe('POST /api/webhooks/order-created', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    process.env = {
      ...ORIGINAL_ENV,
      ORDER_SMS_WEBHOOK_SECRET: 'test-secret',
      TERMII_API_KEY: 'test_api_key',
      TERMII_SENDER_ID: 'Termii',
      STAFF_NOTIFICATION_PHONE_NUMBERS: '+15551112222,+15553334444',
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: 'test_message_id' }),
    });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it('returns 500 when ORDER_SMS_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.ORDER_SMS_WEBHOOK_SECRET;

    const response = await POST(makeRequest(insertPayload()));

    expect(response.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret header is missing', async () => {
    const request = new Request('http://localhost:3000/api/webhooks/order-created', {
      method: 'POST',
      body: JSON.stringify(insertPayload()),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret header is wrong', async () => {
    const response = await POST(makeRequest(insertPayload(), { 'x-order-sms-webhook-secret': 'wrong' }));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('acks 200 without calling Termii when the payload is not an orders INSERT', async () => {
    const response = await POST(makeRequest(insertPayload({ type: 'UPDATE' })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('acks 200 without calling Termii when the table is not orders', async () => {
    const response = await POST(makeRequest(insertPayload({ table: 'order_items' })));

    expect(response.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 500 when Termii env vars are missing', async () => {
    delete process.env.TERMII_API_KEY;

    const response = await POST(makeRequest(insertPayload()));

    expect(response.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns 500 when STAFF_NOTIFICATION_PHONE_NUMBERS is empty after parsing', async () => {
    process.env.STAFF_NOTIFICATION_PHONE_NUMBERS = ' , ,';

    const response = await POST(makeRequest(insertPayload()));

    expect(response.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends one Termii request per staff number with the right JSON body', async () => {
    const response = await POST(makeRequest(insertPayload()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, sent: 2, failed: 0 });
    expect(fetch).toHaveBeenCalledTimes(2);

    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.ng.termii.com/api/sms/send');
    expect(options.headers['Content-Type']).toBe('application/json');

    const sentTo = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      ([, opts]) => JSON.parse(opts.body).to
    );
    expect(sentTo).toEqual(['15551112222', '15553334444']);
    const payload = JSON.parse(options.body);
    expect(payload.api_key).toBe('test_api_key');
    expect(payload.from).toBe('Termii');
    expect(payload.channel).toBe('dnd');
    expect(payload.sms).toContain('#42');
    expect(payload.sms).toContain('Ada Lovelace');
  });

  it('returns 200 with a partial-failure summary when some sends fail, attempting every number', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sid: 'SM_ok' }) })
      .mockResolvedValueOnce({ ok: false, statusText: 'Bad Request', json: async () => ({ message: 'invalid number' }) });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(makeRequest(insertPayload()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, sent: 1, failed: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('returns 500 when every Termii send fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'bad credentials' }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(makeRequest(insertPayload()));

    expect(response.status).toBe(500);
  });
});
