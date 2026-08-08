'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';

interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; tagClass: string }> = {
  pending: { label: 'Pending', tagClass: 'tag tag-neutral' },
  paid: { label: 'Paid', tagClass: 'tag tag-outline' },
  delivered: { label: 'Delivered', tagClass: 'tag tag-accent' },
  failed: { label: 'Failed', tagClass: 'tag tag-outline' },
};

const statusFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
];

export default function OrdersPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/admin');
    } else {
      fetchOrders();
    }
  }, [isAuthenticated, isLoading, router]);

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
    if (error) {
      showToast(`Failed to update order status: ${error.message}`, 'error');
    } else {
      fetchOrders();
    }
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

  const filteredOrders = orders
    .filter(order => statusFilter === 'all' || order.status === statusFilter)
    .filter(order =>
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone.includes(searchTerm)
    );

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ margin: 0 }}>Orders</h1>
          <p style={{ margin: 'var(--space-2) 0 0', opacity: 0.65 }}>Track and manage customer orders</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={exportToCSV}>
          Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {statusFilterOptions.map((f) => (
            <button
              key={f.value}
              type="button"
              className={statusFilter === f.value ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="text"
          placeholder="Search by name or phone…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">Loading orders...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
              <th>Date</th>
              <th>Update status</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  #{order.id}
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    style={{ width: 24, height: 24, marginLeft: 4 }}
                    title="Copy ID"
                    onClick={() => {
                      navigator.clipboard.writeText(order.id.toString());
                      showToast(`Order #${order.id} copied`, 'success');
                    }}
                  >
                    <Copy size={13} />
                  </button>
                </td>
                <td>
                  <div>{order.customer_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.55 }}>{order.customer_phone}</div>
                </td>
                <td style={{ textAlign: 'right' }}>₦{order.total_amount.toLocaleString()}</td>
                <td><span className={statusConfig[order.status]?.tagClass || 'tag tag-neutral'}>{statusConfig[order.status]?.label || order.status}</span></td>
                <td style={{ opacity: 0.65 }}>{new Date(order.created_at).toLocaleDateString()}</td>
                <td>
                  <select
                    className="input"
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
