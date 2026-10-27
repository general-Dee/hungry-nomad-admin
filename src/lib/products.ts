/**
 * Menu item editing helpers (pure, unit tested).
 *
 * Root-cause note: the old menu page used `id: 0` to mean "new product" and
 * saved with `id ? update : insert`. "Chinese fried rice" really has id 0 in
 * the database, so editing it took the insert branch: the edit never touched
 * the real row (and the dialog even said "Add Product"). New products now use
 * `id: null`, and existence is checked with `id !== null`.
 */
import { Category, normaliseSubcategory } from './categories';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  category_id?: number | null;
  subcategory?: string | null;
  image_url: string;
  is_available?: boolean;
}

export type EditableProduct = Omit<Product, 'id'> & { id: number | null };

export const PRODUCT_NAME_MAX = 120;
export const PRODUCT_DESCRIPTION_MAX = 1000;
export const PRODUCT_PRICE_MAX = 10_000_000;

export function newProduct(category = 'fast_food'): EditableProduct {
  return { id: null, name: '', description: '', price: 0, category, subcategory: '', is_available: true, image_url: '' };
}

export function isExistingProduct(p: Pick<EditableProduct, 'id'>): p is { id: number } {
  return typeof p.id === 'number' && Number.isInteger(p.id) && p.id >= 0;
}

export function validateProduct(p: EditableProduct, categories: Pick<Category, 'slug'>[]): string | null {
  const name = (p.name || '').trim();
  if (!name) return 'Name is required';
  if (name.length > PRODUCT_NAME_MAX) return `Name must be ${PRODUCT_NAME_MAX} characters or fewer`;
  if ((p.description || '').length > PRODUCT_DESCRIPTION_MAX) return `Description must be ${PRODUCT_DESCRIPTION_MAX} characters or fewer`;
  if (!Number.isInteger(p.price) || p.price < 0 || p.price > PRODUCT_PRICE_MAX) return 'Price must be a whole number of naira, 0 or more';
  if (!categories.some((c) => c.slug === p.category)) return 'Choose a category';
  if (normaliseSubcategory(p.subcategory) === null) return 'Subcategory must be 40 characters or fewer';
  return null;
}

/**
 * The exact columns written on save. Built explicitly (not by spreading the
 * row) so read-only columns such as id/created_at are never sent, and
 * category_id is only sent once the categories table exists.
 */
export function buildProductPayload(p: EditableProduct, categories: Category[], tableReady: boolean) {
  const payload: Record<string, unknown> = {
    name: p.name.trim(),
    description: (p.description || '').trim(),
    price: p.price,
    category: p.category,
    subcategory: normaliseSubcategory(p.subcategory) ?? '',
    image_url: p.image_url || '',
    is_available: p.is_available !== false,
  };
  if (tableReady) {
    const match = categories.find((c) => c.slug === p.category);
    if (match && match.id !== null) payload.category_id = match.id;
  }
  return payload;
}

/** Distinct non-empty subcategories already used in a category, for suggestions. */
export function subcategorySuggestions(products: Pick<Product, 'category' | 'subcategory'>[], category: string): string[] {
  const set = new Set<string>();
  for (const p of products) {
    if (p.category !== category || !p.subcategory || p.subcategory === 'General') continue;
    set.add(p.subcategory);
  }
  return Array.from(set).sort();
}
