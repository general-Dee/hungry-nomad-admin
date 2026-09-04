// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const verifyOtp = vi.fn();
const updateUser = vi.fn();
const replace = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));

import ResetPasswordPage from './page';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsValue = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows an invalid message and never calls verifyOtp when token_hash is missing', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText('This reset link is invalid.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset password/i })).not.toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('shows an error message and does not redirect when verifyOtp fails', async () => {
    searchParamsValue = new URLSearchParams({ token_hash: 'tok-abc123' });
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } });
    const user = userEvent.setup();

    render(<ResetPasswordPage />);
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  describe('after the recovery token verifies', () => {
    async function verifyResetToken() {
      searchParamsValue = new URLSearchParams({ token_hash: 'tok-abc123' });
      verifyOtp.mockResolvedValue({ error: null });
      const user = userEvent.setup();

      render(<ResetPasswordPage />);
      await user.click(screen.getByRole('button', { name: /reset password/i }));
      await screen.findByRole('button', { name: /set password/i });

      return user;
    }

    it('shows the password form instead of redirecting immediately', async () => {
      await verifyResetToken();

      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'tok-abc123', type: 'recovery' });
      expect(replace).not.toHaveBeenCalled();
    });

    it('sets the password and redirects to /admin on success', async () => {
      const user = await verifyResetToken();
      updateUser.mockResolvedValue({ error: null });

      await user.type(screen.getByPlaceholderText('New password'), 'supersecret');
      await user.type(screen.getByPlaceholderText('Confirm password'), 'supersecret');
      await user.click(screen.getByRole('button', { name: /set password/i }));

      await waitFor(() => {
        expect(updateUser).toHaveBeenCalledWith({ password: 'supersecret' });
        expect(replace).toHaveBeenCalledWith('/admin');
      });
    });

    it('shows an error and does not call updateUser when passwords do not match', async () => {
      const user = await verifyResetToken();

      await user.type(screen.getByPlaceholderText('New password'), 'supersecret');
      await user.type(screen.getByPlaceholderText('Confirm password'), 'different');
      await user.click(screen.getByRole('button', { name: /set password/i }));

      expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
      expect(updateUser).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it('shows an error and does not call updateUser when the password is too short', async () => {
      const user = await verifyResetToken();

      await user.type(screen.getByPlaceholderText('New password'), 'short');
      await user.type(screen.getByPlaceholderText('Confirm password'), 'short');
      await user.click(screen.getByRole('button', { name: /set password/i }));

      expect(await screen.findByText('Password must be at least 6 characters')).toBeInTheDocument();
      expect(updateUser).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it('shows an inline error and does not redirect when updateUser fails', async () => {
      const user = await verifyResetToken();
      updateUser.mockResolvedValue({ error: { message: 'Password is too weak' } });

      await user.type(screen.getByPlaceholderText('New password'), 'supersecret');
      await user.type(screen.getByPlaceholderText('Confirm password'), 'supersecret');
      await user.click(screen.getByRole('button', { name: /set password/i }));

      expect(await screen.findByText('Password is too weak')).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
