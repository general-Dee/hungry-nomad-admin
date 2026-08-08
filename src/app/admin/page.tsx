'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import { RefreshCw } from 'lucide-react';
import AuthCard from '@/components/AuthCard';

// Dynamically import SalesChart with SSR disabled
const SalesChart = dynamic(() => import('@/components/admin/SalesChart'), { ssr: false });

interface NewOrderPayload {
  id: number;
  customer_name: string;
  total_amount: number;
}

interface RecentOrder {
  id: number;
  customer_name: string;
  total_amount: number;
  status: string;
}

const statusMeta: Record<string, { label: string; tagClass: string }> = {
  pending: { label: 'Pending', tagClass: 'tag tag-neutral' },
  paid: { label: 'Paid', tagClass: 'tag tag-outline' },
  delivered: { label: 'Delivered', tagClass: 'tag tag-accent' },
  failed: { label: 'Failed', tagClass: 'tag tag-outline' },
};

export default function AdminDashboard() {
  const { login, isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  const fetchStats = useCallback(async () => {
    const { count: pending, error: pendingError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'paid']);
    setPendingCount(pending || 0);

    const { count: totalOrd, error: totalError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    setTotalOrders(totalOrd || 0);

    const today = new Date().toISOString().split('T')[0];
    const { data: todayOrders, error: todayError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'paid')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);
    const total = todayOrders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;
    setTotalRevenue(total);

    const { data: recent, error: recentError } = await supabase
      .from('orders')
      .select('id, customer_name, total_amount, status')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentOrders(recent || []);

    setLastUpdated(new Date());

    const firstError = pendingError || totalError || todayError || recentError;
    if (firstError) {
      console.error('Failed to fetch dashboard stats:', firstError);
      showToast('Failed to refresh some dashboard stats', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchStats();

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        fetchStats();
        const newOrder = payload.new as NewOrderPayload;
        showToast(`New order #${newOrder.id} from ${newOrder.customer_name} – ₦${newOrder.total_amount.toLocaleString()}`, 'success');
        // Safely check for Notification API
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('New order received!', {
            body: `${newOrder.customer_name} – ₦${newOrder.total_amount.toLocaleString()}`,
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchStats())
      .subscribe();

    // Request permission safely
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, fetchStats, showToast]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      const loginError = await login(email, password);
      setIsSubmitting(false);
      setError(loginError ?? '');
    };
    return (
      <AuthCard>
        <h2 style={{ textAlign: 'center', margin: '0 0 var(--space-2)' }}>Welcome back</h2>
        <p style={{ textAlign: 'center', margin: '0 0 var(--space-6)', opacity: 0.65, fontSize: 14 }}>
          Sign in to manage your restaurant
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              className="input"
              type="email"
              placeholder="you@hungrynomad.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="field" style={{ marginBottom: 'var(--space-5)' }}>
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: 'var(--space-2) 0 0', opacity: 0.65 }}>Overview of restaurant performance</p>
          <p style={{ margin: 'var(--space-1) 0 0', fontSize: 12, opacity: 0.5 }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Refresh" onClick={fetchStats}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="card">
          <div className="card-kicker">Today&apos;s Revenue</div>
          <div className="card-title" style={{ fontSize: 28 }}>₦{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Pending Orders</div>
          <div className="card-title" style={{ fontSize: 28 }}>{pendingCount}</div>
        </div>
        <div className="card">
          <div className="card-kicker">Total Orders</div>
          <div className="card-title" style={{ fontSize: 28 }}>{totalOrders}</div>
        </div>
      </div>

      <div className="hr" style={{ marginBottom: 'var(--space-6)' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Sales, {range === '7d' ? 'last 7 days' : 'last 4 weeks'}</h2>
        <div className="seg" role="radiogroup" aria-label="Range">
          <label className="seg-opt">
            <input type="radio" name="range" checked={range === '7d'} onChange={() => setRange('7d')} />
            7 days
          </label>
          <label className="seg-opt">
            <input type="radio" name="range" checked={range === '30d'} onChange={() => setRange('30d')} />
            30 days
          </label>
        </div>
      </div>
      <SalesChart range={range} />

      <div className="hr" style={{ margin: 'var(--space-8) 0 var(--space-6)' }} />
      <h2 style={{ fontSize: 16, margin: '0 0 var(--space-4)' }}>Recent orders</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {recentOrders.map((order) => {
            const meta = statusMeta[order.status] || statusMeta.pending;
            return (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.customer_name}</td>
                <td style={{ textAlign: 'right' }}>₦{order.total_amount.toLocaleString()}</td>
                <td><span className={meta.tagClass}>{meta.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
