// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createQueryMock } from '@/test/mocks/supabaseQuery';

const db = createQueryMock();
const showToast = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: (table: string) => db.from(table) },
}));
vi.mock('@/context/AuthContext', () => ({ useAdminAuth: () => ({ isAuthenticated: true, isLoading: false }) }));
vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
// Stable router object: the page's load effect depends on `router`, so a new
// object per render would refetch and drain the queued mock result.
const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import OrdersPage from './page';

const baseOrder = {
  customer_address: '1 Allen Avenue',
  delivery_lga: 'Ikeja',
  customer_note: null,
  total_amount: 5000,
  status: 'paid',
  created_at: '2026-10-01T10:00:00Z',
};
const withEmail = { ...baseOrder, id: 98, customer_name: 'Ada Lovelace', customer_phone: '08012345678', customer_email: 'ada@example.com' };
const noEmail = { ...baseOrder, id: 99, customer_name: 'Bayo Ade', customer_phone: '08087654321', customer_email: null };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.queue('orders', { data: [withEmail, noEmail] });
});
afterEach(() => cleanup());

describe('Admin orders page', () => {
  it('selects customer_email from orders', async () => {
    render(<OrdersPage />);
    await screen.findByText('Ada Lovelace');
    const select = db.callsFor('orders', 'select')[0];
    expect(String(select.args[0])).toContain('customer_email');
  });

  it('shows the email as a mailto link in the order detail panel', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'View order 98' }));
    const link = screen.getByRole('link', { name: 'ada@example.com' });
    expect(link).toHaveAttribute('href', 'mailto:ada@example.com');
  });

  it('shows a "Not provided" fallback when the email is missing', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);
    await user.click(await screen.findByRole('button', { name: 'View order 99' }));
    const dialog = screen.getByRole('heading', { name: 'Order #99' }).parentElement as HTMLElement;
    expect(within(dialog).getByText('Not provided')).toBeInTheDocument();
    expect(within(dialog).queryByRole('link')).toBeNull();
  });

  it('filters orders by email in the search box', async () => {
    const user = userEvent.setup();
    render(<OrdersPage />);
    await screen.findByText('Ada Lovelace');
    await user.type(screen.getByPlaceholderText(/Search by name, phone or email/), 'ADA@EXAMPLE');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Bayo Ade')).toBeNull();
  });

  it('includes an Email column in the CSV export', async () => {
    const user = userEvent.setup();
    let csvText = '';
    vi.stubGlobal('Blob', class { constructor(parts: string[]) { csvText = parts.join(''); } });
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<OrdersPage />);
    await screen.findByText('Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(clickSpy).toHaveBeenCalled();
    const lines = csvText.split('\n');
    expect(lines[0]).toBe('ID,Customer,Phone,Email,Amount (₦),Status,Date');
    expect(lines[1]).toContain('ada@example.com');
    expect(lines[2].split(',')[3]).toBe('');
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
