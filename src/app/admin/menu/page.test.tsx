// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createQueryMock } from '@/test/mocks/supabaseQuery';

const db = createQueryMock();
const showToast = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => db.from(table),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) },
  },
}));
vi.mock('@/context/AuthContext', () => ({ useAdminAuth: () => ({ isAuthenticated: true, isLoading: false }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('next/image', () => ({ default: () => null }));

import MenuPage from './page';

const chineseFriedRice = {
  id: 0,
  name: 'Chinese fried rice ',
  description: 'Fried rice',
  price: 4500,
  category: 'chinese',
  subcategory: 'General',
  image_url: '',
  is_available: true,
  created_at: '2026-01-01T00:00:00Z',
};

function queueLoad(categoriesResult: { data?: unknown; error?: unknown }) {
  db.queue('products', { data: [chineseFriedRice] });
  db.queue('categories', categoriesResult);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Admin menu page', () => {
  it('edits the item with id 0 as an existing product (update, not insert)', async () => {
    queueLoad({ error: { code: 'PGRST205', message: "Could not find the table 'public.categories'" } });
    const user = userEvent.setup();
    render(<MenuPage />);

    await user.click(await screen.findByRole('button', { name: /^Edit Chinese fried rice/ }));
    expect(screen.getByText('Edit Product')).toBeInTheDocument();

    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Chinese Fried Rice');
    const price = screen.getByLabelText('Price (₦)');
    await user.clear(price);
    await user.type(price, '5000');
    await user.selectOptions(screen.getByLabelText('Category'), 'regular');
    db.queue('products', { error: null });
    db.queue('products', { data: [] });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(db.callsFor('products', 'update')).toHaveLength(1));
    expect(db.callsFor('products', 'insert')).toHaveLength(0);
    expect(db.callsFor('products', 'eq')[0].args).toEqual(['id', 0]);
    const payload = db.callsFor('products', 'update')[0].args[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ name: 'Chinese Fried Rice', price: 5000, category: 'regular', subcategory: '' });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('created_at');
  });

  it('lists categories from the table in sort order and moves an item with the row dropdown', async () => {
    queueLoad({
      data: [
        { id: 2, name: 'Regular Dishes', slug: 'regular', sort_order: 10, is_active: true },
        { id: 3, name: 'Chinese', slug: 'chinese', sort_order: 20, is_active: true },
        { id: 7, name: 'Desserts', slug: 'desserts', sort_order: 30, is_active: false },
      ],
    });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ moved: 1, unchanged: 0 }), { status: 200 })
    );
    const user = userEvent.setup();
    render(<MenuPage />);

    const select = await screen.findByLabelText(/^Category for Chinese fried rice/);
    await waitFor(() =>
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Regular Dishes', 'Chinese', 'Desserts (hidden)'])
    );
    await user.selectOptions(select, 'regular');

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/products/category',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ productIds: [0], categorySlug: 'regular' }) })
    );
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Moved 1 item to Regular Dishes', 'success'));
  });

  it('bulk-moves selected items', async () => {
    queueLoad({ error: { code: '42P01', message: 'relation "public.categories" does not exist' } });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ moved: 1, unchanged: 0 }), { status: 200 })
    );
    const user = userEvent.setup();
    render(<MenuPage />);

    await user.click(await screen.findByLabelText(/^Select Chinese fried rice/));
    await user.selectOptions(screen.getByLabelText('Move selected items to category'), 'regular');
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/products/category',
      expect.objectContaining({ body: JSON.stringify({ productIds: [0], categorySlug: 'regular' }) })
    );
  });

  it('blocks saving an invalid item', async () => {
    queueLoad({ error: { code: '42P01', message: 'missing' } });
    const user = userEvent.setup();
    render(<MenuPage />);
    await user.click(await screen.findByRole('button', { name: /^Edit Chinese fried rice/ }));
    await user.clear(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(showToast).toHaveBeenCalledWith('Name is required', 'error');
    expect(db.callsFor('products', 'update')).toHaveLength(0);
  });
});
