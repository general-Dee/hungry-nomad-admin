import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hungry Nomad Admin',
  description: 'Admin dashboard for restaurant management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <div className="p-6 md:p-8">{children}</div>
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}