'use client';

import { Archivo } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppShell from '@/components/AppShell';
import { useEffect } from 'react';

const archivo = Archivo({ subsets: ['latin'], weight: ['400', '600', '800'], variable: '--font-archivo' });

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
      <body className={archivo.variable}>
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
