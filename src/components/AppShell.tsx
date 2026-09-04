'use client';

import { ReactNode } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import TopNav from '@/components/TopNav';

export default function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAdminAuth();

  // Keep the same wrapper shape (div > [TopNav] > main > children) regardless
  // of isAuthenticated. Switching the root element type (Fragment vs div) here
  // based on auth state would make React remount `children` the instant a
  // page establishes a session mid-flow (e.g. reset-password/accept-invite
  // calling verifyOtp), wiping that page's local state right when it needs to
  // move to its next step.
  return (
    <div style={isAuthenticated ? { minHeight: '100vh' } : undefined}>
      {isAuthenticated && <TopNav />}
      <main
        style={isAuthenticated ? { maxWidth: 1180, margin: '0 auto' } : undefined}
        className={isAuthenticated ? 'px-6 pt-8 pb-16' : undefined}
      >
        {children}
      </main>
    </div>
  );
}
