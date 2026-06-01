/**
 * Unit tests for the direct-PostgREST helper (`src/lib/db/postgrest.ts`) that
 * replaced the external-db bridge. Verifies the translation logic the bridge's
 * rest-native layer used to own: table aliases, PT↔EN column remapping (filters
 * + returned rows), `_search` → `.ilike`, `.range()` pagination, the empty-`in()`
 * short-circuit and count mode.
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
    'select', 'eq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'neq',
    'not', 'order', 'range', 'insert', 'update', 'delete', 'upsert',
  ];
  return {
    supabase: {
      from: vi.fn((table: string) => {
        const rec: Recorded = { table, calls: [] };
        recorded.push(rec);
        const builder: Record<string, unknown> = {};
        for (const m of CHAIN_METHODS) {
          builder[m] = vi.fn((...args: unknown[]) => { rec.calls.push({ m, args }); return builder; });
        }
        (builder as { then: unknown }).then = (resolve: (v: typeof nextResult) => unknown) => resolve(nextResult);
        return builder;
      }),
    },
  };
});

import { dbInvoke } from '@/lib/db/postgrest';

const callsOf = (table: string) => recorded.find((r) => r.table === table)?.calls ?? [];
const callArgs = (table: string, method: string) =>
  callsOf(table).filter((c) => c.m === method).map((c) => c.args);

beforeEach(() => {
  recorded = [];
  nextResult = { data: [], error: null, count: null };
  vi.clearAllMocks();
});

describe('postgrest helper — table aliases', () => {
  it('resolves products → v_products_public', async () => {
    await dbInvoke({ table: 'products', operation: 'select', select: 'id,name', filters: { is_active: true } });
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
  it('aliases personalization_techniques → tecnicas_gravacao, remaps filters and rows', async () => {
    nextResult = {
      data: [{ codigo: 'c1', nome: 'Tampografia', ativo: true, ordem_exibicao: 3 }],
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
    // table alias
    expect(recorded.map((r) => r.table)).toContain('tecnicas_gravacao');
    // PT-named table selects '*' then maps rows back to EN
    expect(callArgs('tecnicas_gravacao', 'select')[0][0]).toBe('*');
    // filter column remapped is_active → ativo
    expect(callArgs('tecnicas_gravacao', 'eq')).toContainEqual(['ativo', true]);
    // orderBy column remapped display_order → ordem_exibicao
    expect(callArgs('tecnicas_gravacao', 'order')[0][0]).toBe('ordem_exibicao');
    // returned row remapped back to EN keys
    expect(result.records[0]).toMatchObject({ id: 'c1', name: 'Tampografia', is_active: true });
  });
});

describe('postgrest helper — _search', () => {
  it('translates _search into an ilike on the table search column', async () => {
    await dbInvoke({ table: 'products', operation: 'select', filters: { _search: 'caneta' } });
    expect(callArgs('v_products_public', 'ilike')).toContainEqual(['name', '%caneta%']);
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
