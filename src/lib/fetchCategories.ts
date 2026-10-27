import type { SupabaseClient } from '@supabase/supabase-js';
import { Category, FALLBACK_CATEGORIES, isMissingTableError, sortCategories } from './categories';

export interface CategoriesResult {
  categories: Category[];
  /** false until the editable_categories migration has been applied. */
  tableReady: boolean;
  error: string | null;
}

/**
 * Load categories in sort order. If the table doesn't exist yet, returns the
 * old hardcoded list with tableReady = false so the UI keeps working.
 */
export async function fetchCategories(client: SupabaseClient): Promise<CategoriesResult> {
  const { data, error } = await client
    .from('categories')
    .select('id, name, slug, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return { categories: FALLBACK_CATEGORIES, tableReady: false, error: null };
    }
    return { categories: FALLBACK_CATEGORIES, tableReady: false, error: error.message };
  }
  return { categories: sortCategories((data || []) as Category[]), tableReady: true, error: null };
}
