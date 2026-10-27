/**
 * Menu categories: shared, pure helpers (no Supabase calls here so they are
 * easy to unit test). See supabase/migrations/20261027120000_editable_categories.sql.
 *
 * Until that migration is applied the `categories` table does not exist, so
 * every caller falls back to FALLBACK_CATEGORIES, which is exactly the list
 * that used to be hardcoded in the menu page.
 */

export interface Category {
  /** null for fallback (pre-migration) categories that have no row yet. */
  id: number | null;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

/** Categories with special handling elsewhere (weekend packages page). */
export const SYSTEM_SLUGS = ['weekend'] as const;

export const FALLBACK_CATEGORIES: Category[] = [
  { id: null, name: 'Fast Food', slug: 'fast_food', sort_order: 10, is_active: true },
  { id: null, name: 'Regular Dishes', slug: 'regular', sort_order: 20, is_active: true },
  { id: null, name: 'Chinese', slug: 'chinese', sort_order: 30, is_active: true },
  { id: null, name: 'Ice Cream', slug: 'icecream', sort_order: 40, is_active: true },
  { id: null, name: 'Beverages', slug: 'beverages', sort_order: 50, is_active: true },
  { id: null, name: 'Weekend packages', slug: 'weekend', sort_order: 900, is_active: true },
];

export const NAME_MAX = 60;
export const SLUG_MAX = 40;
export const SUBCATEGORY_MAX = 40;
export const MAX_BULK_PRODUCTS = 500;

const SLUG_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

export function isSystemSlug(slug: string): boolean {
  return (SYSTEM_SLUGS as readonly string[]).includes(slug);
}

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/_+$/g, '');
}

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length <= SLUG_MAX && SLUG_RE.test(slug);
}

/** Returns an error message, or null when the name is fine. */
export function validateCategoryName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Name is required';
  const trimmed = name.trim();
  if (!trimmed) return 'Name is required';
  if (trimmed.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer`;
  if (!slugify(trimmed)) return 'Name must contain at least one letter or number';
  return null;
}

/**
 * Subcategory is short free text ('' = none). Stored as typed (trimmed) so
 * existing values such as 'grills' or 'General' are not rewritten on save.
 * Returns null when invalid.
 */
export function normaliseSubcategory(value: unknown): string | null {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > SUBCATEGORY_MAX) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f<>]/.test(trimmed)) return null;
  return trimmed;
}

export function sortCategories<T extends Pick<Category, 'sort_order' | 'name'>>(list: T[]): T[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

/**
 * Postgres "undefined_table" (42P01) or PostgREST "table not in schema cache"
 * (PGRST205 / older PGRST116-style messages) — i.e. the migration hasn't run.
 */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '42P01' || code === 'PGRST205') return true;
  const msg = typeof message === 'string' ? message : '';
  return /could not find the table|relation .*categories.* does not exist/i.test(msg);
}

/** PostgREST "column does not exist" for products.category_id before the migration. */
export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === '42703' || code === 'PGRST204') return true;
  return typeof message === 'string' && /category_id/.test(message) && /column/i.test(message);
}

/**
 * Make sure every slug used by a product appears in the list (as an inactive,
 * id-less entry) so the admin never silently re-categorises an item whose
 * category isn't in the table/fallback.
 */
export function withProductSlugs(categories: Category[], productSlugs: (string | null | undefined)[]): Category[] {
  const known = new Set(categories.map((c) => c.slug));
  const extra: Category[] = [];
  for (const slug of productSlugs) {
    if (!slug || known.has(slug)) continue;
    known.add(slug);
    extra.push({
      id: null,
      name: slug.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      slug,
      sort_order: 10_000,
      is_active: true,
    });
  }
  return sortCategories([...categories, ...extra]);
}

/** Swap a category with its neighbour; returns the slugs in the new order. */
export function moveCategory(list: Category[], slug: string, direction: 'up' | 'down'): string[] {
  const order = sortCategories(list).map((c) => c.slug);
  const i = order.indexOf(slug);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= order.length) return order;
  [order[i], order[j]] = [order[j], order[i]];
  return order;
}

/** sort_order values written for an ordered list of ids (10, 20, 30 ...). */
export function sortOrderFor(ids: number[]): { id: number; sort_order: number }[] {
  return ids.map((id, index) => ({ id, sort_order: (index + 1) * 10 }));
}

export function parseIdList(input: unknown, max = MAX_BULK_PRODUCTS): number[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > max) return null;
  const ids: number[] = [];
  for (const value of input) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
    ids.push(value);
  }
  return new Set(ids).size === ids.length ? ids : null;
}

export function nextSortOrder(list: Pick<Category, 'sort_order' | 'slug'>[]): number {
  const regular = list.filter((c) => !isSystemSlug(c.slug)).map((c) => c.sort_order);
  return (regular.length ? Math.max(...regular) : 0) + 10;
}
