'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ChevronDown, KeyRound, LogOut, Menu, UserPlus, X } from 'lucide-react';
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
  const { logout, userEmail } = useAdminAuth();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

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
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Menu" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={18} />
          </button>
        </div>

        <div className="hidden md:flex md:items-center" style={{ marginLeft: 'auto', gap: 'var(--space-4)' }}>
          <div ref={accountMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAccountMenuOpen((v) => !v)}
              style={{ fontSize: 13, opacity: 0.85 }}
            >
              {userEmail || 'Account'}
              <ChevronDown size={14} />
            </button>
            {accountMenuOpen && (
              <div
                className="card elev-md"
                style={{
                  position: 'absolute', right: 0, top: '110%', zIndex: 40,
                  minWidth: 200, padding: 'var(--space-2)', gap: 0,
                }}
              >
                <button
                  type="button"
                  className="btn btn-block"
                  onClick={() => { setInviting(true); setAccountMenuOpen(false); }}
                >
                  <UserPlus size={15} /> Invite Admin
                </button>
                <button
                  type="button"
                  className="btn btn-block"
                  onClick={() => { setChangingPassword(true); setAccountMenuOpen(false); }}
                >
                  <KeyRound size={15} /> Change Password
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="dialog-backdrop md:hidden" style={{ justifyItems: 'stretch', alignItems: 'stretch' }} onClick={() => setMobileMenuOpen(false)}>
          <div
            className="card elev-lg"
            style={{ marginLeft: 'auto', height: '100%', width: 'min(280px, 85%)', borderRadius: 0, gap: 'var(--space-1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}>
                <X size={18} />
              </button>
            </div>
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
            <div className="hr" />
            <button
              type="button"
              className="btn btn-block"
              onClick={() => { setInviting(true); setMobileMenuOpen(false); }}
            >
              <UserPlus size={15} /> Invite Admin
            </button>
            <button
              type="button"
              className="btn btn-block"
              onClick={() => { setChangingPassword(true); setMobileMenuOpen(false); }}
            >
              <KeyRound size={15} /> Change Password
            </button>
            <button type="button" className="btn btn-block" onClick={handleLogout}>
              <LogOut size={15} /> Logout
            </button>
          </div>
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
