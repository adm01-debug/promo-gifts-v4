/**
 * tests/hooks/quotes/quoteHelpers.freight.test.ts
 *
 * Testes unitários focados nos cálculos de frete dentro de calculateQuoteTotals.
 * Cobre: modes FOB-repassado, FOB-pré-negociado, CIF, arredondamento, edge cases.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuoteTotals,
  round2,
  validateDiscount,
  buildInsertPayload,
  buildUpdatePayload,
  buildItemsInsertPayload,
  buildPersonalizationsInsertPayload,
} from '@/hooks/quotes/quoteHelpers';
import type { QuoteItem } from '@/hooks/quotes/quoteTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(quantity: number, unit_price: number): QuoteItem {
  return {
    id: `item-${Math.random()}`,
    quote_id: 'q-1',
    product_id: 'p-1',
    product_name: 'Produto Teste',
    quantity,
    unit_price,
    total_price: quantity * unit_price,
    personalizations: [],
  } as unknown as QuoteItem;
}

function items(quantity: number, unitPrice: number): QuoteItem[] {
  return [makeItem(quantity, unitPrice)];
}

// ─── round2 ──────────────────────────────────────────────────────────────────

describe("round2 — arredondamento monetário", () => {
  it("1.005 → 1.01 (half-up)", () => {
    expect(round2(1.005)).toBe(1.01);
  });

  it("1.004 → 1.00 (trunca)", () => {
    expect(round2(1.004)).toBe(1.00);
  });

  it("0 → 0", () => {
    expect(round2(0)).toBe(0);
  });

  it("null → 0", () => {
    expect(round2(null)).toBe(0);
  });

  it("undefined → 0", () => {
    expect(round2(undefined)).toBe(0);
  });

  it("NaN → 0", () => {
    expect(round2(NaN)).toBe(0);
  });

  it("Infinity → 0", () => {
    expect(round2(Infinity)).toBe(0);
  });

  it("-Infinity → 0", () => {
    expect(round2(-Infinity)).toBe(0);
  });

  it("valor negativo arredonda corretamente", () => {
    expect(round2(-1.005)).toBe(-1.00);
  });
});

// ─── calculateQuoteTotals — sem frete ────────────────────────────────────────

describe("calculateQuoteTotals — base sem frete", () => {
  it("subtotal = quantidade × preço unitário", () => {
    const r = calculateQuoteTotals({}, items(10, 5));
    expect(r.subtotal).toBe(50);
  });

  it("total = subtotal sem desconto e sem frete", () => {
    const r = calculateQuoteTotals({}, items(10, 5));
    expect(r.total).toBe(50);
  });

  it("desconto percentual deduz do subtotal", () => {
    const r = calculateQuoteTotals({ discount_percent: 10 }, items(10, 10));
    expect(r.subtotal).toBe(100);
    expect(r.discountAmount).toBe(10);
    expect(r.total).toBe(90);
  });
});

// ─── FOB-repassado (shipping_type = 'fob_rep') ───────────────────────────────

describe("calculateQuoteTotals — FOB repassado ao cliente", () => {
  it("frete NÃO é somado ao total (tipo fob_rep)", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_rep", shipping_cost: 150 },
      items(10, 10),
    );
    expect(r.total).toBe(100);
  });

  it("total é apenas subtotal quando fob_rep", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_rep", shipping_cost: 999 },
      items(5, 20),
    );
    expect(r.total).toBe(100);
  });

  it("shipping_cost null com fob_rep → total = subtotal", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_rep", shipping_cost: null as unknown as number },
      items(2, 50),
    );
    expect(r.total).toBe(100);
  });
});

// ─── FOB-pré-negociado (shipping_type = 'fob_pre') ──────────────────────────

describe("calculateQuoteTotals — FOB pré-negociado", () => {
  it("frete é somado ao total", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_pre", shipping_cost: 150 },
      items(10, 10),
    );
    expect(r.total).toBe(250);
  });

  it("frete R$ 0 não altera total", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_pre", shipping_cost: 0 },
      items(10, 10),
    );
    expect(r.total).toBe(100);
  });

  it("frete decimal arredondado: R$ 33.333 → 33.33 no total", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_pre", shipping_cost: 33.333 },
      items(1, 100),
    );
    expect(r.total).toBe(133.33);
  });

  it("total = subtotal + frete − desconto", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_pre", shipping_cost: 50, discount_percent: 10 },
      items(10, 10),
    );
    // subtotal=100, discount=10, shipping=50, total=140
    expect(r.total).toBe(140);
  });

  it("frete não afeta discountAmount", () => {
    const r = calculateQuoteTotals(
      { shipping_type: "fob_pre", shipping_cost: 200, discount_percent: 20 },
      items(10, 10),
    );
    expect(r.discountAmount).toBe(20);
  });
});

// ─── shipping_type ausente (CIF — frete incluso) ─────────────────────────────

describe("calculateQuoteTotals — CIF (sem shipping_type)", () => {
  it("shipping_cost é ignorado quando shipping_type não é fob_pre", () => {
    const r = calculateQuoteTotals(
      { shipping_cost: 500 },
      items(10, 10),
    );
    expect(r.total).toBe(100);
  });
});

// ─── Markup de negociação ─────────────────────────────────────────────────────

describe("calculateQuoteTotals — markup + frete", () => {
  it("markup 10% + frete fob_pre R$ 50 = (110 + 50) = 160", () => {
    const r = calculateQuoteTotals(
      { negotiation_markup_percent: 10, shipping_type: "fob_pre", shipping_cost: 50 },
      items(10, 10),
    );
    expect(r.subtotal).toBe(110);
    expect(r.total).toBe(160);
  });

  it("markup > 50% lança erro", () => {
    expect(() =>
      calculateQuoteTotals(
        { negotiation_markup_percent: 51, shipping_type: "fob_pre", shipping_cost: 50 },
        items(10, 10),
      )
    ).toThrow(/50%/);
  });

  it("markup = 50% aceita", () => {
    expect(() =>
      calculateQuoteTotals(
        { negotiation_markup_percent: 50 },
        items(10, 10),
      )
    ).not.toThrow();
  });
});

// ─── Personalização nos itens ────────────────────────────────────────────────

describe("calculateQuoteTotals — personalização + frete", () => {
  it("personalização adiciona ao subtotal antes do frete", () => {
    const itemsWithPers: QuoteItem[] = [
      {
        ...makeItem(10, 10),
        personalizations: [{ total_cost: 50 } as never],
      },
    ];
    const r = calculateQuoteTotals(
      { shipping_type: "fob_pre", shipping_cost: 30 },
      itemsWithPers,
    );
    // subtotal = 100 + 50 = 150; total = 150 + 30 = 180
    expect(r.subtotal).toBe(150);
    expect(r.total).toBe(180);
  });
});

// ─── Validação de desconto ────────────────────────────────────────────────────

describe("validateDiscount — integrado via calculateQuoteTotals", () => {
  it("desconto 100% → total = 0 (com frete FOB repassado)", () => {
    const r = calculateQuoteTotals(
      { discount_percent: 100, shipping_type: "fob_rep", shipping_cost: 999 },
      items(10, 10),
    );
    expect(r.total).toBe(0);
  });

  it("desconto > 100% computa total negativo (validateDiscount só é chamado em buildInsertPayload)", () => {
    const r = calculateQuoteTotals({ discount_percent: 101 }, items(10, 10));
    // subtotal = 100, desconto = 101 → total = -1
    expect(r.total).toBeLessThan(0);
    expect(r.discountAmount).toBeGreaterThan(r.subtotal);
  });

  it("desconto negativo aumenta o total (validateDiscount só é chamado em buildInsertPayload)", () => {
    const r = calculateQuoteTotals({ discount_percent: -1 }, items(10, 10));
    // subtotal = 100, desconto = -1 → total = 101
    expect(r.total).toBeGreaterThan(r.subtotal);
  });
});

// ---------------------------------------------------------------------------
// validateDiscount — chamado diretamente
// ---------------------------------------------------------------------------

describe("validateDiscount — direto", () => {
  it("desconto válido 10% → não lança", () => {
    expect(() => validateDiscount({ discount_percent: 10 }, { subtotal: 100, discountAmount: 10 })).not.toThrow();
  });

  it("discount_percent 0 → não lança (falsy, branch ignorado)", () => {
    expect(() => validateDiscount({ discount_percent: 0 }, { subtotal: 100, discountAmount: 0 })).not.toThrow();
  });

  it("discount_percent > 100 → lança", () => {
    expect(() => validateDiscount({ discount_percent: 101 }, { subtotal: 100, discountAmount: 101 })).toThrow(/desconto/i);
  });

  it("discount_percent < 0 → lança", () => {
    expect(() => validateDiscount({ discount_percent: -5 }, { subtotal: 100, discountAmount: -5 })).toThrow(/desconto/i);
  });

  it("discountAmount negativo → lança", () => {
    expect(() => validateDiscount({}, { subtotal: 100, discountAmount: -1 })).toThrow(/negativo/i);
  });

  it("discountAmount > subtotal → lança", () => {
    expect(() => validateDiscount({}, { subtotal: 100, discountAmount: 200 })).toThrow(/exceder/i);
  });

  it("discountAmount = subtotal (dentro da tolerância 0.01) → não lança", () => {
    expect(() => validateDiscount({}, { subtotal: 100, discountAmount: 100 })).not.toThrow();
  });

  it("total_cost de personalização negativo → deve somar valor negativo (reduzir subtotal)", () => {
    const itemsWithPers: QuoteItem[] = [
      {
        ...makeItem(1, 100),
        personalizations: [{ total_cost: -20 } as never],
      },
    ];
    const r = calculateQuoteTotals({}, itemsWithPers);
    expect(r.subtotal).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// buildInsertPayload
// ---------------------------------------------------------------------------

const BASE_TOTALS = { subtotal: 100, discountAmount: 10, total: 90 };

describe("buildInsertPayload", () => {
  it("retorna payload com campos obrigatórios preenchidos", () => {
    const p = buildInsertPayload(
      { client_name: 'ACME', status: 'draft', shipping_type: 'fob_pre', shipping_cost: 15 },
      'user-123',
      'org-456',
      BASE_TOTALS,
    );
    expect(p.seller_id).toBe('user-123');
    expect(p.organization_id).toBe('org-456');
    expect(p.client_name).toBe('ACME');
    expect(p.subtotal).toBe(100);
    expect(p.discount_amount).toBe(10);
    expect(p.total).toBe(90);
    expect(p.shipping_cost).toBe(15);
    expect(p.status).toBe('draft');
  });

  it("orgId null → organization_id null", () => {
    const p = buildInsertPayload({}, 'uid', null, BASE_TOTALS);
    expect(p.organization_id).toBeNull();
  });

  it("status padrão 'draft' quando não informado", () => {
    const p = buildInsertPayload({}, 'uid', null, BASE_TOTALS);
    expect(p.status).toBe('draft');
  });

  it("arredonda valores monetários com round2", () => {
    const p = buildInsertPayload({}, 'uid', null, { subtotal: 10.005, discountAmount: 0, total: 10.005 });
    expect(p.subtotal).toBe(10.01);
    expect(p.total).toBe(10.01);
  });

  it("discountAmount > subtotal → lança via validateDiscount", () => {
    expect(() =>
      buildInsertPayload({}, 'uid', null, { subtotal: 50, discountAmount: 60, total: -10 })
    ).toThrow(/exceder/i);
  });

  // Regressão: o contato CRM selecionado não pode sumir ao salvar o orçamento.
  // create_quote_transactional lê contact_id do _quote jsonb.
  it("preserva contact_id do CRM no payload", () => {
    const p = buildInsertPayload({ contact_id: 'c-789' }, 'uid', null, BASE_TOTALS);
    expect(p.contact_id).toBe('c-789');
  });

  it("contact_id ausente → null (não undefined)", () => {
    const p = buildInsertPayload({}, 'uid', null, BASE_TOTALS);
    expect(p.contact_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildUpdatePayload
// ---------------------------------------------------------------------------

describe("buildUpdatePayload", () => {
  it("retorna payload com subtotal/total corretos", () => {
    const p = buildUpdatePayload({ client_name: 'Beta', status: 'sent' }, BASE_TOTALS);
    expect(p.client_name).toBe('Beta');
    expect(p.status).toBe('sent');
    expect(p.subtotal).toBe(100);
    expect(p.total).toBe(90);
    expect(p.discount_amount).toBe(10);
  });

  it("updated_at é string ISO válida", () => {
    const p = buildUpdatePayload({}, BASE_TOTALS);
    expect(typeof p.updated_at).toBe('string');
    expect(() => new Date(p.updated_at!).toISOString()).not.toThrow();
  });

  it("desconto inválido → lança", () => {
    expect(() =>
      buildUpdatePayload({}, { subtotal: 50, discountAmount: 100, total: -50 })
    ).toThrow(/exceder/i);
  });

  // Regressão: update_quote_transactional só persiste contact_id quando a chave
  // existe no _quote_patch (CASE WHEN _quote_patch ? 'contact_id'). A chave deve
  // estar sempre presente para refletir o estado atual (definir OU limpar o contato).
  it("preserva contact_id do CRM no patch", () => {
    const p = buildUpdatePayload({ contact_id: 'c-789' }, BASE_TOTALS);
    expect(p.contact_id).toBe('c-789');
  });

  it("contact_id ausente → chave presente como null (permite limpar o contato)", () => {
    const p = buildUpdatePayload({}, BASE_TOTALS);
    expect('contact_id' in p).toBe(true);
    expect(p.contact_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildItemsInsertPayload
// ---------------------------------------------------------------------------

describe("buildItemsInsertPayload", () => {
  it("mapeia items corretamente com sort_order", () => {
    const result = buildItemsInsertPayload(
      [makeItem(2, 50), makeItem(3, 20)],
      'quote-abc',
    );
    expect(result).toHaveLength(2);
    expect(result[0].quote_id).toBe('quote-abc');
    expect(result[0].quantity).toBe(2);
    expect(result[0].unit_price).toBe(50);
    expect(result[0].subtotal).toBe(100);
    expect(result[0].sort_order).toBe(0);
    expect(result[1].sort_order).toBe(1);
  });

  it("lista vazia → array vazio", () => {
    expect(buildItemsInsertPayload([], 'q')).toEqual([]);
  });

  it("arredonda unit_price e subtotal", () => {
    const result = buildItemsInsertPayload([makeItem(3, 10.005)], 'q');
    expect(result[0].unit_price).toBe(10.01);
    expect(result[0].subtotal).toBe(30.02);
  });
});

// ---------------------------------------------------------------------------
// buildPersonalizationsInsertPayload
// ---------------------------------------------------------------------------

describe("buildPersonalizationsInsertPayload", () => {
  const pers = [
    {
      technique_id: 'tech-1',
      technique_name: 'Serigrafia',
      location_code: 'FRONT',
      location_name: 'Frente',
      personalized_quantity: 100,
      colors_count: 2,
      positions_count: 1,
      area_cm2: 50,
      width_cm: 10,
      height_cm: 5,
      setup_cost: 30,
      unit_cost: 1.5,
      total_cost: 180,
      notes: 'obs',
    },
  ] as Parameters<typeof buildPersonalizationsInsertPayload>[0];

  it("mapeia personalização com todos os campos", () => {
    const result = buildPersonalizationsInsertPayload(pers, 'item-xyz');
    expect(result).toHaveLength(1);
    expect(result[0].quote_item_id).toBe('item-xyz');
    expect(result[0].technique_name).toBe('Serigrafia');
    expect(result[0].total_cost).toBe(180);
    expect(result[0].setup_cost).toBe(30);
    expect(result[0].unit_cost).toBe(1.5);
  });

  it("lista vazia → array vazio", () => {
    expect(buildPersonalizationsInsertPayload([], 'item-xyz')).toEqual([]);
  });
});
