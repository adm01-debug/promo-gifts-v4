import { describe, expect, it } from 'vitest';
import {
  extractArrivalFromSnapshot,
  extractPromises,
  extractPromisesFromSource,
  type SnapshotRow,
  type SourceRow,
} from '@/lib/inventory/supplier-reliability/extract';

const baseSource: SourceRow = {
  id: 'src-1',
  variant_id: 'var-1',
  supplier_id: 'sup-1',
  updated_at: '2026-06-01T10:00:00Z',
  next_quantity_1: null,
  next_date_1: null,
  next_quantity_2: null,
  next_date_2: null,
  next_quantity_3: null,
  next_date_3: null,
  next_quantity_4: null,
  next_date_4: null,
  next_quantity_5: null,
  next_date_5: null,
  next_quantity_6: null,
  next_date_6: null,
};

describe('extractPromisesFromSource', () => {
  it('retorna [] quando todos os slots vazios', () => {
    expect(extractPromisesFromSource(baseSource)).toEqual([]);
  });

  it('extrai promessas válidas de múltiplos slots e ignora inválidas', () => {
    const row: SourceRow = {
      ...baseSource,
      next_quantity_1: 5000,
      next_date_1: '2026-07-20',
      next_quantity_2: 0, // ignorado (≤0)
      next_date_2: '2026-08-01',
      next_quantity_3: 3000,
      next_date_3: 'invalid-date', // ignorado
      next_quantity_4: -10, // ignorado
      next_date_4: '2026-08-15',
      next_quantity_5: 250,
      next_date_5: '2026-09-01T00:00:00Z',
    };
    const out = extractPromisesFromSource(row);
    expect(out.map((p) => p.slot)).toEqual([1, 5]);
    expect(out[0]).toMatchObject({
      id: 'src-1:1',
      sourceId: 'src-1',
      supplierId: 'sup-1',
      variantId: 'var-1',
      promisedDate: '2026-07-20',
      promisedQuantity: 5000,
    });
    expect(out[1].promisedDate).toBe('2026-09-01');
  });

  it('descarta source sem variant_id ou supplier_id', () => {
    expect(extractPromisesFromSource({ ...baseSource, variant_id: null })).toEqual([]);
    expect(extractPromisesFromSource({ ...baseSource, supplier_id: null })).toEqual([]);
  });

  it('trunca quantidade fracionária', () => {
    const r: SourceRow = { ...baseSource, next_quantity_1: 99.9, next_date_1: '2026-07-20' };
    expect(extractPromisesFromSource(r)[0].promisedQuantity).toBe(99);
  });

  it('updated_at null gera observedAt do epoch', () => {
    const r: SourceRow = {
      ...baseSource,
      updated_at: null,
      next_quantity_1: 10,
      next_date_1: '2026-07-20',
    };
    expect(extractPromisesFromSource(r)[0].observedAt).toBe(new Date(0).toISOString());
  });
});

describe('extractPromises (batch)', () => {
  it('concatena sem ordenar e preserva ordem de slot', () => {
    const rows: SourceRow[] = [
      { ...baseSource, id: 'a', next_quantity_2: 10, next_date_2: '2026-07-01' },
      { ...baseSource, id: 'b', next_quantity_1: 20, next_date_1: '2026-06-01' },
    ];
    const out = extractPromises(rows);
    expect(out.map((p) => p.id)).toEqual(['a:2', 'b:1']);
  });
});

const baseSnap: SnapshotRow = {
  id: 'snap-1',
  variant_supplier_source_id: 'src-1',
  supplier_id: 'sup-1',
  variant_id: 'var-1',
  stock_main_old: 0,
  stock_main_new: 0,
  stock_other_old: 0,
  stock_other_new: 0,
  change_type: 'stock',
  captured_at: '2026-07-21T14:30:00Z',
};

describe('extractArrivalFromSnapshot', () => {
  it('extrai chegada com delta positivo em main', () => {
    const a = extractArrivalFromSnapshot({
      ...baseSnap,
      stock_main_old: 100,
      stock_main_new: 600,
    });
    expect(a).toMatchObject({ receivedQuantity: 500, receivedAt: '2026-07-21T14:30:00Z' });
  });

  it('soma main + other no delta', () => {
    const a = extractArrivalFromSnapshot({
      ...baseSnap,
      stock_main_old: 100,
      stock_main_new: 300,
      stock_other_old: 50,
      stock_other_new: 150,
    });
    expect(a?.receivedQuantity).toBe(300);
  });

  it('descarta delta zero ou negativo (saída/ajuste)', () => {
    expect(
      extractArrivalFromSnapshot({ ...baseSnap, stock_main_old: 100, stock_main_new: 100 }),
    ).toBeNull();
    expect(
      extractArrivalFromSnapshot({ ...baseSnap, stock_main_old: 100, stock_main_new: 50 }),
    ).toBeNull();
  });

  it('descarta change_type=price', () => {
    expect(
      extractArrivalFromSnapshot({
        ...baseSnap,
        change_type: 'price',
        stock_main_old: 0,
        stock_main_new: 500,
      }),
    ).toBeNull();
  });

  it('aceita change_type=both', () => {
    const a = extractArrivalFromSnapshot({
      ...baseSnap,
      change_type: 'both',
      stock_main_old: 0,
      stock_main_new: 200,
    });
    expect(a?.receivedQuantity).toBe(200);
  });

  it('descarta IDs faltantes', () => {
    expect(
      extractArrivalFromSnapshot({ ...baseSnap, variant_supplier_source_id: null }),
    ).toBeNull();
    expect(extractArrivalFromSnapshot({ ...baseSnap, variant_id: null })).toBeNull();
    expect(extractArrivalFromSnapshot({ ...baseSnap, supplier_id: null })).toBeNull();
  });

  it('trata nulls em colunas de quantidade como 0', () => {
    const a = extractArrivalFromSnapshot({
      ...baseSnap,
      stock_main_old: null,
      stock_main_new: 100,
      stock_other_old: null,
      stock_other_new: null,
    });
    expect(a?.receivedQuantity).toBe(100);
  });

  it('descarta captured_at inválido', () => {
    expect(extractArrivalFromSnapshot({ ...baseSnap, captured_at: 'bad' })).toBeNull();
    expect(extractArrivalFromSnapshot({ ...baseSnap, captured_at: null })).toBeNull();
  });
});
