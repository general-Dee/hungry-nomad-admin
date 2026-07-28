'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error' | 'password' | 'saving'>('idle');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleAccept = async () => {
    if (!tokenHash) return;
    setStatus('verifying');
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' });
    if (error) {
      setError(error.message);
      setStatus('error');
      return;
    }
    setStatus('password');
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    setPasswordError('');
    setStatus('saving');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
      setStatus('password');
      return;
    }
    router.replace('/admin');
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500">
            <span className="text-2xl font-bold text-white">HN</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-800">
            {!tokenHash || status === 'error'
              ? 'Invite link invalid'
              : status === 'password' || status === 'saving'
              ? 'Set your password'
              : "You've been invited"}
          </h2>
        </div>

        {!tokenHash ? (
          <p className="text-center text-sm text-gray-500">This invite link is invalid.</p>
        ) : status === 'error' ? (
          <div className="text-center text-sm text-gray-500">
            <p>This invite link is invalid or has expired. Ask an admin to send you a new invite.</p>
            {error && <p className="mt-2 text-xs text-gray-400">{error}</p>}
          </div>
        ) : status === 'password' || status === 'saving' ? (
          <form onSubmit={handleSetPassword}>
            <p className="mb-4 text-center text-sm text-gray-500">
              Create a password so you can sign back in later.
            </p>
            <label htmlFor="new-password" className="sr-only">New password</label>
            <input
              id="new-password"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              autoFocus
              autoComplete="new-password"
            />
            <label htmlFor="confirm-password" className="sr-only">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              autoComplete="new-password"
            />
            {passwordError && <p className="mt-2 text-sm text-red-500">{passwordError}</p>}
            <button
              type="submit"
              disabled={status === 'saving'}
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {status === 'saving' ? 'Saving...' : 'Set Password'}
            </button>
          </form>
        ) : (
          <>
            <p className="mb-4 text-center text-sm text-gray-500">
              Click below to accept your invite to the Hungry Nomad admin panel.
            </p>
            <button
              onClick={handleAccept}
              disabled={status === 'verifying'}
              className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {status === 'verifying' ? 'Accepting...' : 'Accept Invite'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
