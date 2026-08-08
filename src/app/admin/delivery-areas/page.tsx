'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';

interface DeliveryArea {
  id: number;
  lga_name: string;
  fee: number;
}

export default function DeliveryAreasPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [zones, setZones] = useState<DeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DeliveryArea | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/admin');
    } else {
      fetchZones();
    }
  }, [isAuthenticated, isLoading, router]);

  async function fetchZones() {
    setLoading(true);
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('lga_name');
    if (error) {
      showToast(`Failed to load delivery zones: ${error.message}`, 'error');
    }
    setZones(data || []);
    setLoading(false);
  }

  async function deleteZone(id: number) {
    if (!confirm('Delete this delivery zone?')) return;
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (error) {
      showToast(`Failed to delete zone: ${error.message}`, 'error');
      return;
    }
    showToast('Delivery zone deleted', 'success');
    fetchZones();
  }

  async function saveZone(zone: Partial<DeliveryArea>) {
    const { id, ...zoneData } = zone;
    const { error } = id
      ? await supabase.from('delivery_zones').update(zoneData).eq('id', id)
      : await supabase.from('delivery_zones').insert(zoneData);
    if (error) {
      showToast(`Failed to save zone: ${error.message}`, 'error');
      return;
    }
    showToast('Delivery zone saved', 'success');
    setEditing(null);
    fetchZones();
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ margin: 0 }}>Delivery Areas</h1>
          <p style={{ margin: 'var(--space-2) 0 0', opacity: 0.65 }}>Manage delivery fees by Local Government Area</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ id: 0, lga_name: '', fee: 0 })}>
          Add LGA
          <Plus size={14} />
        </button>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit LGA' : 'Add LGA'}>
        {editing && (
          <>
            <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="lga-name">LGA Name</label>
              <input
                id="lga-name"
                className="input"
                placeholder="e.g., Kaduna North"
                value={editing.lga_name}
                onChange={(e) => setEditing({ ...editing, lga_name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="lga-fee">Delivery Fee (₦)</label>
              <input
                id="lga-fee"
                className="input"
                type="number"
                placeholder="Delivery Fee (₦)"
                value={editing.fee ?? 0}
                onChange={(e) => setEditing({ ...editing, fee: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => saveZone(editing)}>
                Save
              </button>
            </div>
          </>
        )}
      </Dialog>

      {loading ? (
        <div className="text-center py-12">Loading zones...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>LGA</th>
              <th style={{ textAlign: 'right' }}>Delivery fee</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id}>
                <td>{zone.lga_name}</td>
                <td style={{ textAlign: 'right' }}>₦{zone.fee.toLocaleString()}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setEditing(zone)}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => deleteZone(zone.id)}>
                    <Trash2 size={13} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
