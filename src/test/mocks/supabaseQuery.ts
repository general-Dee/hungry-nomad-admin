import { vi } from 'vitest';

type Result = { data?: unknown; error?: unknown };

/**
 * Minimal chainable fake of the Supabase query builder. Every call is recorded
 * in `calls`; awaiting a chain resolves to the next queued result for that
 * table (`queue(table, result)`), defaulting to { data: null, error: null }.
 */
export function createQueryMock() {
  const queues: Record<string, Result[]> = {};
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  function builder(table: string) {
    const b: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'neq', 'order', 'maybeSingle', 'single']) {
      b[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    }
    b.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => {
      const next = queues[table]?.shift() ?? { data: null, error: null };
      return Promise.resolve({ data: null, error: null, ...next }).then(resolve, reject);
    };
    return b;
  }

  const from = vi.fn((table: string) => builder(table));
  return {
    from,
    calls,
    queue(table: string, result: Result) {
      (queues[table] ||= []).push(result);
    },
    reset() {
      calls.length = 0;
      for (const k of Object.keys(queues)) delete queues[k];
      from.mockClear();
    },
    callsFor(table: string, method: string) {
      return calls.filter((c) => c.table === table && c.method === method);
    },
  };
}
