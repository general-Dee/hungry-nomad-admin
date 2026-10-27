import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQueryMock } from '@/test/mocks/supabaseQuery';

const getUser = vi.fn();
const db = createQueryMock();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser }, from: db.from })),
}));
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [] }) }));

import { POST } from './route';

const req = (body: unknown) => new Request('http://localhost/api/admin/products/category', { method: 'POST', body: JSON.stringify(body) });
const asStaff = () => getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { role: 'staff' } } } });

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
});

describe('POST /api/admin/products/category', () => {
  it('requires a staff session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req({ productIds: [0], categorySlug: 'regular' }))).status).toBe(401);
    getUser.mockResolvedValue({ data: { user: { id: 'u2', app_metadata: { role: 'customer' } } } });
    expect((await POST(req({ productIds: [0], categorySlug: 'regular' }))).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('validates input', async () => {
    asStaff();
    expect((await POST(req({ productIds: [], categorySlug: 'regular' }))).status).toBe(400);
    expect((await POST(req({ productIds: [1], categorySlug: 'Bad Slug' }))).status).toBe(400);
    expect((await POST(req({ productIds: ['1'], categorySlug: 'regular' }))).status).toBe(400);
  });

  it('moves Chinese fried rice (id 0) to regular, writing category_id when the table exists', async () => {
    asStaff();
    db.queue('categories', { data: { id: 2, slug: 'regular' } });
    db.queue('products', { data: [{ id: 0 }] });
    const res = await POST(req({ productIds: [0], categorySlug: 'regular' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ moved: 1, unchanged: 0 });
    expect(db.callsFor('products', 'update')[0].args[0]).toEqual({ category: 'regular', subcategory: '', category_id: 2 });
    expect(db.callsFor('products', 'in')[0].args).toEqual(['id', [0]]);
    expect(db.callsFor('products', 'neq')[0].args).toEqual(['category', 'regular']);
  });

  it('falls back to the text column before the migration', async () => {
    asStaff();
    db.queue('categories', { error: { code: '42P01', message: 'relation "public.categories" does not exist' } });
    db.queue('products', { data: [{ id: 129 }, { id: 130 }] });
    const res = await POST(req({ productIds: [129, 130], categorySlug: 'icecream' }));
    expect(res.status).toBe(200);
    expect(db.callsFor('products', 'update')[0].args[0]).toEqual({ category: 'icecream', subcategory: '' });
  });

  it('rejects unknown categories before and after the migration', async () => {
    asStaff();
    db.queue('categories', { error: { code: '42P01', message: 'relation "public.categories" does not exist' } });
    expect((await POST(req({ productIds: [1], categorySlug: 'desserts' }))).status).toBe(400);
    db.queue('categories', { data: null });
    expect((await POST(req({ productIds: [1], categorySlug: 'desserts' }))).status).toBe(400);
    expect(db.callsFor('products', 'update')).toHaveLength(0);
  });
});
