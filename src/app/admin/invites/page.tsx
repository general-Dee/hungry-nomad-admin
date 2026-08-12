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

const statusConfig: Record<string, { label: string; tagClass: string }> = {
  sent: { label: 'Sent', tagClass: 'tag tag-neutral' },
  delivered: { label: 'Delivered', tagClass: 'tag tag-accent' },
  delayed: { label: 'Delayed', tagClass: 'tag tag-outline' },
  bounced: { label: 'Bounced', tagClass: 'tag tag-accent-2' },
  complained: { label: 'Marked as spam', tagClass: 'tag tag-accent-2' },
  failed: { label: 'Send failed', tagClass: 'tag tag-accent-2' },
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
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-kicker">Admin invites</div>
        <h1 style={{ margin: 0 }}>Invite delivery status</h1>
      </div>

      {loading ? (
        <p className="text-muted">Loading invites…</p>
      ) : invites.length === 0 ? (
        <p className="text-muted">No invites sent yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Invited by</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td style={{ opacity: 0.65 }}>{invite.invited_by_email || '—'}</td>
                  <td><span className={statusConfig[invite.status]?.tagClass || 'tag tag-neutral'}>{statusConfig[invite.status]?.label || invite.status}</span></td>
                  <td style={{ opacity: 0.65 }}>{new Date(invite.created_at).toLocaleString()}</td>
                  <td style={{ opacity: 0.65 }}>{new Date(invite.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
