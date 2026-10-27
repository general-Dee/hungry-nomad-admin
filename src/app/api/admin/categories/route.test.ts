import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQueryMock } from '@/test/mocks/supabaseQuery';

const getUser = vi.fn();
const db = createQueryMock();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser }, from: db.from })),
}));
vi.mock('next/headers', () => ({ cookies: () => ({ getAll: () => [] }) }));

import { PATCH, POST } from './route';
import { PUT } from './reorder/route';

const req = (method: string, body: unknown) =>
  new Request('http://localhost/api/admin/categories', { method, body: typeof body === 'string' ? body : JSON.stringify(body) });

const asStaff = () => getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { role: 'staff' } } } });

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
});

describe('auth', () => {
  it('401 when signed out, 403 without the staff role, and never touches the db', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req('POST', { name: 'Desserts' }))).status).toBe(401);
    getUser.mockResolvedValue({ data: { user: { id: 'u2', app_metadata: {} } } });
    expect((await POST(req('POST', { name: 'Desserts' }))).status).toBe(403);
    expect((await PATCH(req('PATCH', { id: 1, name: 'X' }))).status).toBe(403);
    expect((await PUT(req('PUT', { ids: [1] }))).status).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/categories', () => {
  it('validates the name', async () => {
    asStaff();
    expect((await POST(req('POST', { name: '' }))).status).toBe(400);
    expect((await POST(req('POST', 'not json'))).status).toBe(400);
    expect((await POST(req('POST', { name: 'x'.repeat(61) }))).status).toBe(400);
  });

  it('creates a category with a slug and the next sort order', async () => {
    asStaff();
    db.queue('categories', { data: [{ slug: 'fast_food', sort_order: 10 }, { slug: 'beverages', sort_order: 50 }, { slug: 'weekend', sort_order: 900 }] });
    db.queue('categories', { data: { id: 7, name: 'Desserts', slug: 'desserts', sort_order: 60, is_active: true } });
    const res = await POST(req('POST', { name: ' Desserts ' }));
    expect(res.status).toBe(201);
    expect(db.callsFor('categories', 'insert')[0].args[0]).toEqual({ name: 'Desserts', slug: 'desserts', sort_order: 60, is_active: true });
  });

  it('409 on a duplicate slug', async () => {
    asStaff();
    db.queue('categories', { data: [{ slug: 'desserts', sort_order: 60 }] });
    expect((await POST(req('POST', { name: 'Desserts' }))).status).toBe(409);
    expect(db.callsFor('categories', 'insert')).toHaveLength(0);
  });

  it('409 MIGRATION_PENDING when the table does not exist yet', async () => {
    asStaff();
    db.queue('categories', { error: { code: 'PGRST205', message: "Could not find the table 'public.categories'" } });
    const res = await POST(req('POST', { name: 'Desserts' }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('MIGRATION_PENDING');
  });
});

describe('PATCH /api/admin/categories', () => {
  it('renames and hides', async () => {
    asStaff();
    db.queue('categories', { data: { id: 2, slug: 'regular' } });
    db.queue('categories', { data: { id: 2, name: 'Rice & Stews', slug: 'regular', sort_order: 20, is_active: false } });
    const res = await PATCH(req('PATCH', { id: 2, name: 'Rice & Stews', is_active: false }));
    expect(res.status).toBe(200);
    expect(db.callsFor('categories', 'update')[0].args[0]).toEqual({ name: 'Rice & Stews', is_active: false });
  });

  it('rejects bad input, unknown ids and hiding weekend', async () => {
    asStaff();
    expect((await PATCH(req('PATCH', { id: 'x', name: 'A' }))).status).toBe(400);
    expect((await PATCH(req('PATCH', { id: 2 }))).status).toBe(400);
    expect((await PATCH(req('PATCH', { id: 2, is_active: 'no' }))).status).toBe(400);
    db.queue('categories', { data: null });
    expect((await PATCH(req('PATCH', { id: 99, name: 'A' }))).status).toBe(404);
    db.queue('categories', { data: { id: 6, slug: 'weekend' } });
    expect((await PATCH(req('PATCH', { id: 6, is_active: false }))).status).toBe(400);
    expect(db.callsFor('categories', 'update')).toHaveLength(0);
  });
});

describe('PUT /api/admin/categories/reorder', () => {
  it('writes sort_order 10, 20, 30 for the full list', async () => {
    asStaff();
    db.queue('categories', { data: [{ id: 1, slug: 'fast_food' }, { id: 2, slug: 'regular' }, { id: 3, slug: 'chinese' }, { id: 6, slug: 'weekend' }] });
    const res = await PUT(req('PUT', { ids: [2, 1, 3] }));
    expect(res.status).toBe(200);
    expect(db.callsFor('categories', 'update').map((c) => c.args[0])).toEqual([{ sort_order: 10 }, { sort_order: 20 }, { sort_order: 30 }]);
    expect(db.callsFor('categories', 'eq').map((c) => c.args[1])).toEqual([2, 1, 3]);
  });

  it('409 when the list is stale or incomplete', async () => {
    asStaff();
    db.queue('categories', { data: [{ id: 1, slug: 'fast_food' }, { id: 2, slug: 'regular' }] });
    expect((await PUT(req('PUT', { ids: [1] }))).status).toBe(409);
    expect((await PUT(req('PUT', { ids: [] }))).status).toBe(400);
  });
});
