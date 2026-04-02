'use client';

import { useEffect, useState } from 'react';
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

interface DailySale {
  date: string;
  total: number;
}

export default function SalesChart() {
  const [data, setData] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSales() {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .eq('status', 'paid')
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const grouped: Record<string, number> = {};
      orders?.forEach((order) => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        grouped[date] = (grouped[date] || 0) + order.total_amount;
      });

      const chartData = Object.entries(grouped)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);

      setData(chartData);
      setLoading(false);
    }

    fetchSales();
  }, []);

  if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded"></div>;
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-500">No sales data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip
          formatter={(value: any) => {
            if (value === undefined || value === null) return '₦0';
            const num = typeof value === 'number' ? value : Number(value);
            return `₦${num.toLocaleString()}`;
          }}
        />
        <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}