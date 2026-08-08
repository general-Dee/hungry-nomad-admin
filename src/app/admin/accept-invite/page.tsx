'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthCard from '@/components/AuthCard';

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
    <AuthCard>
      <h2 style={{ textAlign: 'center', margin: '0 0 var(--space-2)' }}>
        {!tokenHash || status === 'error'
          ? 'Invite link invalid'
          : status === 'password' || status === 'saving'
          ? 'Set your password'
          : "You've been invited"}
      </h2>

      {!tokenHash ? (
        <p className="text-muted" style={{ textAlign: 'center', fontSize: 14 }}>This invite link is invalid.</p>
      ) : status === 'error' ? (
        <div className="text-muted" style={{ textAlign: 'center', fontSize: 14 }}>
          <p>This invite link is invalid or has expired. Ask an admin to send you a new invite.</p>
          {error && <p style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>{error}</p>}
        </div>
      ) : status === 'password' || status === 'saving' ? (
        <form onSubmit={handleSetPassword}>
          <p className="text-muted" style={{ textAlign: 'center', fontSize: 14, marginBottom: 'var(--space-4)' }}>
            Create a password so you can sign back in later.
          </p>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="new-password" className="sr-only">New password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
            />
          </div>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="confirm-password" className="sr-only">Confirm password</label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{passwordError}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving...' : 'Set Password'}
          </button>
        </form>
      ) : (
        <>
          <p className="text-muted" style={{ textAlign: 'center', fontSize: 14, marginBottom: 'var(--space-4)' }}>
            Click below to accept your invite to the Hungry Nomad admin panel.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={handleAccept} disabled={status === 'verifying'}>
            {status === 'verifying' ? 'Accepting...' : 'Accept Invite'}
          </button>
        </>
      )}
    </AuthCard>
  );
}
