/**
 * Resilience contract for the direct-PostgREST read path (`dbInvoke`): when the
 * deprecated bridge relation answers `410 Gone`, a READ must degrade to an empty
 * result — definitively, with no throw and no retry — so stock/catalog screens
 * render a friendly empty state instead of crashing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let fromCallCount: number;
let nextResult: { data: unknown[] | null; error: { message: string } | null; count: number | null };

vi.mock('@/integrations/supabase/client', () => {
  const CHAIN_METHODS = ['select', 'eq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'neq', 'not', 'order', 'range'];
  return {
    supabase: {
      from: vi.fn(() => {
        fromCallCount += 1;
        const builder: Record<string, unknown> = {};
        for (const m of CHAIN_METHODS) builder[m] = vi.fn(() => builder);
        (builder as { then: unknown }).then = (resolve: (v: typeof nextResult) => unknown) => resolve(nextResult);
        return builder;
      }),
    },
  };
});

import { dbInvoke } from '@/lib/db/postgrest';

beforeEach(() => {
  fromCallCount = 0;
  vi.clearAllMocks();
});

describe('dbInvoke read resilience — 410 Gone', () => {
  it('returns an empty result (no throw) when the relation is 410 Gone', async () => {
    nextResult = { data: null, error: { message: 'PostgREST error: 410 Gone — relation deprecated' }, count: null };
    const result = await dbInvoke({ table: 'stock_daily_summary', operation: 'select' });
    expect(result).toEqual({ records: [], count: 0 });
  });

  it('does not retry the request on 410 (single round-trip)', async () => {
    nextResult = { data: null, error: { message: 'Gone' }, count: null };
    await dbInvoke({ table: 'products', operation: 'select', filters: { is_active: true } });
    expect(fromCallCount).toBe(1);
  });

  it('still throws for non-410 read errors (honest failure)', async () => {
    nextResult = { data: null, error: { message: 'permission denied for relation products' }, count: null };
    await expect(dbInvoke({ table: 'products', operation: 'select' })).rejects.toThrow(/permission denied/);
  });
});
