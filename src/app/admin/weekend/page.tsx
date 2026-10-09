'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface WeekendPackage {
  id: number;
  slug: string;
  name: string;
  description: string;
  includes: string[];
  price: number;
  serves: string | null;
  is_active: boolean;
  product_id: number | null;
  sort_order: number;
}

export default function WeekendPackagesPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [packages, setPackages] = useState<WeekendPackage[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase
      .from('weekend_packages')
      .select('id, slug, name, description, includes, price, serves, is_active, product_id, sort_order')
      .order('sort_order');
    if (error) showToast(`Could not load packages: ${error.message}`, 'error');
    else setPackages((data as WeekendPackage[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/admin');
      return;
    }
    load();
  }, [isAuthenticated, isLoading, router]);

  function updateLocal(id: number, patch: Partial<WeekendPackage>) {
    setPackages((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function save(item: WeekendPackage) {
    const includes = item.includes.map((part) => part.trim()).filter(Boolean);
    const { error } = await supabase
      .from('weekend_packages')
      .update({
        name: item.name.trim(),
        description: item.description.trim(),
        includes,
        price: item.price,
        serves: item.serves,
        is_active: item.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) {
      showToast(`Could not save ${item.name}: ${error.message}`, 'error');
      return;
    }
    if (item.product_id) {
      const { error: productError } = await supabase
        .from('products')
        .update({
          name: item.name.trim(),
          description: `${item.description.trim()} Includes: ${includes.join(', ')}.`,
          price: item.price,
          is_available: item.is_active,
          category: 'weekend',
        })
        .eq('id', item.product_id);
      if (productError) {
        showToast(`Package saved, but the menu item did not update: ${productError.message}`, 'error');
        return;
      }
    }
    showToast(`${item.name} saved`, 'success');
    load();
  }

  if (isLoading || !isAuthenticated) return null;

  return (
    <div>
      <div className="card-kicker">Weekend</div>
      <h1 style={{ marginTop: 0 }}>Weekend packages</h1>
      <p className="text-muted" style={{ maxWidth: 560 }}>
        Turn a package off to hide it from the storefront. Price and contents are what checkout charges, because each package is a linked menu item.
      </p>
      {loading ? <p className="text-muted">Loading packages…</p> : null}
      <div style={{ display: 'grid', gap: 'var(--space-5)', marginTop: 'var(--space-5)' }}>
        {packages.map((item) => (
          <form
            key={item.id}
            onSubmit={(e) => {
              e.preventDefault();
              save(item);
            }}
            style={{ border: '1px solid var(--color-divider)', borderRadius: 12, padding: 'var(--space-4)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <strong>{item.name}</strong>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={item.is_active}
                  onChange={(e) => updateLocal(item.id, { is_active: e.target.checked })}
                />
                {item.is_active ? 'On' : 'Off'}
              </label>
            </div>
            <div className="field" style={{ marginTop: 'var(--space-3)' }}>
              <label>Name</label>
              <input className="input" value={item.name} onChange={(e) => updateLocal(item.id, { name: e.target.value })} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea className="input" rows={2} value={item.description} onChange={(e) => updateLocal(item.id, { description: e.target.value })} />
            </div>
            <div className="field">
              <label>Includes, comma separated</label>
              <input
                className="input"
                value={item.includes.join(', ')}
                onChange={(e) => updateLocal(item.id, { includes: e.target.value.split(',') })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Price (₦)</label>
                <input className="input" type="number" min={0} value={item.price} onChange={(e) => updateLocal(item.id, { price: Number(e.target.value) || 0 })} />
              </div>
              <div className="field">
                <label>Serves</label>
                <input className="input" value={item.serves || ''} onChange={(e) => updateLocal(item.id, { serves: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">Save</button>
          </form>
        ))}
      </div>
    </div>
  );
}
