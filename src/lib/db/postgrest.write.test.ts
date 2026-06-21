/**
 * Regression guard for the PostgREST write path.
 *
 * Background: `dbInvoke` historically only ever issued `.select()`, so callers
 * passing operation:'insert'|'update'|'upsert'|'delete' performed a silent no-op
 * read and reported a false success — product create/edit, bulk activate/deactivate,
 * new category/supplier, etc. never persisted. These tests assert that writes now
 * issue real DML against the BASE table (never the read-only Gold view) and return
 * the affected row, and that the mass-mutation guard is enforced.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Fake PostgREST builder that records the chained operations ──────────────────
interface RecordedCall {
  op: string;
  args: unknown[];
}
let recorded: RecordedCall[] = [];
let resolveValue: { data: unknown; error: unknown; count?: number | null } = {
  data: [],
  error: null,
  count: 0,
};

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const record =
    (op: string) =>
    (...args: unknown[]) => {
      recorded.push({ op, args });
      return builder;
    };
  for (const op of [
    'insert',
    'update',
    'upsert',
    'delete',
    'select',
    'eq',
    'in',
    'is',
    'order',
    'range',
    'ilike',
    'or',
    'textSearch',
    'abortSignal',
  ]) {
    builder[op] = record(op);
  }
  (builder as { then: unknown }).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(resolveValue).then(onFulfilled);
  return builder;
}

const untypedFromMock = vi.fn(() => makeBuilder());
vi.mock('@/lib/supabase-untyped', () => ({
  untypedFrom: (table: string) => untypedFromMock(table),
}));

import { dbInvoke, dbInvokeSingle } from './postgrest';

function opsByName(name: string) {
  return recorded.filter((c) => c.op === name);
}

beforeEach(() => {
  recorded = [];
  untypedFromMock.mockClear();
  resolveValue = { data: [], error: null, count: 0 };
});

describe('postgrest write path', () => {
  it('INSERT issues .insert(payload).select() against the BASE table and returns the new row', async () => {
    resolveValue = { data: [{ id: 'new-123', sku: 'SKU-1' }], error: null };
    const payload = { sku: 'SKU-1', name: 'Brinde Teste' };

    const row = await dbInvokeSingle<{ id: string; sku: string }>({
      table: 'products',
      operation: 'insert',
      data: payload,
    });

    // Writes MUST target the base `products` table, never the Gold read-view
    // `v_products_public` (which has no DML grant).
    expect(untypedFromMock).toHaveBeenCalledWith('products');
    expect(opsByName('insert')).toHaveLength(1);
    expect(opsByName('insert')[0].args[0]).toEqual(payload);
    // .select() is required so the inserted row (and its real id) comes back.
    expect(opsByName('select')).toHaveLength(1);
    // Critically: a write must NEVER fall through to a plain SELECT.
    expect(opsByName('order')).toHaveLength(0);
    expect(row).toEqual({ id: 'new-123', sku: 'SKU-1' });
  });

  it('UPDATE scopes by id and issues .update(payload).eq("id", id).select()', async () => {
    resolveValue = { data: [{ id: 'p1', is_active: false }], error: null };

    await dbInvokeSingle({
      table: 'products',
      operation: 'update',
      id: 'p1',
      data: { is_active: false, updated_at: '2026-06-20T00:00:00Z' },
    });

    expect(untypedFromMock).toHaveBeenCalledWith('products');
    expect(opsByName('update')).toHaveLength(1);
    expect(opsByName('update')[0].args[0]).toMatchObject({ is_active: false });
    expect(opsByName('eq')).toContainEqual({ op: 'eq', args: ['id', 'p1'] });
    expect(opsByName('select')).toHaveLength(1);
  });

  it('UPDATE without id or filters is rejected by the mass-mutation guard', async () => {
    await expect(
      dbInvoke({ table: 'products', operation: 'update', data: { is_active: false } }),
    ).rejects.toThrow(/mass-mutation guard/i);
    // No DML may have been issued.
    expect(opsByName('update')).toHaveLength(0);
  });

  it('DELETE without scope is rejected by the mass-mutation guard', async () => {
    await expect(dbInvoke({ table: 'products', operation: 'delete' })).rejects.toThrow(
      /mass-mutation guard/i,
    );
    expect(opsByName('delete')).toHaveLength(0);
  });

  it('UPSERT issues .upsert(payload).select()', async () => {
    resolveValue = { data: [{ id: 'u1' }], error: null };
    await dbInvoke({
      table: 'product_tags',
      operation: 'upsert',
      data: { product_id: 'a', tag_id: 'b' },
    });
    expect(opsByName('upsert')).toHaveLength(1);
    expect(opsByName('select')).toHaveLength(1);
  });

  it('SELECT still reads (no write ops issued)', async () => {
    resolveValue = { data: [{ id: 'x' }], error: null, count: 1 };
    const result = await dbInvoke({ table: 'products', operation: 'select', limit: 1 });
    expect(opsByName('select')).toHaveLength(1);
    expect(opsByName('insert')).toHaveLength(0);
    expect(opsByName('update')).toHaveLength(0);
    expect(result.records).toEqual([{ id: 'x' }]);
  });
});
