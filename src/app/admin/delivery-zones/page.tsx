'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface DeliveryZone {
  id: number;
  lga_name: string;
  fee: number;
}

export default function DeliveryZonesPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);

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
    const { data } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('lga_name');
    setZones(data || []);
    setLoading(false);
  }

  async function deleteZone(id: number) {
    if (confirm('Delete this delivery zone?')) {
      await supabase.from('delivery_zones').delete().eq('id', id);
      fetchZones();
    }
  }

  async function saveZone(zone: Partial<DeliveryZone>) {
    try {
      if (zone.id) {
        await supabase.from('delivery_zones').update(zone).eq('id', zone.id);
      } else {
        await supabase.from('delivery_zones').insert(zone);
      }
      setEditing(null);
      fetchZones();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Delivery Zones (LGA)</h1>
          <p className="text-gray-500 mt-1">Manage delivery fees by Local Government Area</p>
        </div>
        <button
          onClick={() => setEditing({ id: 0, lga_name: '', fee: 0 })}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2 rounded-lg font-medium hover:opacity-90 transition"
        >
          + Add LGA
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{editing.id ? 'Edit' : 'Add'} LGA</h2>
            <div className="space-y-4">
              <input
                placeholder="LGA Name (e.g., Kaduna North)"
                value={editing.lga_name}
                onChange={(e) => setEditing({ ...editing, lga_name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Delivery Fee (₦)"
                value={editing.fee ?? 0}
                onChange={(e) => setEditing({ ...editing, fee: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => saveZone(editing)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">
                Save
              </button>
              <button onClick={() => setEditing(null)} className="flex-1 bg-gray-200 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading zones...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LGA Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee (₦)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {zones.map((zone) => (
                <tr key={zone.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">{zone.lga_name}</td>
                  <td className="px-6 py-4 text-sm font-medium">₦{zone.fee.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button onClick={() => setEditing(zone)} className="text-amber-600 hover:text-amber-800">
                      Edit
                    </button>
                    <button onClick={() => deleteZone(zone.id)} className="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}