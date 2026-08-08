'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  image_url: string;
}

const categories = [
  { value: 'fast_food', label: 'Fast Food', emoji: '🍔' },
  { value: 'regular', label: 'Regular Dishes', emoji: '🍛' },
  { value: 'chinese', label: 'Chinese', emoji: '🥡' },
  { value: 'icecream', label: 'Ice Cream', emoji: '🍦' },
  { value: 'beverages', label: 'Beverages', emoji: '🥤' },
];

const categoryFilterOptions = [{ value: 'all', label: 'All' }, ...categories.map((c) => ({ value: c.value, label: c.label }))];

const subcategories = [
  { value: '', label: 'None' },
  { value: 'grills', label: 'Grills' },
  { value: 'shawarma', label: 'Shawarma / Wraps' },
  { value: 'fries', label: 'Fries' },
];

export default function MenuPage() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState('all');

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

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchProducts();

    const channel = supabase
      .channel('menu-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, fetchProducts]);

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
    const productToSave = { ...editing, image_url: finalImageUrl };
    const { id, ...productData } = productToSave;
    const { error } = id
      ? await supabase.from('products').update(productData).eq('id', id)
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ margin: 0 }}>Menu Items</h1>
          <p style={{ margin: 'var(--space-2) 0 0', opacity: 0.65 }}>Manage your restaurant menu</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            setEditing({
              id: 0,
              name: '',
              description: '',
              price: 0,
              category: 'fast_food',
              subcategory: '',
              image_url: '',
            })
          }
        >
          Add product
          <Plus size={14} />
        </button>
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

      <Dialog open={editing !== null} onClose={closeModal} title={editing?.id ? 'Edit Product' : 'Add Product'} className="max-h-[90vh] overflow-y-auto">
        {editing && (
          <>
            <div className="field">
              <label htmlFor="product-name">Name</label>
              <input
                id="product-name"
                className="input"
                placeholder="Name"
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
                placeholder="Price (₦)"
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: parseInt(e.target.value) || 0 })}
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
                  <option key={cat.value} value={cat.value}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {editing.category === 'fast_food' && (
              <div className="field">
                <label htmlFor="product-subcategory">Subcategory</label>
                <select
                  id="product-subcategory"
                  className="input"
                  value={editing.subcategory || ''}
                  onChange={(e) => setEditing({ ...editing, subcategory: e.target.value })}
                >
                  {subcategories.map((sub) => (
                    <option key={sub.value} value={sub.value}>
                      {sub.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              <button type="button" className="btn btn-primary" onClick={handleSaveWithUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </Dialog>

      {loading ? (
        <div className="text-center py-12">Loading menu items...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="relative w-11 h-11 rounded-md overflow-hidden" style={{ border: '1px solid var(--color-divider)' }}>
                    {product.image_url && (
                      <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="44px" />
                    )}
                  </div>
                </td>
                <td>{product.name}</td>
                <td style={{ opacity: 0.65, maxWidth: 260 }} className="truncate">{product.description}</td>
                <td style={{ textAlign: 'right' }}>₦{product.price.toLocaleString()}</td>
                <td><span className="tag tag-outline">{categories.find((c) => c.value === product.category)?.label || product.category}</span></td>
                <td style={{ opacity: 0.65 }}>{product.subcategory || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setEditing(product)}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => deleteProduct(product.id)}>
                    <Trash2 size={13} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
