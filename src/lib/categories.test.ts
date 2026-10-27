import { describe, it, expect } from 'vitest';
import {
  FALLBACK_CATEGORIES,
  isMissingColumnError,
  isMissingTableError,
  isValidSlug,
  moveCategory,
  nextSortOrder,
  normaliseSubcategory,
  parseIdList,
  slugify,
  sortCategories,
  sortOrderFor,
  validateCategoryName,
  withProductSlugs,
} from './categories';

describe('slugify', () => {
  it('makes database-safe slugs', () => {
    expect(slugify('Desserts')).toBe('desserts');
    expect(slugify('  Rice & Stew!! ')).toBe('rice_and_stew');
    expect(slugify('Crème Brûlée')).toBe('creme_brulee');
    expect(slugify('🍦')).toBe('');
    expect(slugify('a'.repeat(80)).length).toBeLessThanOrEqual(40);
  });
  it('produces slugs the migration check constraint accepts', () => {
    for (const name of ['Fast Food', 'Swallow & Soups', 'Drinks 2', '-x-']) {
      expect(isValidSlug(slugify(name))).toBe(true);
    }
  });
});

describe('validateCategoryName', () => {
  it('rejects empty, too long, non-string and symbol-only names', () => {
    expect(validateCategoryName('')).toMatch(/required/);
    expect(validateCategoryName('   ')).toMatch(/required/);
    expect(validateCategoryName(42)).toMatch(/required/);
    expect(validateCategoryName('x'.repeat(61))).toMatch(/60/);
    expect(validateCategoryName('🍦🍦')).toMatch(/letter or number/);
    expect(validateCategoryName('Desserts')).toBeNull();
  });
});

describe('isValidSlug', () => {
  it('only accepts lowercase underscore slugs', () => {
    expect(isValidSlug('fast_food')).toBe(true);
    expect(isValidSlug('Fast_Food')).toBe(false);
    expect(isValidSlug('a__b')).toBe(false);
    expect(isValidSlug("x'; drop table")).toBe(false);
    expect(isValidSlug(undefined)).toBe(false);
  });
});

describe('normaliseSubcategory', () => {
  it('keeps existing values as typed, trims, and rejects junk', () => {
    expect(normaliseSubcategory(' grills ')).toBe('grills');
    expect(normaliseSubcategory('General')).toBe('General');
    expect(normaliseSubcategory(undefined)).toBe('');
    expect(normaliseSubcategory(null)).toBe('');
    expect(normaliseSubcategory('x'.repeat(41))).toBeNull();
    expect(normaliseSubcategory('<script>')).toBeNull();
    expect(normaliseSubcategory(3)).toBeNull();
  });
});

describe('missing table / column detection', () => {
  it('detects the pre-migration errors from Postgres and PostgREST', () => {
    expect(isMissingTableError({ code: '42P01', message: 'relation "public.categories" does not exist' })).toBe(true);
    expect(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.categories' in the schema cache" })).toBe(true);
    expect(isMissingTableError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingColumnError({ code: 'PGRST204', message: "Could not find the 'category_id' column" })).toBe(true);
    expect(isMissingColumnError({ code: '23505', message: 'duplicate' })).toBe(false);
  });
});

describe('ordering', () => {
  const cats = [
    { id: 3, name: 'C', slug: 'c', sort_order: 30, is_active: true },
    { id: 1, name: 'A', slug: 'a', sort_order: 10, is_active: true },
    { id: 2, name: 'B', slug: 'b', sort_order: 20, is_active: false },
  ];
  it('sorts by sort_order then name', () => {
    expect(sortCategories(cats).map((c) => c.slug)).toEqual(['a', 'b', 'c']);
  });
  it('moves a category up or down, and ignores moves past the ends', () => {
    expect(moveCategory(cats, 'c', 'up')).toEqual(['a', 'c', 'b']);
    expect(moveCategory(cats, 'a', 'down')).toEqual(['b', 'a', 'c']);
    expect(moveCategory(cats, 'a', 'up')).toEqual(['a', 'b', 'c']);
    expect(moveCategory(cats, 'missing', 'up')).toEqual(['a', 'b', 'c']);
  });
  it('writes 10, 20, 30 sort orders', () => {
    expect(sortOrderFor([3, 1])).toEqual([{ id: 3, sort_order: 10 }, { id: 1, sort_order: 20 }]);
  });
  it('puts new categories after the last regular one, ignoring weekend', () => {
    expect(nextSortOrder(FALLBACK_CATEGORIES)).toBe(60);
    expect(nextSortOrder([])).toBe(10);
  });
});

describe('withProductSlugs', () => {
  it('adds any category a product uses that is not in the list', () => {
    const list = withProductSlugs(FALLBACK_CATEGORIES.slice(0, 2), ['fast_food', 'chinese', 'chinese', null]);
    expect(list.map((c) => c.slug)).toEqual(['fast_food', 'regular', 'chinese']);
    expect(list[2].name).toBe('Chinese');
  });
});

describe('parseIdList', () => {
  it('accepts unique non-negative integers including id 0', () => {
    expect(parseIdList([0, 5, 9])).toEqual([0, 5, 9]);
  });
  it('rejects bad input', () => {
    expect(parseIdList([])).toBeNull();
    expect(parseIdList([1, 1])).toBeNull();
    expect(parseIdList([1.5])).toBeNull();
    expect(parseIdList(['1'])).toBeNull();
    expect(parseIdList([-1])).toBeNull();
    expect(parseIdList('1,2')).toBeNull();
    expect(parseIdList(Array.from({ length: 501 }, (_, i) => i))).toBeNull();
  });
});
