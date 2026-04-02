'use client';

import { useAdminAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminNav() {
  const { isAuthenticated, logout } = useAdminAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/admin');
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="bg-white shadow p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">Hungry Nomad Admin</h1>
      <button
        onClick={handleLogout}
        className="text-red-600 hover:text-red-800"
      >
        Logout
      </button>
    </nav>
  );
}
