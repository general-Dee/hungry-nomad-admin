'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import Sidebar from '@/components/Sidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Global error listener to alert on mobile
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      alert(`Error: ${event.error?.message || 'Unknown error'}`);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <Sidebar />
                <main className="flex-1 overflow-auto">
                  <div className="p-6 md:p-8">{children}</div>
                </main>
              </div>
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}