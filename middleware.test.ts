import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}));

import { middleware } from './middleware';

const PROTECTED_SUB_PATHS = ['/admin/orders', '/admin/menu', '/admin/delivery-areas', '/admin/invites'];

describe('middleware', () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it.each(PROTECTED_SUB_PATHS)('redirects unauthenticated requests to %s', async (path) => {
    getUser.mockResolvedValue({ data: { user: null } });
    const request = new NextRequest(`http://localhost:3000${path}`);

    const response = await middleware(request);

    expect(response.headers.get('location')).toBe('http://localhost:3000/admin');
  });

  it.each(PROTECTED_SUB_PATHS)('passes through authenticated requests to %s', async (path) => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const request = new NextRequest(`http://localhost:3000${path}`);

    const response = await middleware(request);

    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['/admin', '/admin/accept-invite'])(
    'does not redirect unauthenticated requests to unprotected path %s',
    async (path) => {
      getUser.mockResolvedValue({ data: { user: null } });
      const request = new NextRequest(`http://localhost:3000${path}`);

      const response = await middleware(request);

      expect(response.headers.get('location')).toBeNull();
    }
  );

  it('protects nested paths under a protected prefix', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const request = new NextRequest('http://localhost:3000/admin/invites/123');

    const response = await middleware(request);

    expect(response.headers.get('location')).toBe('http://localhost:3000/admin');
  });
});
