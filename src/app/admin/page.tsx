'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import SalesChart from '@/components/admin/SalesChart';

export default function AdminDashboard() {
  const { login, isAuthenticated, logout: _logout } = useAdminAuth(); // renamed to avoid unused warning
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchStats = async () => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'paid']);
      setPendingCount(count || 0);

      const today = new Date().toISOString().split('T')[0];
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'paid')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);
      const total = todayOrders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;
      setTotalRevenue(total);
    };
    fetchStats();

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        fetchStats();
        if (Notification.permission === 'granted') {
          new Notification('New order received!', { body: 'Check the orders page.' });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchStats())
      .subscribe();

    if (Notification.permission === 'default') Notification.requestPermission();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (login(password)) setError('');
      else setError('Wrong password');
    };
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-96 border border-gray-100">
          <div className="text-center mb-6">
            <div className="h-12 w-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl mx-auto flex items-center justify-center">
              <span className="text-white font-bold text-xl">HN</span>
            </div>
            <h2 className="text-2xl font-bold mt-4">Admin Login</h2>
            <p className="text-gray-500 text-sm mt-1">Enter your password to continue</p>
          </div>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <button
              type="submit"
              className="w-full mt-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 rounded-lg font-medium hover:opacity-90 transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Orders</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-600 text-lg">📦</span>
            </div>
          </div>
          <Link href="/admin/orders" className="text-sm text-amber-600 hover:underline mt-3 inline-block">
            View all →
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today&apos;s Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₦{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-lg">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Menu Items</p>
              <p className="text-2xl font-bold text-gray-900">—</p>
            </div>
            <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-lg">🍔</span>
            </div>
          </div>
          <Link href="/admin/menu" className="text-sm text-amber-600 hover:underline mt-3 inline-block">
            Manage →
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Sales Overview (Last 7 days)</h2>
        <SalesChart />
      </div>
    </div>
  );
}