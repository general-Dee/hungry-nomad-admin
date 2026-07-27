// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const verifyOtp = vi.fn();
const replace = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { auth: { verifyOtp: (...args: unknown[]) => verifyOtp(...args) } },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));

import AcceptInvitePage from './page';

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsValue = new URLSearchParams();
  });

  it('shows an invalid message and never calls verifyOtp when token_hash is missing', () => {
    render(<AcceptInvitePage />);

    expect(screen.getByText('This invite link is invalid.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept invite/i })).not.toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('verifies the token and redirects to /admin on success', async () => {
    searchParamsValue = new URLSearchParams({ token_hash: 'tok-abc123' });
    verifyOtp.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<AcceptInvitePage />);
    await user.click(screen.getByRole('button', { name: /accept invite/i }));

    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'tok-abc123', type: 'invite' });
      expect(replace).toHaveBeenCalledWith('/admin');
    });
  });

  it('shows an error message and does not redirect when verifyOtp fails', async () => {
    searchParamsValue = new URLSearchParams({ token_hash: 'tok-abc123' });
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } });
    const user = userEvent.setup();

    render(<AcceptInvitePage />);
    await user.click(screen.getByRole('button', { name: /accept invite/i }));

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
