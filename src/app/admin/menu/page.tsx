'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import Dialog from '@/components/ui/Dialog';
import Link from 'next/link';
import { adminApi } from '@/lib/adminApi';
import { fetchCategories } from '@/lib/fetchCategories';
import { Category, FALLBACK_CATEGORIES, SUBCATEGORY_MAX, withProductSlugs } from '@/lib/categories';
import {
  EditableProduct,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_NAME_MAX,
  Product,
  buildProductPayload,
  isExistingProduct,
  newProduct,
  subcategorySuggestions,
  validateProduct,
} from '@/lib/products';

export default function MenuPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditableProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [categoryRows, setCategoryRows] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [tableReady, setTableReady] = useState(false);
  const [bulkTarget, setBulkTarget] = useState('');
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/admin');
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    if (error) {
      showToast(`Failed to load menu items: ${error.message}`, 'error');
    }
    setProducts(data || []);
    setLoading(false);
  }, [showToast]);

  const loadCategories = useCallback(async () => {
    const result = await fetchCategories(supabase);
    if (result.error) showToast(`Failed to load categories: ${result.error}`, 'error');
    setCategoryRows(result.categories);
    setTableReady(result.tableReady);
  }, [showToast]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchProducts();
    loadCategories();

    const channel = supabase
      .channel('menu-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchProducts, loadCategories]);

  // Every category a product uses is always listed, so nothing is silently
  // re-categorised (e.g. 'weekend' items before the migration).
  const categories = useMemo(
    () => withProductSlugs(categoryRows, products.map((p) => p.category)),
    [categoryRows, products]
  );
  const categoryLabel = (slug: string) => categories.find((c) => c.slug === slug)?.name || slug;

  async function moveProducts(productIds: number[], categorySlug: string) {
    if (productIds.length === 0 || !categorySlug) return;
    setMoving(true);
    try {
      const result = await adminApi<{ moved: number }>('/api/admin/products/category', 'POST', { productIds, categorySlug });
      showToast(
        result.moved === 0
          ? `Already in ${categoryLabel(categorySlug)}`
          : `Moved ${result.moved} item${result.moved === 1 ? '' : 's'} to ${categoryLabel(categorySlug)}`,
        'success'
      );
      setBulkTarget('');
      fetchProducts();
    } catch (err) {
      showToast(`Could not move item(s): ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    } finally {
      setMoving(false);
    }
  }


  async function setAvailability(id: number, available: boolean) {
    const { error } = await supabase.from('products').update({ is_available: available }).eq('id', id);
    if (error) {
      showToast(`Could not update availability: ${error.message}`, 'error');
      return;
    }
    showToast(available ? 'Item is available' : 'Item marked temporarily unavailable', 'success');
    fetchProducts();
  }

  async function deleteProduct(id: number) {
    if (!confirm('Delete this item?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      showToast(`Failed to delete product: ${error.message}`, 'error');
      return;
    }
    showToast('Product deleted', 'success');
    fetchProducts();
  }

  async function deleteSelectedProducts() {
    if (!confirm(`Delete ${selectedProductIds.length} item(s)?`)) return;
    const { error } = await supabase.from('products').delete().in('id', selectedProductIds);
    if (error) {
      showToast(`Failed to delete products: ${error.message}`, 'error');
      return;
    }
    showToast(`${selectedProductIds.length} product${selectedProductIds.length === 1 ? '' : 's'} deleted`, 'success');
    setSelectedProductIds([]);
    fetchProducts();
  }

  async function uploadImage(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = fileName;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (error) {
      showToast(`Failed to upload image: ${error.message}`, 'error');
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleSaveWithUpload = async () => {
    if (!editing) return;
    const validationError = validateProduct(editing, categories);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    setUploading(true);
    let finalImageUrl = editing.image_url;
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (!uploadedUrl) {
        setUploading(false);
        return;
      }
      finalImageUrl = uploadedUrl;
    }
    // Explicit columns only, and existence is `id !== null` -- the old
    // `id ? update : insert` treated the real product with id 0
    // ("Chinese fried rice") as a new item, so its edits never saved.
    const productData = buildProductPayload({ ...editing, image_url: finalImageUrl }, categories, tableReady);
    const { error } = isExistingProduct(editing)
      ? await supabase.from('products').update(productData).eq('id', editing.id)
      : await supabase.from('products').insert(productData);
    setUploading(false);
    if (error) {
      showToast(`Failed to save product: ${error.message}`, 'error');
      return;
    }
    showToast('Product saved', 'success');
    setEditing(null);
    setImageFile(null);
    setPreviewUrl('');
    fetchProducts();
  };

  const closeModal = () => {
    setEditing(null);
    setImageFile(null);
    setPreviewUrl('');
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const filteredProducts = products.filter((p) => categoryFilter === 'all' || p.category === categoryFilter);
  const categoryFilterOptions = [
    { value: 'all', label: 'All' },
    ...categories.map((c) => ({ value: c.slug, label: c.is_active ? c.name : `${c.name} (hidden)` })),
  ];
  const editingSuggestions = editing ? subcategorySuggestions(products, editing.category) : [];
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredProducts.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...filteredProducts.map((p) => p.id)])));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <div className="card-kicker">Menu</div>
          <h1 style={{ margin: 0 }}>Menu items</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link href="/admin/categories" className="btn btn-secondary">Manage categories</Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing(newProduct(categoryFilter !== 'all' ? categoryFilter : 'fast_food'))}
          >
            Add product
            <Plus size={14} weight="duotone" />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {categoryFilterOptions.map((f) => (
          <button
            key={f.value}
            type="button"
            className={categoryFilter === f.value ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setCategoryFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selectedProductIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 14 }}>{selectedProductIds.length} selected</span>
          <select
            className="input"
            aria-label="Move selected items to category"
            style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
            value={bulkTarget}
            onChange={(e) => setBulkTarget(e.target.value)}
          >
            <option value="">Move to…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.is_active ? c.name : `${c.name} (hidden)`}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!bulkTarget || moving}
            onClick={() => moveProducts(selectedProductIds, bulkTarget)}
          >
            {moving ? 'Moving…' : 'Move'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ color: 'var(--color-accent-2)' }} onClick={deleteSelectedProducts}>
            Delete selected
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setSelectedProductIds([])}>Clear</button>
        </div>
      )}

      <Dialog open={editing !== null} onClose={closeModal} title={editing && isExistingProduct(editing) ? 'Edit Product' : 'Add Product'} className="max-h-[90vh] overflow-y-auto">
        {editing && (
          <>
            <div className="field">
              <label htmlFor="product-name">Name</label>
              <input
                id="product-name"
                className="input"
                placeholder="Name"
                maxLength={PRODUCT_NAME_MAX}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="product-description">Description</label>
              <textarea
                id="product-description"
                className="input"
                placeholder="Description"
                maxLength={PRODUCT_DESCRIPTION_MAX}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="field">
              <label htmlFor="product-price">Price (₦)</label>
              <input
                id="product-price"
                className="input"
                type="number"
                min={0}
                step={1}
                placeholder="Price (₦)"
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: Math.max(0, parseInt(e.target.value) || 0) })}
              />
            </div>
            <div className="field">
              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                className="input"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value, subcategory: '' })}
              >
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.is_active ? cat.name : `${cat.name} (hidden)`}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="product-subcategory">Subcategory (optional)</label>
              <input
                id="product-subcategory"
                className="input"
                list="product-subcategory-options"
                placeholder="e.g. grills, noodles, sides"
                maxLength={SUBCATEGORY_MAX}
                value={editing.subcategory || ''}
                onChange={(e) => setEditing({ ...editing, subcategory: e.target.value })}
              />
              <datalist id="product-subcategory-options">
                {editingSuggestions.map((sub) => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>

            <div className="field">
              <label htmlFor="product-image">Product Image</label>
              <input
                id="product-image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-sm"
              />
              {(previewUrl || editing.image_url) && (
                <div className="mt-2 relative w-32 h-32 overflow-hidden" style={{ border: '1px solid var(--color-divider)' }}>
                  <Image
                    src={previewUrl || editing.image_url}
                    alt="Preview"
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              )}
            </div>

            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <input
                type="checkbox"
                checked={editing.is_available !== false}
                onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })}
              />
              Available to order
            </label>
            <button type="button" className="btn btn-primary" onClick={handleSaveWithUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </Dialog>

      {loading ? (
        <p className="text-muted">Loading menu items…</p>
      ) : filteredProducts.length === 0 ? (
        <p className="text-muted">No menu items yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} aria-label="Select all products" />
                </th>
                <th>Photo</th>
                <th>Name</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Available</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={() => toggleSelectOne(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </td>
                  <td>
                    <div className="halftone relative w-11 h-11 overflow-hidden" style={{ border: '1px solid var(--color-divider)' }}>
                      {product.image_url && (
                        <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="44px" />
                      )}
                    </div>
                  </td>
                  <td>{product.name}</td>
                  <td style={{ opacity: 0.65, maxWidth: 260 }} className="truncate">{product.description}</td>
                  <td style={{ textAlign: 'right' }}>₦{product.price.toLocaleString()}</td>
                  <td>
                    <select
                      className="input"
                      aria-label={`Category for ${product.name}`}
                      style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                      value={product.category}
                      disabled={moving}
                      onChange={(e) => moveProducts([product.id], e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.is_active ? c.name : `${c.name} (hidden)`}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ opacity: 0.65 }}>{product.subcategory || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => setAvailability(product.id, product.is_available === false)}
                    >
                      {product.is_available === false ? 'Sold out' : 'Available'}
                    </button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost btn-icon" title="Edit" aria-label={`Edit ${product.name}`} onClick={() => setEditing({ ...product })}>
                      <PencilSimple size={15} weight="duotone" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      title="Delete"
                      aria-label={`Delete ${product.name}`}
                      style={{ color: 'var(--color-accent-2)' }}
                      onClick={() => deleteProduct(product.id)}
                    >
                      <Trash size={15} weight="duotone" />
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
