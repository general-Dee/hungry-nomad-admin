import { describe, it, expect } from 'vitest';
import { FALLBACK_CATEGORIES } from './categories';
import { buildProductPayload, isExistingProduct, newProduct, subcategorySuggestions, validateProduct } from './products';

const chineseFriedRice = {
  id: 0, // the real database id of "Chinese fried rice"
  name: 'Chinese fried rice ',
  description: 'Fried rice',
  price: 4500,
  category: 'chinese',
  subcategory: 'General',
  image_url: 'https://example.com/rice.jpg',
  is_available: true,
};

describe('isExistingProduct', () => {
  it('treats id 0 as an existing product (root cause of the uneditable item)', () => {
    expect(isExistingProduct(chineseFriedRice)).toBe(true);
    expect(isExistingProduct({ id: 154 })).toBe(true);
    expect(isExistingProduct(newProduct())).toBe(false);
  });
});

describe('validateProduct', () => {
  it('accepts a valid item and rejects bad fields', () => {
    expect(validateProduct(chineseFriedRice, FALLBACK_CATEGORIES)).toBeNull();
    expect(validateProduct({ ...chineseFriedRice, name: '  ' }, FALLBACK_CATEGORIES)).toMatch(/Name/);
    expect(validateProduct({ ...chineseFriedRice, price: -1 }, FALLBACK_CATEGORIES)).toMatch(/Price/);
    expect(validateProduct({ ...chineseFriedRice, price: 1.5 }, FALLBACK_CATEGORIES)).toMatch(/Price/);
    expect(validateProduct({ ...chineseFriedRice, category: 'nope' }, FALLBACK_CATEGORIES)).toMatch(/category/);
    expect(validateProduct({ ...chineseFriedRice, description: 'x'.repeat(1001) }, FALLBACK_CATEGORIES)).toMatch(/Description/);
  });
});

describe('buildProductPayload', () => {
  it('writes only editable columns and no id', () => {
    const payload = buildProductPayload({ ...chineseFriedRice, category: 'regular' }, FALLBACK_CATEGORIES, false);
    expect(payload).toEqual({
      name: 'Chinese fried rice',
      description: 'Fried rice',
      price: 4500,
      category: 'regular',
      subcategory: 'General',
      image_url: 'https://example.com/rice.jpg',
      is_available: true,
    });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('category_id');
  });
  it('adds category_id once the categories table exists', () => {
    const cats = [{ id: 2, name: 'Regular Dishes', slug: 'regular', sort_order: 20, is_active: true }];
    expect(buildProductPayload({ ...chineseFriedRice, category: 'regular' }, cats, true).category_id).toBe(2);
  });
});

describe('subcategorySuggestions', () => {
  it('lists distinct subcategories in the category', () => {
    const products = [
      { category: 'chinese', subcategory: 'noodles' },
      { category: 'chinese', subcategory: 'rice' },
      { category: 'chinese', subcategory: 'rice' },
      { category: 'chinese', subcategory: 'General' },
      { category: 'regular', subcategory: 'sides' },
    ];
    expect(subcategorySuggestions(products, 'chinese')).toEqual(['noodles', 'rice']);
  });
});
