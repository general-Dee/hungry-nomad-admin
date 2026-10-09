'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

function minutesToInput(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function inputToMinutes(value: string) {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState('11:00');
  const [close, setClose] = useState('21:30');
  const [closedOverride, setClosedOverride] = useState(false);
  const [label, setLabel] = useState('11:00am – 9:30pm');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/admin');
      return;
    }
    supabase.from('store_settings').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) {
        showToast(`Could not load hours: ${error.message}`, 'error');
        return;
      }
      if (!data) return;
      setOpen(minutesToInput(data.open_minutes));
      setClose(minutesToInput(data.close_minutes));
      setClosedOverride(Boolean(data.closed_override));
      if (data.hours_label) setLabel(data.hours_label);
    });
  }, [isAuthenticated, isLoading, router, showToast]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('store_settings').upsert({
      id: 1,
      open_minutes: inputToMinutes(open),
      close_minutes: inputToMinutes(close),
      closed_override: closedOverride,
      hours_label: label,
    });
    setSaving(false);
    if (error) showToast(`Could not save hours: ${error.message}`, 'error');
    else showToast('Hours saved', 'success');
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div>
      <div className="card-kicker">Settings</div>
      <h1 style={{ marginTop: 0 }}>Opening hours</h1>
      <p className="text-muted" style={{ maxWidth: 520 }}>
        The storefront badge and checkout both read this row. A closed override blocks new orders immediately.
      </p>
      <form onSubmit={save} style={{ maxWidth: 420, marginTop: 'var(--space-5)' }}>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="open">Opens</label>
          <input id="open" className="input" type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="close">Closes</label>
          <input id="close" className="input" type="time" value={close} onChange={(e) => setClose(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="label">Label shown to customers</label>
          <input id="label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <input type="checkbox" checked={closedOverride} onChange={(e) => setClosedOverride(e.target.checked)} />
          Closed right now (holiday or early close)
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save hours'}</button>
      </form>
    </div>
  );
}
