/**
 * Unit tests for the direct-PostgREST helper (`src/lib/db/postgrest.ts`) that
 * replaced the external-db bridge. Verifies the translation logic the bridge's
 * rest-native layer used to own: table aliases, PT↔EN column remapping (filters
 * + returned rows), `_search` → `.ilike`, `.range()` pagination, the empty-`in()`
 * short-circuit and count mode.
 *
 * @see src/lib/db/postgrest.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Recorded {
  table: string;
  calls: Array<{ m: string; args: unknown[] }>;
}

let recorded: Recorded[];
let nextResult: { data: unknown[] | null; error: { message: string } | null; count: number | null };

vi.mock('@/integrations/supabase/client', () => {
  const CHAIN_METHODS = [
    'select',
    'eq',
    'in',
    'is',
    'gte',
    'lte',
    'gt',
    'lt',
    'like',
    'ilike',
    'neq',
    'not',
    'order',
    'range',
    'insert',
    'update',
    'delete',
    'upsert',
    'or',
    'textSearch',
  ];
  return {
    supabase: {
      from: vi.fn((table: string) => {
        const rec: Recorded = { table, calls: [] };
        recorded.push(rec);
        const builder: Record<string, unknown> = {};
        for (const m of CHAIN_METHODS) {
          builder[m] = vi.fn((...args: unknown[]) => {
            rec.calls.push({ m, args });
            return builder;
          });
        }
        (builder as { then: unknown }).then = (resolve: (v: typeof nextResult) => unknown) =>
          resolve(nextResult);
        return builder;
      }),
    },
  };
});

import { dbInvoke, dbInvokeSingle } from '@/lib/db/postgrest';

const callsOf = (table: string) => recorded.find((r) => r.table === table)?.calls ?? [];
const callArgs = (table: string, method: string) =>
  callsOf(table)
    .filter((c) => c.m === method)
    .map((c) => c.args);

beforeEach(() => {
  recorded = [];
  nextResult = { data: [], error: null, count: null };
  vi.clearAllMocks();
});

describe('postgrest helper — table aliases', () => {
  it('resolves products → v_products_public', async () => {
    await dbInvoke({
      table: 'products',
      operation: 'select',
      select: 'id,name',
      filters: { is_active: true },
    });
    expect(recorded.map((r) => r.table)).toContain('v_products_public');
    expect(callArgs('v_products_public', 'select')[0][0]).toBe('id,name');
    expect(callArgs('v_products_public', 'eq')).toContainEqual(['is_active', true]);
  });

  it('resolves suppliers → v_suppliers_public', async () => {
    await dbInvoke({ table: 'suppliers', operation: 'select', select: 'id' });
    expect(recorded.map((r) => r.table)).toContain('v_suppliers_public');
  });
});

describe('postgrest helper — PT↔EN column remap', () => {
  // tabela_preco_gravacao_oficial is a real PT-named table: EN caller names are
  // remapped to PT columns on filters/select and rows are aliased back to EN.
  it('remaps EN filters/select to PT columns for tabela_preco_gravacao_oficial', async () => {
    nextResult = {
      data: [{ id: 't1', nome: 'Tampografia', ativo: true, max_cores: 4 }],
      error: null,
      count: null,
    };
    const result = await dbInvoke<Record<string, unknown>>({
      table: 'customization_price_tables', // bridge-era alias → tabela_preco_gravacao_oficial
      operation: 'select',
      select: 'id,name,is_active',
      filters: { is_active: true },
    });
    // table alias resolves to the real PT-named table
    expect(recorded.map((r) => r.table)).toContain('tabela_preco_gravacao_oficial');
    // EN filter column remapped is_active → ativo
    expect(callArgs('tabela_preco_gravacao_oficial', 'eq')).toContainEqual(['ativo', true]);
    // returned row aliased back to EN keys (name from nome, is_active from ativo)
    expect(result.records[0]).toMatchObject({ name: 'Tampografia', is_active: true });
  });

  // personalization_techniques is intentionally NOT aliased: it is a real table
  // in the canonical DB (uuid PK, native EN columns). Queries go directly to it
  // with no table alias and no column remapping. See rest-native.ts "BUG A".
  it('queries personalization_techniques directly with native EN columns (no alias/remap)', async () => {
    nextResult = {
      data: [{ id: 'u1', name: 'Tampografia', is_active: true, display_order: 3 }],
      error: null,
      count: null,
    };
    const result = await dbInvoke<Record<string, unknown>>({
      table: 'personalization_techniques',
      operation: 'select',
      select: 'id,name,is_active',
      filters: { is_active: true },
      orderBy: { column: 'display_order', ascending: true },
    });
    // no alias — the real table name is used verbatim
    expect(recorded.map((r) => r.table)).toContain('personalization_techniques');
    expect(recorded.map((r) => r.table)).not.toContain('tecnicas_gravacao');
    // EN select passed through unchanged (no remap for this real table)
    expect(callArgs('personalization_techniques', 'select')[0][0]).toBe('id,name,is_active');
    // EN filter column passed through unchanged
    expect(callArgs('personalization_techniques', 'eq')).toContainEqual(['is_active', true]);
    // orderBy column passed through unchanged
    expect(callArgs('personalization_techniques', 'order')[0][0]).toBe('display_order');
    // rows returned as-is (already EN)
    expect(result.records[0]).toMatchObject({ id: 'u1', name: 'Tampografia', is_active: true });
  });
});

describe('postgrest helper — _search', () => {
  it('translates _search into a textSearch on the search_vector column (FTS)', async () => {
    await dbInvoke({ table: 'products', operation: 'select', filters: { _search: 'caneta' } });
    const textSearchCalls = callArgs('v_products_public', 'textSearch');
    expect(textSearchCalls.length).toBeGreaterThan(0);
    expect(textSearchCalls[0][0]).toBe('search_vector');
    expect(textSearchCalls[0][1]).toBe('caneta');
  });
});

describe('postgrest helper — _name_prefix', () => {
  it('translates _name_prefix into a prefix .or() across name/sku/supplier_reference', async () => {
    await dbInvoke({
      table: 'products',
      operation: 'select',
      filters: { _name_prefix: '9429', active: true },
    });
    const orCalls = callArgs('v_products_public', 'or');
    expect(orCalls.length).toBeGreaterThan(0);
    expect(orCalls[0][0]).toBe('name.ilike.9429*,sku.ilike.9429*,supplier_reference.ilike.9429*');
    // _name_prefix must NOT leak into an .eq() (that produced PostgREST 42703).
    const eqCalls = callArgs('v_products_public', 'eq');
    expect(eqCalls.some((a) => a[0] === '_name_prefix')).toBe(false);
    // sibling real filters still apply
    expect(eqCalls).toContainEqual(['active', true]);
  });

  it('never emits an .eq() on the _name_prefix meta key (regression: "0 produtos")', async () => {
    await dbInvoke({
      table: 'products',
      operation: 'select',
      filters: { _name_prefix: 'caneta' },
    });
    const eqCalls = callArgs('v_products_public', 'eq');
    expect(eqCalls.some((a) => a[0] === '_name_prefix')).toBe(false);
  });
});

describe('postgrest helper — pagination', () => {
  it('maps limit+offset to .range(offset, offset+limit-1)', async () => {
    await dbInvoke({ table: 'products', operation: 'select', limit: 50, offset: 100 });
    expect(callArgs('v_products_public', 'range')[0]).toEqual([100, 149]);
  });
});

describe('postgrest helper — empty IN() short-circuit', () => {
  it('returns empty without hitting the database when a filter array is empty', async () => {
    const result = await dbInvoke({ table: 'products', operation: 'select', filters: { id: [] } });
    expect(result).toEqual({ records: [], count: 0 });
    expect(recorded.length).toBe(0); // from() never called
  });
});

describe('postgrest helper — count mode', () => {
  it('passes { count: "exact" } and returns the count', async () => {
    nextResult = { data: [{ id: 'p1' }], error: null, count: 42 };
    const result = await dbInvoke({ table: 'products', operation: 'select', countMode: 'exact' });
    expect(callArgs('v_products_public', 'select')[0][1]).toMatchObject({ count: 'exact' });
    expect(result.count).toBe(42);
  });
});

// REGRESSION: dbInvoke previously implemented only the READ path; write operations
// silently degraded into a `SELECT … LIMIT 1`, so product create/edit (and every other
// migrated write call-site) persisted nothing while still reporting success. These tests
// pin the write routing to the REST-native write engine.
describe('postgrest helper — WRITE routing', () => {
  it('routes insert to a real .insert() on the base table (never the Gold read view)', async () => {
    nextResult = { data: [{ id: 'new-1', sku: 'SKU-1', name: 'Caneta' }], error: null, count: null };
    const created = await dbInvokeSingle<{ id: string }>({
      table: 'products',
      operation: 'insert',
      data: { sku: 'SKU-1', name: 'Caneta' },
    });
    expect(recorded.map((r) => r.table)).toContain('products');
    expect(recorded.map((r) => r.table)).not.toContain('v_products_public');
    expect(callArgs('products', 'insert')[0][0]).toMatchObject({ sku: 'SKU-1', name: 'Caneta' });
    expect(created).toMatchObject({ id: 'new-1' });
  });

  it('routes update to .update() scoped by id', async () => {
    nextResult = { data: [{ id: 'p-9' }], error: null, count: null };
    await dbInvoke({ table: 'products', operation: 'update', id: 'p-9', data: { sale_price: 42 } });
    expect(callArgs('products', 'update')[0][0]).toMatchObject({ sale_price: 42 });
    expect(callArgs('products', 'eq')).toContainEqual(['id', 'p-9']);
  });

  it('routes delete to .delete() scoped by id', async () => {
    nextResult = { data: [{ id: 'p-9' }], error: null, count: null };
    await dbInvoke({ table: 'products', operation: 'delete', id: 'p-9' });
    expect(callsOf('products').some((c) => c.m === 'delete')).toBe(true);
    expect(callArgs('products', 'eq')).toContainEqual(['id', 'p-9']);
  });

  it('fails loud for a write to a non-write-eligible table (no silent SELECT fallback)', async () => {
    await expect(
      dbInvoke({ table: 'frontend_telemetry', operation: 'insert', data: { a: 1 } }),
    ).rejects.toThrow(/not supported|REST_NATIVE_WRITE_TABLES/);
    expect(recorded.length).toBe(0); // never touched the database
  });
});
