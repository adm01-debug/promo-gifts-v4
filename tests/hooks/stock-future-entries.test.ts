/**
 * buildFutureEntries / nextStockPairs — montagem de reposições futuras a partir
 * dos 6 slots (`next_quantity_1..6` / `next_date_1..6`) de
 * `variant_supplier_sources`.
 *
 * Cobre o fix F2 da auditoria (antes só os slots 1–3 eram lidos → chegadas 4–6
 * sumiam silenciosamente) e a regra de status (slot 1 = confirmed, demais =
 * pending) e de filtragem (qtd ≤ 0 ou sem data não vira entrada).
 */
import { describe, it, expect } from 'vitest';
import {
  buildFutureEntries,
  nextStockPairs,
  type ExternalSupplierSource,
} from '@/hooks/stock/stockFetcher';

const source = (over: Partial<ExternalSupplierSource>): ExternalSupplierSource => ({
  id: 'vss-1',
  variant_id: 'v1',
  quantity: 100,
  updated_at: '2026-06-01T00:00:00.000Z',
  ...over,
});

describe('nextStockPairs — 6 slots', () => {
  it('expõe os 6 slots na ordem, com status confirmed no 1 e pending no resto', () => {
    const pairs = nextStockPairs(
      source({
        next_quantity_1: 10,
        next_date_1: '2026-07-01',
        next_quantity_6: 60,
        next_date_6: '2026-12-01',
      }),
    );
    expect(pairs).toHaveLength(6);
    expect(pairs.map((p) => p.suffix)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(pairs[0].status).toBe('confirmed');
    expect(pairs.slice(1).every((p) => p.status === 'pending')).toBe(true);
    expect(pairs[5].q).toBe(60);
    expect(pairs[5].d).toBe('2026-12-01');
  });
});

describe('buildFutureEntries', () => {
  it('inclui TODAS as chegadas válidas dos 6 slots (regressão F2)', () => {
    const entries = buildFutureEntries(
      source({
        next_quantity_1: 10,
        next_date_1: '2026-07-01',
        next_quantity_2: 20,
        next_date_2: '2026-08-01',
        next_quantity_3: 30,
        next_date_3: '2026-09-01',
        next_quantity_4: 40,
        next_date_4: '2026-10-01',
        next_quantity_5: 50,
        next_date_5: '2026-11-01',
        next_quantity_6: 60,
        next_date_6: '2026-12-01',
      }),
      'p1',
      'v1',
      'Azul',
      'Produto 1',
      'P1',
    );
    expect(entries).toHaveLength(6);
    expect(entries.reduce((s, e) => s + e.expectedQuantity, 0)).toBe(210);
    // ids únicos por slot
    expect(new Set(entries.map((e) => e.id)).size).toBe(6);
    // status: 1 = confirmed, demais = pending
    expect(entries[0].status).toBe('confirmed');
    expect(entries.slice(1).every((e) => e.status === 'pending')).toBe(true);
    // metadados propagados
    expect(entries[0]).toMatchObject({
      productId: 'p1',
      variantId: 'v1',
      colorName: 'Azul',
      productName: 'Produto 1',
      productSku: 'P1',
      source: 'purchase_order',
    });
  });

  it('ignora slots com quantidade 0/negativa ou sem data', () => {
    const entries = buildFutureEntries(
      source({
        next_quantity_1: 0, // 0 → ignorado (regressão BUG-STOCK-01: nada de cair fora por falsy)
        next_date_1: '2026-07-01',
        next_quantity_2: 20,
        next_date_2: null, // sem data → ignorado
        next_quantity_3: -5, // negativo → ignorado
        next_date_3: '2026-09-01',
        next_quantity_4: 40,
        next_date_4: '2026-10-01', // único válido
      }),
      'p1',
      'v1',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].expectedQuantity).toBe(40);
    expect(entries[0].expectedDate).toBe('2026-10-01');
  });

  it('sem nenhum slot preenchido → lista vazia', () => {
    expect(buildFutureEntries(source({}), 'p1', 'v1')).toEqual([]);
  });

  it('usa updated_at como timestamp das entradas quando presente', () => {
    const entries = buildFutureEntries(
      source({ next_quantity_1: 5, next_date_1: '2026-07-01', updated_at: '2026-06-10T12:00:00.000Z' }),
      'p1',
      'v1',
    );
    expect(entries[0].createdAt).toBe('2026-06-10T12:00:00.000Z');
    expect(entries[0].updatedAt).toBe('2026-06-10T12:00:00.000Z');
  });
});
