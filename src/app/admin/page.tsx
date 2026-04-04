'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

// Dynamically import SalesChart with SSR disabled
const SalesChart = dynamic(() => import('@/components/admin/SalesChart'), { ssr: false });

export default function AdminDashboard() {
  const { login, isAuthenticated } = useAdminAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    const { count: pending } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'paid']);
    setPendingCount(pending || 0);

    const { count: totalOrd } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    setTotalOrders(totalOrd || 0);

    const today = new Date().toISOString().split('T')[0];
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'paid')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);
    const total = todayOrders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;
    setTotalRevenue(total);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        fetchStats();
        const newOrder = payload.new as any;
        showToast(`New order #${newOrder.id} from ${newOrder.customer_name} – ₦${newOrder.total_amount.toLocaleString()}`, 'success');
        if (Notification.permission === 'granted') {
          new Notification('New order received!', {
            body: `${newOrder.customer_name} – ₦${newOrder.total_amount.toLocaleString()}`,
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchStats())
      .subscribe();

    if (Notification.permission === 'default') Notification.requestPermission();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, fetchStats, showToast]);

  if (!isAuthenticated) {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (login(password)) setError('');
      else setError('Wrong password');
    };
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500">
              <span className="text-2xl font-bold text-white">HN</span>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-800">Welcome Back</h2>
            <p className="mt-1 text-sm text-gray-500">Sign in to manage your restaurant</p>
          </div>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-medium text-white transition hover:opacity-90"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = [
    {
      name: "Today's Revenue",
      value: `₦${totalRevenue.toLocaleString()}`,
      icon: CurrencyDollarIcon,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      name: 'Pending Orders',
      value: pendingCount,
      icon: ShoppingCartIcon,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      name: 'Total Orders',
      value: totalOrders,
      icon: ClipboardDocumentListIcon,
      color: 'bg-blue-100 text-blue-600',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="mt-1 text-gray-500">Overview of your restaurant performance</p>
          <p className="mt-1 text-xs text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="rounded-lg p-2 hover:bg-gray-100 transition"
          title="Refresh stats"
        >
          <ArrowPathIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="rounded-2xl bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="mt-1 text-2xl font-bold text-gray-800">{stat.value}</p>
              </div>
              <div className={`rounded-full p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Sales Overview (Last 7 days)</h2>
        <div className="mt-4">
          <SalesChart />
        </div>
      </div>
    </div>
  );
}