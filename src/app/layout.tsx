'use client';

import { Source_Serif_4 } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppShell from '@/components/AppShell';
import { useEffect } from 'react';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Global error listener to alert on mobile
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      alert(`Error: ${event.error?.message || 'Unknown error'}`);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled rejection:', event.reason);
      alert(`Error: ${event.reason?.message || 'Unknown error'}`);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <html lang="en">
      <body className={sourceSerif.variable}>
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <AppShell>{children}</AppShell>
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
