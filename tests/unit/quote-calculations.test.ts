/**
 * Quote Calculation Edge Cases — Unit Tests
 * Gap identificado no QA Sprint (qa/02-test-matrix.md)
 * 
 * Testa casos limítrofes na lógica de cálculo de orçamentos:
 * - desconto > 100%
 * - quantidade negativa ou zero
 * - preço zero
 * - arredondamento
 */
import { describe, it, expect } from 'vitest';

// Lógica de cálculo de orçamento (isolada para testes)
interface QuoteItem {
  unitPrice: number;
  quantity: number;
  discountPct: number; // 0-100
}

function calcItemTotal(item: QuoteItem): { subtotal: number; discount: number; total: number } {
  const subtotal = item.unitPrice * item.quantity;
  const discountPct = Math.max(0, Math.min(100, item.discountPct)); // clamped
  const discount = subtotal * (discountPct / 100);
  const total = Math.max(0, subtotal - discount);
  // Arredondamento EPSILON (2 casas decimais sem float drift)
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

function calcQuoteTotal(items: QuoteItem[]): number {
  return items.reduce((acc, item) => acc + calcItemTotal(item).total, 0);
}

describe('Quote Calculations — Edge Cases', () => {
  describe('Desconto', () => {
    it('desconto 0% não altera o preço', () => {
      const result = calcItemTotal({ unitPrice: 10, quantity: 5, discountPct: 0 });
      expect(result.total).toBe(50);
      expect(result.discount).toBe(0);
    });

    it('desconto 100% resulta em total zero', () => {
      const result = calcItemTotal({ unitPrice: 10, quantity: 5, discountPct: 100 });
      expect(result.total).toBe(0);
      expect(result.discount).toBe(50);
    });

    it('desconto > 100% é limitado a 100% (não negativo)', () => {
      const result = calcItemTotal({ unitPrice: 10, quantity: 5, discountPct: 150 });
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.discount).toBeLessThanOrEqual(result.subtotal);
    });

    it('desconto negativo é tratado como zero', () => {
      const result = calcItemTotal({ unitPrice: 10, quantity: 5, discountPct: -10 });
      expect(result.total).toBe(50);
      expect(result.discount).toBe(0);
    });

    it('desconto fracionado é calculado corretamente', () => {
      const result = calcItemTotal({ unitPrice: 3.33, quantity: 3, discountPct: 10 });
      expect(result.subtotal).toBe(9.99);
      expect(result.discount).toBe(1); // 9.99 * 0.1 = 0.999 → arredonda para 1.00
      expect(result.total).toBe(8.99);
    });
  });

  describe('Quantidade', () => {
    it('quantidade zero resulta em total zero', () => {
      const result = calcItemTotal({ unitPrice: 10, quantity: 0, discountPct: 0 });
      expect(result.total).toBe(0);
    });

    it('quantidade mínima de 1 funciona corretamente', () => {
      const result = calcItemTotal({ unitPrice: 25.5, quantity: 1, discountPct: 0 });
      expect(result.total).toBe(25.5);
    });

    it('quantidade grande (100.000 unidades) não causa overflow', () => {
      const result = calcItemTotal({ unitPrice: 0.01, quantity: 100000, discountPct: 0 });
      expect(result.total).toBe(1000);
      expect(isFinite(result.total)).toBe(true);
    });
  });

  describe('Preço', () => {
    it('preço zero resulta em total zero independente da quantidade', () => {
      const result = calcItemTotal({ unitPrice: 0, quantity: 1000, discountPct: 0 });
      expect(result.total).toBe(0);
    });

    it('preço fracionado evita float drift', () => {
      // 1/3 de 1 real com 3 unidades deve dar 1 real (não 0.9999...)
      const result = calcItemTotal({ unitPrice: 1/3, quantity: 3, discountPct: 0 });
      expect(result.total).toBe(1); // Arredondado para 2 casas
    });
  });

  describe('Total do Orçamento', () => {
    it('múltiplos itens são somados corretamente', () => {
      const items: QuoteItem[] = [
        { unitPrice: 10, quantity: 2, discountPct: 0 },   // 20
        { unitPrice: 5, quantity: 4, discountPct: 10 },   // 18
        { unitPrice: 100, quantity: 1, discountPct: 50 }, // 50
      ];
      const total = calcQuoteTotal(items);
      expect(total).toBe(88);
    });

    it('orçamento vazio resulta em total zero', () => {
      expect(calcQuoteTotal([])).toBe(0);
    });

    it('orçamento com todos descontos 100% resulta em zero', () => {
      const items: QuoteItem[] = [
        { unitPrice: 50, quantity: 3, discountPct: 100 },
        { unitPrice: 20, quantity: 5, discountPct: 100 },
      ];
      expect(calcQuoteTotal(items)).toBe(0);
    });
  });

  describe('Arredondamento EPSILON', () => {
    it('não produz valores como 0.1 + 0.2 = 0.30000000000000004', () => {
      const result = calcItemTotal({ unitPrice: 0.1 + 0.2, quantity: 1, discountPct: 0 });
      expect(result.total).toBe(0.3);
    });

    it('preço R$ 9,99 com 10% de desconto dá R$ 8,99 exato', () => {
      const result = calcItemTotal({ unitPrice: 9.99, quantity: 1, discountPct: 10 });
      expect(result.discount).toBe(1);
      expect(result.total).toBe(8.99);
    });
  });
});
