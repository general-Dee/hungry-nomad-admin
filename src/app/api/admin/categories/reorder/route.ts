import { NextResponse } from 'next/server';
import { readJson, requireStaff } from '@/lib/requireStaff';
import { isMissingTableError, isSystemSlug, parseIdList, sortOrderFor } from '@/lib/categories';

/**
 * Reorder categories: { ids: number[] } listing every non-system category in
 * the new order. Writes sort_order = 10, 20, 30 ...
 */
export async function PUT(request: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const body = await readJson(request);
  const ids = parseIdList(body?.ids, 200);
  if (!ids) {
    return NextResponse.json({ error: 'ids must be a non-empty list of unique category ids' }, { status: 400 });
  }

  const { data: rows, error: listError } = await supabase.from('categories').select('id, slug');
  if (listError) {
    if (isMissingTableError(listError)) {
      return NextResponse.json({ error: 'The categories table has not been set up yet.', code: 'MIGRATION_PENDING' }, { status: 409 });
    }
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  const orderable = new Set(
    (rows || []).filter((r: { slug: string }) => !isSystemSlug(r.slug)).map((r: { id: number }) => r.id)
  );
  if (ids.length !== orderable.size || ids.some((id) => !orderable.has(id))) {
    return NextResponse.json({ error: 'The list of categories is out of date. Reload and try again.' }, { status: 409 });
  }

  for (const { id, sort_order } of sortOrderFor(ids)) {
    const { error } = await supabase.from('categories').update({ sort_order }).eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
