import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSupabaseAdminMock } from '@/test/mocks/supabaseAdmin';

const getUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [] }),
}));

const supabaseAdminMock = createSupabaseAdminMock();

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => supabaseAdminMock,
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function authenticate() {
  getUser.mockResolvedValue({ data: { user: { id: 'admin-1', email: 'admin@example.com' } } });
}

describe('POST /api/admin/invite', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    process.env = {
      ...ORIGINAL_ENV,
      RESEND_API_KEY: 'resend_test_key',
      RESEND_FROM_EMAIL: 'invites@hungrynomad.test',
    };
    supabaseAdminMock.insert.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it('returns 400 when email is missing', async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 400 when email is not a string', async () => {
    const response = await POST(makeRequest({ email: 12345 }));
    expect(response.status).toBe(400);
  });

  it('returns 401 when unauthenticated, without generating an invite link', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(makeRequest({ email: 'new-admin@example.com' }));

    expect(response.status).toBe(401);
    expect(supabaseAdminMock.auth.admin.generateLink).not.toHaveBeenCalled();
  });

  it('sends the custom accept-invite confirmUrl, not Supabase\'s raw action_link', async () => {
    authenticate();
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: {
        properties: {
          hashed_token: 'tok-abc123',
          action_link: 'https://project.supabase.co/auth/v1/verify?token=tok-abc123&type=invite',
        },
      },
      error: null,
    });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resend-email-1' }),
    });

    const response = await POST(makeRequest({ email: 'new-admin@example.com' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    const [, fetchOptions] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sentBody = JSON.parse(fetchOptions.body as string);
    expect(sentBody.html).toContain('/admin/accept-invite?token_hash=tok-abc123');
    expect(sentBody.html).not.toContain('action_link');
    expect(sentBody.html).not.toContain('/auth/v1/verify');
  });

  it('returns 409 when the email already has admin access', async () => {
    authenticate();
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: { code: 'email_exists', message: 'already exists' },
    });

    const response = await POST(makeRequest({ email: 'existing-admin@example.com' }));

    expect(response.status).toBe(409);
  });

  it('returns 400 with a passthrough message for other generateLink errors', async () => {
    authenticate();
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: { code: 'unexpected_failure', message: 'something else broke' },
    });

    const response = await POST(makeRequest({ email: 'new-admin@example.com' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'something else broke' });
  });

  it('returns 500 when Resend is not configured, after the invite link has already been created', async () => {
    authenticate();
    delete process.env.RESEND_API_KEY;
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok-abc123' } },
      error: null,
    });

    const response = await POST(makeRequest({ email: 'new-admin@example.com' }));

    expect(response.status).toBe(500);
    // The Supabase invited user was already created by this point -- this
    // pins the existing orphaned-user gap as documented behavior.
    expect(supabaseAdminMock.auth.admin.generateLink).toHaveBeenCalled();
  });

  it('records a failed invite row when the Resend API call is not ok', async () => {
    authenticate();
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok-abc123' } },
      error: null,
    });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ message: 'invalid from address' }),
    });

    const response = await POST(makeRequest({ email: 'new-admin@example.com' }));

    expect(response.status).toBe(502);
    expect(supabaseAdminMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', resend_email_id: null })
    );
  });

  it('reports success with a warning when the admin_invites insert fails', async () => {
    authenticate();
    supabaseAdminMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok-abc123' } },
      error: null,
    });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resend-email-1' }),
    });
    supabaseAdminMock.insert.mockResolvedValueOnce({ data: null, error: new Error('insert failed') });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(makeRequest({ email: 'new-admin@example.com' }));

    // The invite email genuinely went out and can still be accepted, so this
    // isn't reported as a failure -- but the caller does get a warning since
    // the invite won't show up in the invites list until the tracking row
    // exists. See route.ts insertError handling.
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.warning).toEqual(expect.any(String));
    expect(errorSpy).toHaveBeenCalledWith('Failed to record admin_invites row', expect.any(Error));
  });
});
