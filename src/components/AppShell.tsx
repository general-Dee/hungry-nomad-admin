'use client';

import { ReactNode } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import TopNav from '@/components/TopNav';

export default function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAdminAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav />
      <main style={{ maxWidth: 1180, margin: '0 auto' }} className="px-6 pt-8 pb-16">
        {children}
      </main>
    </div>
  );
}
