'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Eye, EyeSlash, PencilSimple, Plus, X } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { adminApi } from '@/lib/adminApi';
import { fetchCategories } from '@/lib/fetchCategories';
import { Category, NAME_MAX, isSystemSlug, moveCategory, slugify, validateCategoryName } from '@/lib/categories';

export default function CategoriesPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/admin');
  }, [isAuthenticated, isLoading, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchCategories(supabase);
    if (result.error) showToast(`Failed to load categories: ${result.error}`, 'error');
    setCategories(result.categories);
    setTableReady(result.tableReady);
    const { data } = await supabase.from('products').select('category');
    const next: Record<string, number> = {};
    for (const row of (data || []) as { category: string }[]) next[row.category] = (next[row.category] || 0) + 1;
    setCounts(next);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const orderable = useMemo(() => categories.filter((c) => !isSystemSlug(c.slug)), [categories]);
  const system = useMemo(() => categories.filter((c) => isSystemSlug(c.slug)), [categories]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      showToast(success, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const error = validateCategoryName(newName);
    if (error) {
      showToast(error, 'error');
      return;
    }
    await run(() => adminApi('/api/admin/categories', 'POST', { name: newName.trim() }), `Added "${newName.trim()}"`);
    setNewName('');
  }

  async function saveRename(category: Category) {
    const error = validateCategoryName(renameValue);
    if (error) {
      showToast(error, 'error');
      return;
    }
    await run(() => adminApi('/api/admin/categories', 'PATCH', { id: category.id, name: renameValue.trim() }), 'Category renamed');
    setRenamingId(null);
  }

  async function toggleActive(category: Category) {
    const hiding = category.is_active;
    if (hiding && !confirm(`Hide "${category.name}"? Its ${counts[category.slug] || 0} item(s) will disappear from the menu until you show it again. Nothing is deleted.`)) {
      return;
    }
    await run(
      () => adminApi('/api/admin/categories', 'PATCH', { id: category.id, is_active: !hiding }),
      hiding ? 'Category hidden from the menu' : 'Category is visible on the menu'
    );
  }

  async function move(category: Category, direction: 'up' | 'down') {
    const order = moveCategory(orderable, category.slug, direction);
    const ids = order.map((slug) => orderable.find((c) => c.slug === slug)!.id as number);
    await run(() => adminApi('/api/admin/categories/reorder', 'PUT', { ids }), 'Order saved');
  }

  if (isLoading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (!isAuthenticated) return null;

  const slugPreview = slugify(newName);

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-kicker">Menu</div>
        <h1 style={{ margin: 0 }}>Categories</h1>
        <p className="text-muted" style={{ marginTop: 'var(--space-2)' }}>
          The menu shows categories in this order. Hidden categories and their items are not shown to customers. To move items
          between categories, use the <Link href="/admin/menu">Menu items</Link> page.
        </p>
      </div>

      {!tableReady && (
        <div className="card" role="status" style={{ marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--color-accent-2)', padding: 'var(--space-4)' }}>
          <strong>Editing categories isn&apos;t switched on yet.</strong>
          <div className="text-muted" style={{ marginTop: 4 }}>
            The database migration <code>20261027120000_editable_categories.sql</code> hasn&apos;t been applied. Until then the
            menu uses the built-in categories below, and you can still move items between them on the Menu items page.
          </div>
        </div>
      )}

      {tableReady && (
        <form onSubmit={addCategory} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
            <label htmlFor="new-category-name">New category</label>
            <input
              id="new-category-name"
              className="input"
              placeholder="e.g. Desserts"
              maxLength={NAME_MAX}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>
            Add category
            <Plus size={14} weight="duotone" />
          </button>
          {slugPreview && <span className="text-muted" style={{ fontSize: 12 }}>Link: /menu?category={slugPreview}</span>}
        </form>
      )}

      {loading ? (
        <p className="text-muted">Loading categories…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Slug</th>
                <th style={{ textAlign: 'right' }}>Items</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...orderable, ...system].map((category) => {
                const index = orderable.indexOf(category);
                const isSystem = isSystemSlug(category.slug);
                const editable = tableReady && category.id !== null;
                return (
                  <tr key={category.slug} style={category.is_active ? undefined : { opacity: 0.6 }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isSystem ? (
                        <span className="text-muted" style={{ fontSize: 12 }}>Own section</span>
                      ) : (
                        <>
                          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Move ${category.name} up`} title="Move up"
                            disabled={!editable || busy || index === 0} onClick={() => move(category, 'up')}>
                            <ArrowUp size={15} weight="duotone" />
                          </button>
                          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Move ${category.name} down`} title="Move down"
                            disabled={!editable || busy || index === orderable.length - 1} onClick={() => move(category, 'down')}>
                            <ArrowDown size={15} weight="duotone" />
                          </button>
                        </>
                      )}
                    </td>
                    <td>
                      {renamingId === category.id && editable ? (
                        <form onSubmit={(e) => { e.preventDefault(); saveRename(category); }} style={{ display: 'flex', gap: 4 }}>
                          <input className="input" aria-label="Category name" autoFocus maxLength={NAME_MAX}
                            value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                          <button type="submit" className="btn btn-ghost btn-icon" aria-label="Save name" disabled={busy}><Check size={15} weight="duotone" /></button>
                          <button type="button" className="btn btn-ghost btn-icon" aria-label="Cancel rename" onClick={() => setRenamingId(null)}><X size={15} weight="duotone" /></button>
                        </form>
                      ) : (
                        category.name
                      )}
                    </td>
                    <td style={{ opacity: 0.65 }}><code>{category.slug}</code></td>
                    <td style={{ textAlign: 'right' }}>{counts[category.slug] || 0}</td>
                    <td>
                      <span className="tag tag-neutral">{category.is_active ? 'Visible' : 'Hidden'}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost btn-icon" title="Rename" aria-label={`Rename ${category.name}`}
                        disabled={!editable || busy}
                        onClick={() => { setRenamingId(category.id); setRenameValue(category.name); }}>
                        <PencilSimple size={15} weight="duotone" />
                      </button>
                      {!isSystem && (
                        <button type="button" className="btn btn-ghost btn-icon"
                          title={category.is_active ? 'Hide from menu' : 'Show on menu'}
                          aria-label={category.is_active ? `Hide ${category.name}` : `Show ${category.name}`}
                          disabled={!editable || busy} onClick={() => toggleActive(category)}>
                          {category.is_active ? <EyeSlash size={15} weight="duotone" /> : <Eye size={15} weight="duotone" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-2)' }}>
            Renaming changes the label only; the slug stays the same so existing links and checkout rules keep working.
            Categories are hidden, never deleted.
          </p>
        </div>
      )}
    </div>
  );
}
