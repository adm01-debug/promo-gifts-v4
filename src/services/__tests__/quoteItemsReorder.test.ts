import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistItemsOrder } from '@/services/quoteItemsReorder';

const updateCalls: Array<{ id: string; sort_order: number }> = [];

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        update: (patch: { sort_order: number }) => ({
          eq: (_col1: string, val1: string) => ({
            eq: (_col2: string, _val2: string) => {
              updateCalls.push({ id: val1, sort_order: patch.sort_order });
              return Promise.resolve({ error: null });
            },
          }),
        }),
      })),
    },
  };
});

vi.mock('@/lib/security/sanitize-message', () => ({
  sanitizeMessage: (e: unknown, opts: { fallback: string }) => opts.fallback,
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

describe('persistItemsOrder', () => {
  beforeEach(() => {
    updateCalls.length = 0;
  });

  it('persists each row with correct sort_order', async () => {
    const rows = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ];
    const n = await persistItemsOrder('q1', rows);
    expect(n).toBe(3);
    expect(updateCalls).toEqual(rows);
  });

  it('skips rows without id', async () => {
    const rows = [
      { id: '', sort_order: 0 },
      { id: 'b', sort_order: 1 },
    ];
    const n = await persistItemsOrder('q1', rows);
    expect(n).toBe(1);
    expect(updateCalls).toEqual([{ id: 'b', sort_order: 1 }]);
  });

  it('throws when quoteId is missing', async () => {
    await expect(persistItemsOrder('', [{ id: 'a', sort_order: 0 }])).rejects.toThrow();
  });

  it('returns 0 for empty input', async () => {
    const n = await persistItemsOrder('q1', []);
    expect(n).toBe(0);
  });
});
