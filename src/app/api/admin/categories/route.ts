import { NextResponse } from 'next/server';
import { readJson, requireStaff } from '@/lib/requireStaff';
import {
  isMissingTableError,
  isSystemSlug,
  nextSortOrder,
  slugify,
  validateCategoryName,
} from '@/lib/categories';

const MIGRATION_PENDING = {
  error: 'The categories table has not been set up yet. Apply supabase/migrations/20261027120000_editable_categories.sql first.',
  code: 'MIGRATION_PENDING',
};

/** Create a category: { name } */
export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const body = await readJson(request);
  const nameError = validateCategoryName(body?.name);
  if (!body || nameError) {
    return NextResponse.json({ error: nameError || 'Invalid request' }, { status: 400 });
  }
  const name = (body.name as string).trim();
  const slug = slugify(name);

  const { data: existing, error: listError } = await supabase.from('categories').select('slug, sort_order');
  if (listError) {
    if (isMissingTableError(listError)) return NextResponse.json(MIGRATION_PENDING, { status: 409 });
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }
  if ((existing || []).some((c: { slug: string }) => c.slug === slug)) {
    return NextResponse.json({ error: `A category with the slug "${slug}" already exists.` }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({ name, slug, sort_order: nextSortOrder(existing || []), is_active: true })
    .select('id, name, slug, sort_order, is_active')
    .single();
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A category with the slug "${slug}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  }
  return NextResponse.json({ category: data }, { status: 201 });
}

/** Rename and/or hide/unhide: { id, name?, is_active? } */
export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const body = await readJson(request);
  const id = body?.id;
  if (!body || typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'A valid category id is required' }, { status: 400 });
  }

  const update: { name?: string; is_active?: boolean } = {};
  if ('name' in body) {
    const nameError = validateCategoryName(body.name);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    update.name = (body.name as string).trim();
  }
  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be true or false' }, { status: 400 });
    }
    update.is_active = body.is_active;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data: current, error: readError } = await supabase
    .from('categories')
    .select('id, slug')
    .eq('id', id)
    .maybeSingle();
  if (readError) {
    if (isMissingTableError(readError)) return NextResponse.json(MIGRATION_PENDING, { status: 409 });
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  if (update.is_active === false && isSystemSlug(current.slug)) {
    return NextResponse.json(
      { error: 'Weekend packages are switched on and off on the Weekend packages page.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', id)
    .select('id, name, slug, sort_order, is_active')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  }
  return NextResponse.json({ category: data });
}
