'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
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

const actionConfig: Record<ActivityAction, { label: string; color: string }> = {
  insert: { label: 'Created', color: 'bg-green-100 text-green-800' },
  update: { label: 'Updated', color: 'bg-amber-100 text-amber-800' },
  delete: { label: 'Deleted', color: 'bg-red-100 text-red-800' },
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-500 mt-1">Track record of admin changes to menu items, delivery areas, and orders</p>
      </div>

      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.value
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">Loading activity log...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No activity recorded yet.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((row) => {
                  const changedFields = row.action === 'update' ? getChangedFields(row) : [];
                  const isExpanded = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {row.changed_by_email || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {tableLabels[row.table_name] || row.table_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${actionConfig[row.action].color}`}>
                            {actionConfig[row.action].label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span>{getSummary(row)}</span>
                            {changedFields.length > 0 && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                className="text-amber-600 hover:text-amber-800 font-medium text-xs"
                              >
                                {isExpanded ? 'Hide' : `${changedFields.length} field${changedFields.length > 1 ? 's' : ''} changed`}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && changedFields.length > 0 && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-6 py-3 text-sm text-gray-600">
                            <ul className="space-y-1">
                              {changedFields.map(({ field, from, to }) => (
                                <li key={field}>
                                  <span className="font-medium">{field}</span>: {JSON.stringify(from)} → {JSON.stringify(to)}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
