'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  HomeIcon,
  ShoppingBagIcon,
  CakeIcon,
  MapIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBagIcon },
  { name: 'Menu', href: '/admin/menu', icon: CakeIcon },
  { name: 'Delivery Zones', href: '/admin/delivery-zones', icon: MapIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'paid']);
      setPendingCount(count || 0);
    };
    fetchPending();

    const channel = supabase
      .channel('sidebar-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchPending)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/admin');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-white p-2 shadow-md lg:hidden"
      >
        <Bars3Icon className="h-6 w-6 text-gray-600" />
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Close button (mobile) */}
          <div className="flex items-center justify-between border-b border-gray-100 p-4 lg:hidden">
            <h2 className="text-lg font-bold text-gray-800">Menu</h2>
            <button onClick={() => setMobileMenuOpen(false)}>
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>

          {/* Logo / Brand */}
          <div className="border-b border-gray-100 p-6">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500">
                <span className="text-lg font-bold text-white">HN</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Hungry Nomad</h1>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  <span>{item.name}</span>
                  {item.name === 'Orders' && pendingCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout button */}
          <div className="border-t border-gray-100 p-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}