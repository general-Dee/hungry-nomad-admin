'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';

type ActivityAction = 'insert' | 'update' | 'delete';

interface ActivityLogRow {
  id: number;
  table_name: string;
  record_id: string;
  action: ActivityAction;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_by_email: string | null;
  created_at: string;
}

const tableLabels: Record<string, string> = {
  products: 'Menu Item',
  delivery_zones: 'Delivery Zone',
  orders: 'Order',
};

const actionConfig: Record<ActivityAction, { label: string; tagClass: string }> = {
  insert: { label: 'Created', tagClass: 'tag tag-accent' },
  update: { label: 'Updated', tagClass: 'tag tag-outline' },
  delete: { label: 'Deleted', tagClass: 'tag tag-outline' },
};

const filters = [
  { value: 'all', label: 'All' },
  { value: 'products', label: 'Menu Items' },
  { value: 'delivery_zones', label: 'Delivery Zones' },
  { value: 'orders', label: 'Orders' },
];

function getSummary(row: ActivityLogRow): string {
  const data = row.new_data ?? row.old_data;
  if (row.table_name === 'products') {
    return (data?.name as string) || `Item #${row.record_id}`;
  }
  if (row.table_name === 'delivery_zones') {
    return (data?.lga_name as string) || `Zone #${row.record_id}`;
  }
  if (row.table_name === 'orders') {
    if (row.action === 'update' && row.old_data && row.new_data && row.old_data.status !== row.new_data.status) {
      return `Order #${row.record_id}: ${row.old_data.status} → ${row.new_data.status}`;
    }
    return `Order #${row.record_id}`;
  }
  return `#${row.record_id}`;
}

function getChangedFields(row: ActivityLogRow): { field: string; from: unknown; to: unknown }[] {
  if (!row.old_data || !row.new_data) return [];
  const keys = new Set([...Object.keys(row.old_data), ...Object.keys(row.new_data)]);
  const changed: { field: string; from: unknown; to: unknown }[] = [];
  keys.forEach((key) => {
    const from = row.old_data![key];
    const to = row.new_data![key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changed.push({ field: key, from, to });
    }
  });
  return changed;
}

export default function ActivityLogPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/admin');
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      showToast(`Failed to load activity log: ${error.message}`, 'error');
    }
    setLogs(data || []);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchLogs();

    const channel = supabase
      .channel('activity-log-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_activity_log' }, (payload) => {
        setLogs((prev) => [payload.new as ActivityLogRow, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchLogs]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.table_name === filter);

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ margin: 0 }}>Activity Log</h1>
        <p style={{ margin: 'var(--space-2) 0 0', opacity: 0.65 }}>Record of admin changes to menu items, delivery areas, and orders</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">Loading activity log...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-muted">No activity recorded yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Type</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((row) => {
              const changedFields = row.action === 'update' ? getChangedFields(row) : [];
              const isExpanded = expandedId === row.id;
              return (
                <tr key={row.id}>
                  <td style={{ opacity: 0.65 }}>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.changed_by_email || 'System'}</td>
                  <td style={{ opacity: 0.65 }}>{tableLabels[row.table_name] || row.table_name}</td>
                  <td><span className={actionConfig[row.action].tagClass}>{actionConfig[row.action].label}</span></td>
                  <td>
                    <div>
                      {getSummary(row)}
                      {changedFields.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0 0 0 var(--space-2)', fontSize: 12 }}
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        >
                          {isExpanded ? 'Hide' : `${changedFields.length} field${changedFields.length > 1 ? 's' : ''} changed`}
                        </button>
                      )}
                    </div>
                    {isExpanded && changedFields.length > 0 && (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: 12, opacity: 0.75 }}>
                        {changedFields.map(({ field, from, to }) => (
                          <div key={field} style={{ padding: '2px 0' }}>
                            <strong>{field}</strong>: {JSON.stringify(from)} → {JSON.stringify(to)}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
