import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSupabaseAdminMock } from '@/test/mocks/supabaseAdmin';

const supabaseAdminMock = createSupabaseAdminMock();

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => supabaseAdminMock,
}));

import { POST } from './route';

const MIN_RESPONSE_MS = 800;

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Every non-400 response is padded to MIN_RESPONSE_MS via a real setTimeout, so
// fake timers drive that delay forward instead of the test actually waiting.
async function postAndFlush(body: unknown) {
  const responsePromise = POST(makeRequest(body));
  await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS + 200);
  return responsePromise;
}

describe('POST /api/admin/forgot-password', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_API_KEY: 'resend_test_key',
      RESEND_FROM_EMAIL: 'invites@hungrynomad.test',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns 400 when email is missing', async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 400 when email is not a string', async () => {
    const response = await POST(makeRequest({ email: 12345 }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when email is not a valid format', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email' }));
    expect(response.status).toBe(400);
  });

  it('sends the custom reset-password confirmUrl, not Supabase\'s raw action_link', async () => {
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: {
        properties: {
          hashed_token: 'tok-abc123',
          action_link: 'https://project.supabase.co/auth/v1/verify?token=tok-abc123&type=recovery',
        },
      },
      error: null,
    });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resend-email-1' }),
    });

    const response = await postAndFlush({ email: 'admin@example.com' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    expect(supabaseAdminMock.auth.admin.generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'admin@example.com',
      options: { redirectTo: 'http://localhost:3000/admin/reset-password' },
    });

    const [, fetchOptions] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentBody = JSON.parse(fetchOptions.body as string);
    expect(sentBody.html).toContain('/admin/reset-password?token_hash=tok-abc123');
    expect(sentBody.html).not.toContain('action_link');
    expect(sentBody.html).not.toContain('/auth/v1/verify');
  });

  // Must not leak whether the account exists -- a "no such user" style error
  // from generateLink is logged server-side but still reported as success.
  it('returns 200 success even when generateLink fails because the user does not exist', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: { code: 'user_not_found', message: 'User not found' },
    });

    const response = await postAndFlush({ email: 'nobody@example.com' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  // This is the core of the timing-side-channel fix: the "user not found" path
  // short-circuits after a single generateLink call, with no Resend round-trip --
  // without padding, it would resolve near-instantly while a found-user request
  // is still waiting on Resend. Confirm the response stays pending until the
  // minimum duration has actually elapsed.
  it('pads the response so an unknown email is not answered faster than the minimum duration', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: { code: 'user_not_found', message: 'User not found' },
    });

    let resolved = false;
    POST(makeRequest({ email: 'nobody@example.com' })).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(MIN_RESPONSE_MS - 200);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    expect(resolved).toBe(true);
  });

  it('returns 500 and does not call generateLink when Resend is not configured', async () => {
    delete process.env.RESEND_API_KEY;

    const response = await postAndFlush({ email: 'admin@example.com' });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Something went wrong. Please try again later.');
    expect(supabaseAdminMock.auth.admin.generateLink).not.toHaveBeenCalled();
  });

  it('returns a generic 502 and logs the reason when the Resend API call is not ok', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok-abc123' } },
      error: null,
    });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ message: 'invalid from address' }),
    });

    const response = await postAndFlush({ email: 'admin@example.com' });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe('Something went wrong. Please try again later.');
    expect(errorSpy).toHaveBeenCalled();
  });
});
