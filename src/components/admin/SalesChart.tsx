'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface RawOrder {
  created_at: string;
  total_amount: number;
}

interface ChartBar {
  label: string;
  total: number;
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function bucketWeek(orders: RawOrder[]): ChartBar[] {
  const today = startOfDay(new Date());
  const days: { key: string; label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().split('T')[0], label: DAY_ABBR[d.getDay()], total: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  orders.forEach((o) => {
    const key = new Date(o.created_at).toISOString().split('T')[0];
    const bucket = byKey.get(key);
    if (bucket) bucket.total += o.total_amount;
  });
  return days.map((d) => ({ label: d.label, total: d.total }));
}

function bucketMonth(orders: RawOrder[]): ChartBar[] {
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - 27); // 28-day window, 4 buckets of 7 days

  const buckets = [0, 1, 2, 3].map((i) => ({ label: `Wk ${i + 1}`, total: 0 }));
  orders.forEach((o) => {
    const created = startOfDay(new Date(o.created_at));
    if (created < start || created > today) return;
    const dayIndex = Math.floor((created.getTime() - start.getTime()) / 86400000);
    const bucketIndex = Math.min(3, Math.floor(dayIndex / 7));
    buckets[bucketIndex].total += o.total_amount;
  });
  return buckets;
}

export default function SalesChart({ range }: { range: '7d' | '30d' }) {
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSales() {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .eq('status', 'paid')
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      setOrders(data || []);
      setLoading(false);
    }

    fetchSales();
  }, []);

  const data = useMemo(
    () => (range === '7d' ? bucketWeek(orders) : bucketMonth(orders)),
    [orders, range]
  );

  const hasSales = orders.length > 0;

  if (loading) return <div className="h-64 animate-pulse" style={{ background: 'var(--color-surface)' }}></div>;

  if (!hasSales) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted">
        <BarChart3 size={40} strokeWidth={1.5} />
        <p className="mt-2 text-sm">No sales data available yet</p>
        <p className="text-xs">Completed orders will appear here</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider)" />
        <XAxis dataKey="label" tick={{ fill: 'var(--color-text)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-divider)' }} tickLine={false} />
        <YAxis tick={{ fill: 'var(--color-text)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-divider)' }} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-divider)', borderRadius: 0 }}
          formatter={(value: unknown) => {
            if (value === undefined || value === null) return '₦0';
            const num = typeof value === 'number' ? value : Number(value);
            return `₦${num.toLocaleString()}`;
          }}
        />
        <Bar dataKey="total" fill="var(--color-accent)" radius={[0, 0, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
