/**
 * Testes — quoteHelpers: validateDiscount + calculateQuoteTotals + round2
 * Cobre a logica central de calculo de orcamentos:
 *   - validateDiscount: validacao de desconto com nova assinatura (Partial<Quote>, totals)
 *   - calculateQuoteTotals: markup [0,50], desconto, frete, BUG-NEW-03
 *   - round2: arredondamento monetario SSOT
 */
import { describe, it, expect } from 'vitest';
import { validateDiscount, calculateQuoteTotals, round2 } from '../quoteHelpers';
import type { Quote, QuoteItem } from '../quoteTypes';

// -- validateDiscount ---------------------------------------------------------
describe('quoteHelpers validation logic', () => {
  it('throws error when percent is > 100', () => {
    expect(() =>
      validateDiscount({ discount_percent: 101 } as Partial<Quote>, { subtotal: 100, discountAmount: 101 })
    ).toThrow();
  });

  it('throws error when amount is > subtotal', () => {
    expect(() =>
      validateDiscount({} as Partial<Quote>, { subtotal: 100, discountAmount: 150 })
    ).toThrow();
  });

  it('throws error when discount is negative', () => {
    expect(() =>
      validateDiscount({ discount_percent: -1 } as Partial<Quote>, { subtotal: 100, discountAmount: 0 })
    ).toThrow();
  });

  it('passes for valid discount (edge cases)', () => {
    expect(() =>
      validateDiscount({ discount_percent: 0 } as Partial<Quote>, { subtotal: 100, discountAmount: 0 })
    ).not.toThrow();
    expect(() =>
      validateDiscount({ discount_percent: 100 } as Partial<Quote>, { subtotal: 100, discountAmount: 100 })
    ).not.toThrow();
    expect(() =>
      validateDiscount({} as Partial<Quote>, { subtotal: 100, discountAmount: 100 })
    ).not.toThrow();
  });
});

// -- Helpers ------------------------------------------------------------------
function makeItem(qty: number, price: number, persTotal = 0): QuoteItem {
  return {
    id: 'i1', quote_id: 'q1', product_id: 'p1',
    product_name: 'Prod', product_sku: 'SKU',
    unit_price: price, quantity: qty,
    personalizations: persTotal > 0
      ? [{ id: 'per1', quote_item_id: 'i1', name: 'Grav',
           total_cost: persTotal, unit_cost: persTotal,
           quantity: qty, organization_id: 'org1' }]
      : [],
  } as unknown as QuoteItem;
}

// -- calculateQuoteTotals -----------------------------------------------------
describe('calculateQuoteTotals — logica central de orcamentos', () => {
  it('calcula realSubtotal: soma qty x price de todos os itens', () => {
    const r = calculateQuoteTotals({}, [makeItem(3, 10), makeItem(2, 20)]);
    expect(r.realSubtotal).toBe(70);
  });

  it('inclui personalizations no realSubtotal', () => {
    const r = calculateQuoteTotals({}, [makeItem(2, 10, 5)]);
    expect(r.realSubtotal).toBe(25);
  });

  it('subtotal === realSubtotal quando markup === 0', () => {
    const r = calculateQuoteTotals({ negotiation_markup_percent: 0 }, [makeItem(1, 100)]);
    expect(r.subtotal).toBe(r.realSubtotal);
    expect(r.markup).toBe(0);
  });

  it('sem itens: todos os valores sao 0', () => {
    const r = calculateQuoteTotals({}, []);
    expect(r.realSubtotal).toBe(0);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });

  it('aplica markup de 10% sobre realSubtotal', () => {
    const r = calculateQuoteTotals({ negotiation_markup_percent: 10 }, [makeItem(1, 100)]);
    expect(r.subtotal).toBe(110);
    expect(r.markup).toBe(10);
  });

  it('aplica markup de 50% (limite maximo permitido)', () => {
    const r = calculateQuoteTotals({ negotiation_markup_percent: 50 }, [makeItem(1, 200)]);
    expect(r.subtotal).toBe(300);
  });

  it('lanca erro quando markup > 50% — BUG-NEW-03', () => {
    expect(() =>
      calculateQuoteTotals({ negotiation_markup_percent: 51 }, [makeItem(1, 100)])
    ).toThrow('50%');
  });

  it('markup negativo e clamped para 0', () => {
    const r = calculateQuoteTotals({ negotiation_markup_percent: -5 }, [makeItem(1, 100)]);
    expect(r.markup).toBe(0);
    expect(r.subtotal).toBe(100);
  });

  it('desconto por percentual: 10% sobre subtotal 100 = 10', () => {
    const r = calculateQuoteTotals({ discount_percent: 10 } as Partial<Quote>, [makeItem(1, 100)]);
    expect(r.discountAmount).toBe(10);
    expect(r.total).toBe(90);
  });

  it('desconto por valor absoluto: discount_amount = 15', () => {
    const r = calculateQuoteTotals({ discount_amount: 15 } as Partial<Quote>, [makeItem(1, 100)]);
    expect(r.discountAmount).toBe(15);
    expect(r.total).toBe(85);
  });

  it('sem desconto: discountAmount = 0', () => {
    const r = calculateQuoteTotals({}, [makeItem(1, 100)]);
    expect(r.discountAmount).toBe(0);
    expect(r.total).toBe(100);
  });

  it('frete adicionado ao total quando shipping_type = fob_pre', () => {
    const r = calculateQuoteTotals(
      { shipping_type: 'fob_pre', shipping_cost: 25 } as Partial<Quote>,
      [makeItem(1, 100)]
    );
    expect(r.total).toBe(125);
  });

  it('frete ignorado quando shipping_type nao e fob_pre', () => {
    const r = calculateQuoteTotals(
      { shipping_type: 'cif', shipping_cost: 25 } as Partial<Quote>,
      [makeItem(1, 100)]
    );
    expect(r.total).toBe(100);
  });

  it('cenario combinado: markup 20% + desconto 10% + frete 10 = 118', () => {
    const r = calculateQuoteTotals(
      { negotiation_markup_percent: 20, discount_percent: 10,
        shipping_type: 'fob_pre', shipping_cost: 10 } as Partial<Quote>,
      [makeItem(1, 100)]
    );
    expect(r.realSubtotal).toBe(100);
    expect(r.subtotal).toBe(120);
    expect(r.discountAmount).toBe(12);
    expect(r.total).toBe(118);
  });

  it('valores arredondados para 2 casas decimais', () => {
    const r = calculateQuoteTotals(
      { discount_percent: 1 } as Partial<Quote>,
      [makeItem(1, 33.33)]
    );
    expect(Number.isFinite(r.total)).toBe(true);
    expect((r.total.toString().split('.')[1]?.length ?? 0)).toBeLessThanOrEqual(2);
  });

  it('round2: half-up, null/undefined => 0', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(null)).toBe(0);
    expect(round2(undefined)).toBe(0);
  });
});
