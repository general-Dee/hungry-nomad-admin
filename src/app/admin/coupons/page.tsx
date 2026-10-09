'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface Coupon {
  id: number;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_subtotal: number;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  ends_at: string | null;
}

const empty = {
  code: '',
  description: '',
  discount_type: 'percent' as const,
  discount_value: 10,
  min_subtotal: 0,
  max_uses: '',
  ends_at: '',
};

export default function CouponsPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [draft, setDraft] = useState(empty);

  async function load() {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) showToast(`Could not load coupons: ${error.message}`, 'error');
    else setCoupons((data as Coupon[]) || []);
  }

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/admin');
      return;
    }
    load();
  }, [isAuthenticated, isLoading, router]);

  async function createCoupon(e: React.FormEvent) {
    e.preventDefault();
    const code = draft.code.trim().toUpperCase();
    if (!code) return;
    const { error } = await supabase.from('coupons').insert({
      code,
      description: draft.description.trim() || null,
      discount_type: draft.discount_type,
      discount_value: Number(draft.discount_value),
      min_subtotal: Number(draft.min_subtotal) || 0,
      max_uses: draft.max_uses ? Number(draft.max_uses) : null,
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
      is_active: true,
    });
    if (error) {
      showToast(`Could not create coupon: ${error.message}`, 'error');
      return;
    }
    setDraft(empty);
    showToast(`${code} created`, 'success');
    load();
  }

  async function toggle(coupon: Coupon) {
    const { error } = await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
    if (error) showToast(error.message, 'error');
    else load();
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div>
      <div className="card-kicker">Marketing</div>
      <h1 style={{ marginTop: 0 }}>Coupons</h1>
      <p className="text-muted" style={{ maxWidth: 560 }}>
        A coupon discounts the food subtotal only. Delivery and takeaway stay full price. It is counted when Paystack confirms the order, not when someone merely types it in.
      </p>
      <form onSubmit={createCoupon} style={{ display: 'grid', gap: 12, maxWidth: 520, margin: 'var(--space-5) 0' }}>
        <input className="input" placeholder="Code, e.g. WEEKEND10" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required />
        <input className="input" placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <select className="input" value={draft.discount_type} onChange={(e) => setDraft({ ...draft, discount_type: e.target.value as 'percent' | 'fixed' })}>
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed naira off</option>
          </select>
          <input className="input" type="number" min={1} value={draft.discount_value} onChange={(e) => setDraft({ ...draft, discount_value: Number(e.target.value) })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input className="input" type="number" min={0} placeholder="Minimum subtotal" value={draft.min_subtotal} onChange={(e) => setDraft({ ...draft, min_subtotal: Number(e.target.value) })} />
          <input className="input" type="number" min={1} placeholder="Max uses, blank for unlimited" value={draft.max_uses} onChange={(e) => setDraft({ ...draft, max_uses: e.target.value })} />
        </div>
        <input className="input" type="date" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
        <button className="btn btn-primary" type="submit">Create coupon</button>
      </form>
      <table className="table">
        <thead>
          <tr><th>Code</th><th>Discount</th><th>Uses</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td>{coupon.code}</td>
              <td>{coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : `₦${coupon.discount_value.toLocaleString()}`}</td>
              <td>{coupon.uses_count}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''}</td>
              <td>{coupon.is_active ? 'On' : 'Off'}</td>
              <td><button type="button" className="btn btn-ghost" onClick={() => toggle(coupon)}>{coupon.is_active ? 'Turn off' : 'Turn on'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
