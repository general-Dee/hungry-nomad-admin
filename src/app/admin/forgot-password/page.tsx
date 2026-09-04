'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthCard from '@/components/AuthCard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('submitting');
    try {
      const res = await fetch('/api/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again later.');
        setStatus('idle');
        return;
      }
      setStatus('done');
    } catch {
      setError('Something went wrong. Please try again later.');
      setStatus('idle');
    }
  };

  return (
    <AuthCard>
      <h2 style={{ textAlign: 'center', margin: '0 0 var(--space-2)' }}>
        {status === 'done' ? 'Check your email' : 'Forgot your password?'}
      </h2>

      {status === 'done' ? (
        <p className="text-muted" style={{ textAlign: 'center', fontSize: 14, marginBottom: 'var(--space-4)' }}>
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="text-muted" style={{ textAlign: 'center', fontSize: 14, marginBottom: 'var(--space-4)' }}>
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="forgot-email" className="sr-only">Email</label>
            <input
              id="forgot-email"
              className="input"
              type="email"
              placeholder="you@hungrynomad.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          {error && <p style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="text-muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 'var(--space-4)' }}>
        <Link href="/admin">Back to sign in</Link>
      </p>
    </AuthCard>
  );
}
