import { vi } from 'vitest';

/**
 * Chainable mock matching the subset of the Supabase JS client used by
 * getSupabaseAdmin() call sites: .auth.admin.generateLink(), and
 * .from(table).insert(...) / .from(table).update(...).eq(...).select(...).
 * Each spy is also exposed at the top level so tests can assert on calls
 * and reconfigure resolved values without re-deriving the chain.
 */
export function createSupabaseAdminMock() {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const select = vi.fn().mockResolvedValue({ data: [{ id: 'row-1' }], error: null });
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ insert, update }));
  const generateLink = vi.fn();

  return {
    from,
    insert,
    update,
    eq,
    select,
    auth: { admin: { generateLink } },
  };
}

export type SupabaseAdminMock = ReturnType<typeof createSupabaseAdminMock>;
