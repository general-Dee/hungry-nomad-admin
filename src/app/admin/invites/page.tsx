'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface AdminInvite {
  id: string;
  email: string;
  invited_by_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  sent: { label: 'Sent', color: 'bg-gray-100 text-gray-800' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
  delayed: { label: 'Delayed', color: 'bg-yellow-100 text-yellow-800' },
  bounced: { label: 'Bounced', color: 'bg-red-100 text-red-800' },
  complained: { label: 'Marked as spam', color: 'bg-red-100 text-red-800' },
  failed: { label: 'Send failed', color: 'bg-red-100 text-red-800' },
};

export default function AdminInvitesPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/admin');
      return;
    }
    fetchInvites();

    const channel = supabase
      .channel('admin-invites-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_invites' }, fetchInvites)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, isLoading, router]);

  async function fetchInvites() {
    const { data, error } = await supabase
      .from('admin_invites')
      .select('id, email, invited_by_email, status, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    else setInvites(data || []);
    setLoading(false);
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Admin Invites</h1>
        <p className="mt-1 text-gray-500">Track delivery status of invite emails sent to new admins</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        </div>
      ) : invites.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-gray-500 shadow-sm">
          No invites sent yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Invited By</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sent</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invites.map((invite) => (
                  <tr key={invite.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {invite.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {invite.invited_by_email || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusConfig[invite.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {statusConfig[invite.status]?.label || invite.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(invite.created_at).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(invite.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
