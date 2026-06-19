import { describe, it, expect } from 'vitest';
import * as QuoteCalc from '../logic/quotes/calculations';
import { calculateQuoteTotals } from '../hooks/quotes/quoteHelpers';
import type { QuoteItem } from '@/hooks/quotes/quoteTypes';

describe('Módulo de Orçamentos: Teste de Integração de Cálculo (Fim-a-Fim)', () => {
  it('deve realizar o fluxo completo de cálculo: Itens -> Markup -> Desconto -> Total Final', () => {
    // 1. Definição de itens (simulando estado do useQuoteItems)
    const items: QuoteItem[] = [
      {
        product_id: 'p1',
        product_name: 'Item 1',
        quantity: 100,
        unit_price: 10.0, // Subtotal item: 1000.00
        personalizations: [
          { technique_id: 't1', total_cost: 50.0 }, // Total gravações: 50.00
          { technique_id: 't2', total_cost: 25.5 }, // Total gravações: 25.50
        ],
      },
      {
        product_id: 'p2',
        product_name: 'Item 2',
        quantity: 50,
        unit_price: 20.0, // Subtotal item: 1000.00
        personalizations: [],
      },
    ];

    // 2. Cálculos Individuais de Item (Puro Logic)
    // Precisamos garantir que os campos batam com QuoteItemCalculationParams (quantity, unitPrice)
    const calcParams1 = {
      quantity: items[0].quantity,
      unitPrice: items[0].unit_price,
      personalizations: items[0].personalizations,
    };

    const item1Total = QuoteCalc.calculateItemTotal(calcParams1);
    expect(item1Total).toBe(1075.5); // (100 * 10) + 50 + 25.50

    // 3. Integração com QuoteHelpers (Cálculo que vai para o Banco)
    const quoteData = {
      negotiation_markup_percent: 10,
      discount_percent: 5,
      shipping_type: 'fob_pre',
      shipping_cost: 150.0,
    };

    const totals = calculateQuoteTotals(quoteData, items);

    // realSubtotal: 1075.50 + 1000 = 2075.50
    expect(totals.realSubtotal).toBe(2075.5);

    // markup: 10% -> subtotal: 2075.50 * 1.1 = 2283.05
    expect(totals.subtotal).toBe(2283.05);

    // discountAmount (aparente): 5% de 2283.05 = 114.1525 -> 114.15
    expect(totals.discountAmount).toBe(114.15);

    // total: 2283.05 - 114.15 + 150 = 2318.90
    expect(totals.total).toBe(2318.9);

    // realDiscountPercent: ((2075.50 - 2168.90) / 2075.50) * 100 = -4.50
    expect(totals.realDiscountPercent).toBe(-4.5);
  });

  it('deve lidar corretamente com arredondamentos de precisão crítica (Floating point)', () => {
    const value = 0.1 + 0.2;
    expect(QuoteCalc.round2(value)).toBe(0.3);
    expect(QuoteCalc.round2(1.005)).toBe(1.01);
  });
});
