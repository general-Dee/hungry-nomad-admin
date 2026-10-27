import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export type StaffContext = { supabase: SupabaseClient; user: User };

/**
 * Server-side check for admin API routes. Same session check as
 * /api/admin/invite (Supabase session cookie -> getUser), plus the staff role
 * that the RLS policies require (app_metadata.role = 'staff', set by the invite
 * flow). The returned client uses the caller's session (anon key + cookie), not
 * the service role, so the database's RLS still applies to every write.
 */
export async function requireStaff(): Promise<StaffContext | NextResponse> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.app_metadata?.role !== 'staff') {
    return NextResponse.json({ error: 'Your account does not have the staff role.' }, { status: 403 });
  }
  return { supabase: supabase as unknown as SupabaseClient, user };
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
