'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { Copy, Eye } from '@phosphor-icons/react';
import Dialog from '@/components/ui/Dialog';

interface Order {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_lga: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface OrderItem {
  product_id: number;
  quantity: number;
  price_at_time: number;
  products: { name: string } | null;
}

const statusConfig: Record<string, { label: string; tagClass: string }> = {
  pending: { label: 'Pending', tagClass: 'tag tag-neutral' },
  paid: { label: 'Paid', tagClass: 'tag tag-accent' },
  delivered: { label: 'Delivered', tagClass: 'tag tag-outline' },
  failed: { label: 'Failed', tagClass: 'tag tag-accent-2' },
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
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/admin');
    } else {
      fetchOrders();
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (viewingOrderId === null) {
      setOrderItems([]);
      return;
    }
    let cancelled = false;
    setOrderItemsLoading(true);
    supabase
      .from('order_items')
      .select('product_id, quantity, price_at_time, products ( name )')
      .eq('order_id', viewingOrderId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          showToast(`Failed to load order items: ${error.message}`, 'error');
          setOrderItems([]);
        } else {
          setOrderItems((data as unknown as OrderItem[]) || []);
        }
        setOrderItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewingOrderId, showToast]);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, customer_address, delivery_lga, total_amount, status, created_at')
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

  async function bulkUpdateStatus(newStatus: string) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).in('id', selectedOrderIds);
    if (error) {
      showToast(`Failed to update orders: ${error.message}`, 'error');
      return;
    }
    showToast(`${selectedOrderIds.length} order${selectedOrderIds.length === 1 ? '' : 's'} marked ${newStatus}`, 'success');
    setSelectedOrderIds([]);
    fetchOrders();
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

  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredOrders.map((o) => o.id));
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...filteredOrders.map((o) => o.id)])));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const viewingOrder = orders.find((o) => o.id === viewingOrderId) || null;

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <div className="card-kicker">Orders</div>
          <h1 style={{ margin: 0 }}>Track deliveries</h1>
        </div>
        <button type="button" className="btn btn-secondary" onClick={exportToCSV}>
          Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {selectedOrderIds.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14 }}>{selectedOrderIds.length} selected</span>
            <button type="button" className="btn btn-secondary" onClick={() => bulkUpdateStatus('paid')}>Mark paid</button>
            <button type="button" className="btn btn-secondary" onClick={() => bulkUpdateStatus('delivered')}>Mark delivered</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSelectedOrderIds([])}>Clear</button>
          </div>
        ) : (
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
        )}
        <input
          className="input"
          type="text"
          placeholder="Search by name or phone…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      {loading ? (
        <p className="text-muted">Loading orders…</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-muted">No orders match your search.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} aria-label="Select all orders" />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={() => toggleSelectOne(order.id)}
                      aria-label={`Select order ${order.id}`}
                    />
                  </td>
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
                      <Copy size={13} weight="duotone" />
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        title="View order"
                        aria-label={`View order ${order.id}`}
                        onClick={() => setViewingOrderId(order.id)}
                      >
                        <Eye size={16} weight="duotone" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={viewingOrder !== null}
        onClose={() => setViewingOrderId(null)}
        title={viewingOrder ? `Order #${viewingOrder.id}` : ''}
        className="max-w-[560px] max-h-[90vh] overflow-y-auto"
      >
        {viewingOrder && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>Customer</div>
                <div>{viewingOrder.customer_name}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>Phone</div>
                <div>{viewingOrder.customer_phone}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>Amount</div>
                <div>₦{viewingOrder.total_amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>Placed</div>
                <div>{new Date(viewingOrder.created_at).toLocaleString()}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>Delivery address</div>
                <div>
                  {viewingOrder.customer_address}
                  {viewingOrder.delivery_lga ? `, ${viewingOrder.delivery_lga}` : ''}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>Order items</div>
              {orderItemsLoading ? (
                <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Loading items…</p>
              ) : orderItems.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>No items recorded for this order.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.products?.name ?? 'Unknown item'}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>₦{(item.price_at_time * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="field">
              <label htmlFor="order-detail-status">Status</label>
              <span className={statusConfig[viewingOrder.status]?.tagClass || 'tag tag-neutral'} style={{ marginBottom: 'var(--space-2)', display: 'inline-flex' }}>
                {statusConfig[viewingOrder.status]?.label || viewingOrder.status}
              </span>
              <select
                id="order-detail-status"
                className="input"
                value={viewingOrder.status}
                onChange={(e) => updateStatus(viewingOrder.id, e.target.value)}
                style={{ marginTop: 'var(--space-2)' }}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setViewingOrderId(null)}>Close</button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
