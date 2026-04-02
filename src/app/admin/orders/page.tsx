'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: null },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
  delivered: { label: 'Delivered', color: 'bg-blue-100 text-blue-800', icon: CheckCircleIcon },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircleIcon },
};

export default function OrdersPage() {
  const { isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isAuthenticated) router.push('/admin');
    else fetchOrders();
  }, [isAuthenticated, router]);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, total_amount, status, created_at')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    else setOrders(data || []);
    setLoading(false);
  }

  async function updateStatus(orderId: number, newStatus: string) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) alert('Update failed');
    else fetchOrders();
  }

  const exportToCSV = () => {
    const headers = ['ID', 'Customer', 'Phone', 'Amount (₦)', 'Status', 'Date'];
    const rows = orders.map(order => [
      order.id,
      order.customer_name,
      order.customer_phone,
      order.total_amount,
      order.status,
      new Date(order.created_at).toLocaleDateString(),
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0,19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredOrders = orders.filter(order =>
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_phone.includes(searchTerm)
  );

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Orders</h1>
          <p className="mt-1 text-gray-500">Track and manage customer orders</p>
        </div>
        <button
          onClick={exportToCSV}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          Export CSV
        </button>
      </div>

      <div className="flex justify-end">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Order</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const StatusIcon = statusConfig[order.status]?.icon;
                  return (
                    <tr key={order.id} className="transition hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        #{order.id}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(order.id.toString());
                            alert(`Order #${order.id} copied!`);
                          }}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                          title="Copy ID"
                        >
                          📋
                        </button>
                       </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                        <div className="text-sm text-gray-500">{order.customer_phone}</div>
                       </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        ₦{order.total_amount.toLocaleString()}
                       </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusConfig[order.status]?.color}`}>
                          {StatusIcon && <StatusIcon className="h-3 w-3" />}
                          {statusConfig[order.status]?.label}
                        </span>
                       </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                       </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="delivered">Delivered</option>
                          <option value="failed">Failed</option>
                        </select>
                       </td>
                     </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}