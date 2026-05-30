import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the last from()/mutation call shape + drive the resolved result.
const h = vi.hoisted(() => ({
  log: {} as Record<string, unknown>,
  result: { data: [] as Record<string, unknown>[] | null, error: null as { message: string } | null },
  reset() {
    this.log = { table: null, method: null, values: null, upsertOpts: null, filters: [] as unknown[], selected: false };
    this.result = { data: [], error: null };
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const makeThenable = () => {
    const t: Record<string, unknown> = {};
    for (const m of ['eq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'neq']) {
      t[m] = (c: string, v: unknown) => { (h.log.filters as unknown[]).push([m, c, v]); return t; };
    }
    t.not = (c: string, op: string, v: unknown) => { (h.log.filters as unknown[]).push(['not', c, op, v]); return t; };
    t.select = () => { h.log.selected = true; return Promise.resolve(h.result); };
    (t as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(h.result).then(res, rej);
    return t;
  };
  return {
    supabase: {
      from: (table: string) => {
        h.log.table = table;
        return {
          insert: (values: unknown) => { h.log.method = 'insert'; h.log.values = values; return { select: () => { h.log.selected = true; return Promise.resolve(h.result); } }; },
          upsert: (values: unknown, opts?: unknown) => { h.log.method = 'upsert'; h.log.values = values; h.log.upsertOpts = opts ?? null; return { select: () => { h.log.selected = true; return Promise.resolve(h.result); } }; },
          update: (values: unknown) => { h.log.method = 'update'; h.log.values = values; return makeThenable(); },
          delete: () => { h.log.method = 'delete'; return makeThenable(); },
        };
      },
    },
  };
});

import { executeRestNativeWrite, isRestNativeWriteEligible, resolveWriteTable } from '@/lib/external-db/rest-native-write';

beforeEach(() => h.reset());

describe('resolveWriteTable / isRestNativeWriteEligible', () => {
  it('resolves writes to BASE tables, never masked read views', () => {
    expect(resolveWriteTable('products')).toBe('products');
    expect(resolveWriteTable('suppliers')).toBe('suppliers');
    expect(resolveWriteTable('print_area_techniques')).toBe('print_area_techniques');
    expect(resolveWriteTable('tecnica_gravacao')).toBe('tabela_preco_gravacao_oficial');
    expect(resolveWriteTable('customization_price_tiers')).toBe('tabela_preco_gravacao_oficial_faixa');
    expect(resolveWriteTable('personalization_techniques')).toBe('tecnicas_gravacao');
  });

  it('rejects views, seller-owned and non-existent tables', () => {
    for (const t of ['products', 'suppliers', 'product_variants', 'tecnica_gravacao', 'tecnicas_gravacao']) {
      expect(isRestNativeWriteEligible(t)).toBe(true);
    }
    for (const t of ['v_products_public', 'v_suppliers_public', 'orders', 'order_items', 'quotes', 'user_roles', 'fornecedor_gravacao', 'tecnica_gravacao_variante']) {
      expect(isRestNativeWriteEligible(t)).toBe(false);
    }
  });
});

describe('executeRestNativeWrite', () => {
  it('insert targets BASE products (not the masked view) and keeps base columns', async () => {
    h.result = { data: [{ id: 'p1' }], error: null };
    const r = await executeRestNativeWrite({ table: 'products', operation: 'insert', data: { name: 'X', cost_price: 9 } });
    expect(h.log.table).toBe('products');
    expect((h.log.values as Record<string, unknown>).cost_price).toBe(9);
    expect(h.log.selected).toBe(true);
    expect(r.records).toHaveLength(1);
    expect(r.count).toBe(1);
  });

  it('drops spurious slug when writing técnica to tabela_preco_gravacao_oficial', async () => {
    h.result = { data: [{ id: 't1', nome: 'Serigrafia', ativo: true }], error: null };
    await executeRestNativeWrite({ table: 'tecnica_gravacao', operation: 'insert', data: { nome: 'Serigrafia', slug: 'serigrafia', ativo: true } });
    expect(h.log.table).toBe('tabela_preco_gravacao_oficial');
    expect('slug' in (h.log.values as Record<string, unknown>)).toBe(false);
    expect((h.log.values as Record<string, unknown>).nome).toBe('Serigrafia');
  });

  it('remaps EN→PT for tecnicas_gravacao on write and back to legacy shape on read', async () => {
    h.result = { data: [{ codigo: 'C1', nome: 'Tampografia', ativo: true, ordem_exibicao: 3 }], error: null };
    const r = await executeRestNativeWrite({ table: 'personalization_techniques', operation: 'insert', data: { name: 'Tampografia', is_active: true, display_order: 3 } });
    expect(h.log.table).toBe('tecnicas_gravacao');
    const v = h.log.values as Record<string, unknown>;
    expect(v.nome).toBe('Tampografia');
    expect(v.ativo).toBe(true);
    expect(v.ordem_exibicao).toBe(3);
    expect('name' in v).toBe(false);
    expect((r.records[0] as Record<string, unknown>).id).toBe('C1');
    expect((r.records[0] as Record<string, unknown>).name).toBe('Tampografia');
    expect((r.records[0] as Record<string, unknown>).is_active).toBe(true);
  });

  it('refuses unfiltered UPDATE / DELETE (anti-mass-mutation guard)', async () => {
    await expect(executeRestNativeWrite({ table: 'products', operation: 'update', data: { name: 'x' } })).rejects.toThrow('anti-mass-mutation');
    await expect(executeRestNativeWrite({ table: 'products', operation: 'delete' })).rejects.toThrow('anti-mass-mutation');
    await expect(executeRestNativeWrite({ table: 'products', operation: 'update', filters: {}, data: { name: 'x' } })).rejects.toThrow('anti-mass-mutation');
  });

  it('update by id applies eq(id) and returns representation', async () => {
    h.result = { data: [{ id: 'p1' }], error: null };
    await executeRestNativeWrite({ table: 'suppliers', operation: 'update', id: 's1', data: { markup_percent: 10 } });
    expect(h.log.table).toBe('suppliers');
    expect(h.log.method).toBe('update');
    expect((h.log.filters as unknown[])[0]).toEqual(['eq', 'id', 's1']);
  });

  it('delete by id returns deleted rows', async () => {
    h.result = { data: [{ id: 'd1' }], error: null };
    const r = await executeRestNativeWrite({ table: 'tabela_preco_gravacao_oficial', operation: 'delete', id: 'd1' });
    expect(h.log.method).toBe('delete');
    expect((h.log.filters as unknown[])[0]).toEqual(['eq', 'id', 'd1']);
    expect(r.count).toBe(1);
  });

  it('batch_insert without onConflict → insert; with onConflict → upsert', async () => {
    h.result = { data: [{ id: '1' }, { id: '2' }], error: null };
    await executeRestNativeWrite({ table: 'products', operation: 'batch_insert', data: [{ sku: 'A' }, { sku: 'B' }] });
    expect(h.log.method).toBe('insert');
    expect(Array.isArray(h.log.values)).toBe(true);

    h.reset();
    h.result = { data: [{ id: '1' }], error: null };
    await executeRestNativeWrite({ table: 'products', operation: 'batch_insert', data: [{ sku: 'A' }], onConflict: 'sku' });
    expect(h.log.method).toBe('upsert');
    expect((h.log.upsertOpts as { onConflict?: string }).onConflict).toBe('sku');
  });

  it('throws on empty batch_insert', async () => {
    await expect(executeRestNativeWrite({ table: 'products', operation: 'batch_insert', data: [] })).rejects.toThrow('empty data');
  });

  it('propagates PostgREST/RLS errors loudly', async () => {
    h.result = { data: null, error: { message: 'new row violates row-level security policy' } };
    await expect(executeRestNativeWrite({ table: 'products', operation: 'insert', data: { name: 'x' } })).rejects.toThrow('row-level security');
  });

  it('throws for non-whitelisted tables', async () => {
    await expect(executeRestNativeWrite({ table: 'fornecedor_gravacao', operation: 'delete', id: 'x' })).rejects.toThrow('not allowed for writes');
    await expect(executeRestNativeWrite({ table: 'tecnica_gravacao_variante', operation: 'insert', data: {} })).rejects.toThrow('not allowed for writes');
  });

  it('parses filters: array→in, null→is, postgrest string', async () => {
    h.result = { data: [], error: null };
    await executeRestNativeWrite({ table: 'product_materials', operation: 'delete', filters: { product_id: ['p1', 'p2'], deleted_at: null, code: 'eq.X' } });
    const fl = h.log.filters as unknown[][];
    expect(fl.some((f) => f[0] === 'in' && f[1] === 'product_id')).toBe(true);
    expect(fl.some((f) => f[0] === 'is' && f[1] === 'deleted_at' && f[2] === null)).toBe(true);
    expect(fl.some((f) => f[0] === 'eq' && f[1] === 'code' && f[2] === 'X')).toBe(true);
  });
});
