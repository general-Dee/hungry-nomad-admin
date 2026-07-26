'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  HomeIcon,
  ShoppingBagIcon,
  CakeIcon,
  MapIcon,
  ArrowLeftOnRectangleIcon,
  KeyIcon,
  UserPlusIcon,
  EnvelopeIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  { name: 'Orders', href: '/admin/orders', icon: ShoppingBagIcon },
  { name: 'Menu', href: '/admin/menu', icon: CakeIcon },
  { name: 'Delivery Areas', href: '/admin/delivery-areas', icon: MapIcon },
  { name: 'Admin Invites', href: '/admin/invites', icon: EnvelopeIcon },
];

export default function Sidebar() {
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
      showToast('Invite sent', 'success');
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
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-white p-2 shadow-md lg:hidden"
      >
        <Bars3Icon className="h-6 w-6 text-gray-600" />
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Close button (mobile) */}
          <div className="flex items-center justify-between border-b border-gray-100 p-4 lg:hidden">
            <h2 className="text-lg font-bold text-gray-800">Menu</h2>
            <button onClick={() => setMobileMenuOpen(false)}>
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>

          {/* Logo / Brand */}
          <div className="border-b border-gray-100 p-6">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500">
                <span className="text-lg font-bold text-white">HN</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Hungry Nomad</h1>
                <p className="text-xs text-gray-500">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  <span>{item.name}</span>
                  {item.name === 'Orders' && pendingCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Invite admin / Change password / Logout */}
          <div className="border-t border-gray-100 p-4 space-y-1">
            <button
              onClick={() => setInviting(true)}
              className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900"
            >
              <UserPlusIcon className="h-5 w-5" />
              <span>Invite Admin</span>
            </button>
            <button
              onClick={() => setChangingPassword(true)}
              className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50 hover:text-gray-900"
            >
              <KeyIcon className="h-5 w-5" />
              <span>Change Password</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Change password modal */}
      {changingPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  autoComplete="new-password"
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg disabled:opacity-60"
                >
                  {passwordSubmitting ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChangingPassword(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="flex-1 bg-gray-200 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite admin modal */}
      {inviting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Invite Admin</h2>
            <form onSubmit={handleInvite}>
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                autoFocus
                required
              />
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg disabled:opacity-60"
                >
                  {inviteSubmitting ? 'Sending...' : 'Send Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInviting(false);
                    setInviteEmail('');
                  }}
                  className="flex-1 bg-gray-200 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}