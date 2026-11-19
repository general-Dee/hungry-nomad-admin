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
import { ChartBar } from '@phosphor-icons/react';
import { bucketSales, type RawOrder, type SalesRange } from '@/lib/salesBuckets';

export default function SalesChart({ range }: { range: SalesRange }) {
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSales() {
      const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .eq('status', 'paid')
        // Newest first: if the API caps the row count, the capped rows are the oldest
        // ones, which no range charts. Bucketing does not depend on row order.
        .order('created_at', { ascending: false });

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
    () => bucketSales(orders, range),
    [orders, range]
  );

  const hasSales = orders.length > 0;

  if (loading) return <div className="h-64 animate-pulse" style={{ background: 'var(--color-surface)' }}></div>;

  if (!hasSales) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted">
        <ChartBar size={40} weight="duotone" />
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
