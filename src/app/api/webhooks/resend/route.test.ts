import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSupabaseAdminMock } from '@/test/mocks/supabaseAdmin';

const verify = vi.fn();

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({ verify })),
}));

const supabaseAdminMock = createSupabaseAdminMock();

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => supabaseAdminMock,
}));

import { POST } from './route';

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/webhooks/resend', {
    method: 'POST',
    body,
    headers: {
      'svix-id': 'msg-1',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,sig-1',
      ...headers,
    },
  });
}

describe('resend webhook route', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, RESEND_WEBHOOK_SECRET: 'whsec_test' };
    supabaseAdminMock.select.mockResolvedValue({ data: [{ id: 'row-1' }], error: null });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 500 when RESEND_WEBHOOK_SECRET is missing', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const response = await POST(makeRequest('{}'));

    expect(response.status).toBe(500);
  });

  it('returns 400 when a svix header is missing', async () => {
    const request = new Request('http://localhost:3000/api/webhooks/resend', {
      method: 'POST',
      body: '{}',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when signature verification fails', async () => {
    verify.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const response = await POST(makeRequest('{}'));

    expect(response.status).toBe(400);
  });

  it.each([
    ['email.sent', 'sent'],
    ['email.delivered', 'delivered'],
    ['email.delivery_delayed', 'delayed'],
    ['email.bounced', 'bounced'],
    ['email.complained', 'complained'],
  ])('updates status to %s -> %s', async (eventType, expectedStatus) => {
    verify.mockReturnValue({ type: eventType, data: { email_id: 'email-1' } });

    const response = await POST(makeRequest('{}'));

    expect(response.status).toBe(200);
    expect(supabaseAdminMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: expectedStatus })
    );
    expect(supabaseAdminMock.eq).toHaveBeenCalledWith('resend_email_id', 'email-1');
  });

  it('acks unknown event types with no DB write', async () => {
    verify.mockReturnValue({ type: 'email.opened', data: { email_id: 'email-1' } });

    const response = await POST(makeRequest('{}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(supabaseAdminMock.from).not.toHaveBeenCalled();
  });

  it('returns 500 when the DB update errors, so Resend retries', async () => {
    verify.mockReturnValue({ type: 'email.sent', data: { email_id: 'email-1' } });
    supabaseAdminMock.select.mockResolvedValue({ data: null, error: new Error('db down') });

    const response = await POST(makeRequest('{}'));

    expect(response.status).toBe(500);
  });

  it('acks 200 without throwing when no matching row is found', async () => {
    verify.mockReturnValue({ type: 'email.sent', data: { email_id: 'email-1' } });
    supabaseAdminMock.select.mockResolvedValue({ data: [], error: null });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await POST(makeRequest('{}'));

    expect(response.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
  });
});
