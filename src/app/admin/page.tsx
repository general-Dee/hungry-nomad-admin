'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';
import { ArrowsClockwise } from '@phosphor-icons/react';

import { SALES_RANGES, rangeHeading, type SalesRange } from '@/lib/salesBuckets';

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
  const [paidCount, setPaidCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [range, setRange] = useState<SalesRange>('7d');

  const fetchStats = useCallback(async () => {
    const { count: pending, error: pendingError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingCount(pending || 0);

    const { count: paidOpen, error: paidError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid');
    setPaidCount(paidOpen || 0);

    const { count: totalOrd, error: totalError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    setTotalOrders(totalOrd || 0);

    const today = new Date().toISOString().split('T')[0];
    const { data: todayOrders, error: todayError } = await supabase
      .from('orders')
      .select('total_amount')
      .in('status', ['paid', 'delivered'])
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

    const firstError = pendingError || paidError || totalError || todayError || recentError;
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
      <div className="login-page">
        <div style={{ maxWidth: 480 }}>
          <div className="card-kicker">Admin sign-in</div>
          <h1>Welcome back</h1>
          <p style={{ maxWidth: '46ch', opacity: 0.75, marginBottom: 'var(--space-6)' }}>
            Sign in to manage your restaurant&apos;s orders, menu and delivery areas.
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
            <div style={{ textAlign: 'right', marginBottom: 'var(--space-3)' }}>
              <Link href="/admin/forgot-password" className="text-muted" style={{ fontSize: 13 }}>
                Forgot password?
              </Link>
            </div>
            {error && <p style={{ color: 'var(--color-accent)', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="dash-head">
        <div>
          <div className="card-kicker">Overview</div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p className="text-muted" style={{ margin: 'var(--space-1) 0 0', fontSize: 12 }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon refresh-btn" aria-label="Refresh" onClick={fetchStats}>
          <ArrowsClockwise size={18} weight="duotone" />
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Today&apos;s Revenue</div>
          <div className="stat-value accent">₦{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unpaid</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid, not delivered</div>
          <div className="stat-value">{paidCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{totalOrders}</div>
        </div>
      </div>

      <section className="section-card">
        <div className="section-head">
          <h2>Sales, {rangeHeading(range)}</h2>
          <div className="seg" role="radiogroup" aria-label="Range">
            {SALES_RANGES.map((r) => (
              <label key={r.value} className="seg-opt">
                <input type="radio" name="range" checked={range === r.value} onChange={() => setRange(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
        </div>
        <div className="chart-fade">
          <SalesChart range={range} />
        </div>
      </section>

      <h2 style={{ fontSize: 16, margin: 'var(--space-8) 0 var(--space-3)' }}>Recent orders</h2>
      <div className="section-card">
        <div className="table-wrap">
          <table className="table table-cards">
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
                    <td data-col="order">#{order.id}</td>
                    <td data-col="customer">{order.customer_name}</td>
                    <td data-col="amount" className="num" style={{ textAlign: 'right' }}>₦{order.total_amount.toLocaleString()}</td>
                    <td data-col="status"><span className={meta.tagClass}>{meta.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
