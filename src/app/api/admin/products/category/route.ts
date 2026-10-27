import { NextResponse } from 'next/server';
import { readJson, requireStaff } from '@/lib/requireStaff';
import {
  FALLBACK_CATEGORIES,
  isMissingColumnError,
  isMissingTableError,
  isValidSlug,
  parseIdList,
} from '@/lib/categories';

/**
 * Move one or more menu items to a category: { productIds: number[], categorySlug }.
 * Items whose category actually changes get their subcategory cleared (same
 * as changing the category in the edit dialog).
 *
 * Before the migration: only the original slugs are accepted and only the
 * products.category text column is written. After: category_id is written
 * too (the database trigger also keeps them in sync).
 */
export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const body = await readJson(request);
  const productIds = parseIdList(body?.productIds);
  const slug = body?.categorySlug;
  if (!productIds) {
    return NextResponse.json({ error: 'productIds must be a non-empty list of unique item ids (max 500)' }, { status: 400 });
  }
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'A valid categorySlug is required' }, { status: 400 });
  }

  let categoryId: number | null = null;
  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (catError) {
    if (!isMissingTableError(catError)) {
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }
    if (!FALLBACK_CATEGORIES.some((c) => c.slug === slug)) {
      return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
    }
  } else if (!category) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
  } else {
    categoryId = category.id;
  }

  const update: Record<string, unknown> = { category: slug, subcategory: '' };
  if (categoryId !== null) update.category_id = categoryId;

  let { data, error } = await supabase
    .from('products')
    .update(update)
    .in('id', productIds)
    .neq('category', slug)
    .select('id');
  if (error && categoryId !== null && isMissingColumnError(error)) {
    // Table exists but products.category_id doesn't (partial migration): text only.
    delete update.category_id;
    ({ data, error } = await supabase.from('products').update(update).in('id', productIds).neq('category', slug).select('id'));
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  }

  return NextResponse.json({ moved: (data || []).length, unchanged: productIds.length - (data || []).length });
}
