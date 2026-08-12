'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Key, List, SignOut, UserPlus, X } from '@phosphor-icons/react';
import Dialog from '@/components/ui/Dialog';

const navigation = [
  { name: 'Dashboard', href: '/admin' },
  { name: 'Orders', href: '/admin/orders' },
  { name: 'Menu', href: '/admin/menu' },
  { name: 'Delivery Areas', href: '/admin/delivery-areas' },
  { name: 'Admin Invites', href: '/admin/invites' },
  { name: 'Activity Log', href: '/admin/activity-log' },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdminAuth();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'paid']);
      if (error) {
        console.error('Failed to fetch pending order count:', error);
        return;
      }
      setPendingCount(count || 0);
    };
    fetchPending();

    const channel = supabase
      .channel('sidebar-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchPending)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/admin');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setPasswordSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showToast(`Failed to change password: ${error.message}`, 'error');
        return;
      }
      showToast('Password updated', 'success');
      setChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(`Failed to change password: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSubmitting(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(`Failed to invite admin: ${data.error || 'Unknown error'}`, 'error');
        return;
      }
      if (data.warning) {
        showToast(data.warning, 'warning');
      } else {
        showToast('Invite sent', 'success');
      }
      setInviting(false);
      setInviteEmail('');
    } catch (err) {
      showToast(`Failed to invite admin: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setInviteSubmitting(false);
    }
  };

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">Hungry Nomad</span>

        <div className="hidden md:flex md:items-center md:gap-4">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
              {item.name}
              {item.name === 'Orders' && pendingCount > 0 && (
                <span className="tag tag-accent" style={{ marginLeft: 6 }}>{pendingCount}</span>
              )}
            </Link>
          ))}
        </div>

        <div className="md:hidden" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Menu'}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X size={18} weight="duotone" /> : <List size={18} weight="duotone" />}
          </button>
        </div>

        <div className="hidden md:flex md:items-center" style={{ marginLeft: 'auto', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Invite admin"
            title="Invite admin"
            onClick={() => setInviting(true)}
          >
            <UserPlus size={18} weight="duotone" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Change password"
            title="Change password"
            onClick={() => setChangingPassword(true)}
          >
            <Key size={18} weight="duotone" />
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            <SignOut size={15} weight="duotone" />
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile nav panel — pushes content down, no overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden" style={{ padding: 'var(--space-4)', borderBottom: '2px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-block"
              aria-current={pathname === item.href ? 'page' : undefined}
              style={{ color: pathname === item.href ? 'var(--color-accent)' : 'var(--color-text)' }}
            >
              {item.name}
              {item.name === 'Orders' && pendingCount > 0 && (
                <span className="tag tag-accent" style={{ marginLeft: 6 }}>{pendingCount}</span>
              )}
            </Link>
          ))}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => { setInviting(true); setMobileMenuOpen(false); }}
            >
              <UserPlus size={15} weight="duotone" /> Invite admin
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => { setChangingPassword(true); setMobileMenuOpen(false); }}
            >
              <Key size={15} weight="duotone" /> Password
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleLogout}>
            <SignOut size={15} weight="duotone" /> Sign out
          </button>
        </div>
      )}

      <Dialog open={changingPassword} onClose={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }} title="Change Password">
        <form onSubmit={handleChangePassword}>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={passwordSubmitting}>
              {passwordSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog open={inviting} onClose={() => { setInviting(false); setInviteEmail(''); }} title="Invite Admin">
        <form onSubmit={handleInvite}>
          <div className="field">
            <label htmlFor="invite-email">Email address</label>
            <input
              id="invite-email"
              className="input"
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setInviting(false); setInviteEmail(''); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={inviteSubmitting}>
              {inviteSubmitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
