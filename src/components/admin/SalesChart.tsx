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

  if (data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-gray-400">
        <svg
          className="h-12 w-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="mt-2 text-sm">No sales data available yet</p>
        <p className="text-xs">Completed orders will appear here</p>
      </div>
    );
  }

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