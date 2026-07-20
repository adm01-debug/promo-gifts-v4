/**
 * Snapshot de contrato do meta do header.
 *
 * Locka o formato exato produzido por `computeHeaderMeta` (mesma lógica
 * da JSX em SellerCartsPage.tsx) para um catálogo fechado de estados.
 * Se a formatação BRL mudar (símbolo, separador, casas decimais) ou a
 * pluralização mudar, o snapshot quebra e força revisão consciente.
 *
 * Não é um snapshot de DOM — é um snapshot de CONTRATO textual, imune a
 * mudanças cosméticas (className, ordem de attrs, etc.).
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/components/cart/CartUtilComponents';

type Item = { quantity: number; product_price: number };

const NBSP = /[\u00A0\u202F]/g;
const norm = (s: string) => s.replace(NBSP, ' ');

function computeHeaderMeta(items: Item[]): string {
  const skus = items.length;
  const qty = items.reduce((s, item) => s + (item.quantity || 0), 0);
  const subtotal = items.reduce(
    (s, item) => s + (item.product_price || 0) * (item.quantity || 0),
    0,
  );
  const parts = [
    `${skus} ${skus === 1 ? 'SKU' : 'SKUs'}`,
    `${qty} ${qty === 1 ? 'unidade' : 'unidades'}`,
  ];
  if (subtotal > 0) parts.push(formatCurrency(subtotal));
  return norm(parts.join(' · '));
}

// Catálogo fechado — cada entrada corresponde a um estado real do carrinho.
// Não editar sem revisão explícita (é o SSOT do contrato do meta).
const CATALOG: Array<{ name: string; items: Item[] }> = [
  { name: 'vazio', items: [] },
  { name: '1 SKU · 1 unidade · R$ pequeno', items: [{ quantity: 1, product_price: 9.9 }] },
  { name: '1 SKU · N unidades', items: [{ quantity: 5, product_price: 10 }] },
  {
    name: '2 SKUs · 1 unidade total (SKU cadastrado com qty=0)',
    items: [
      { quantity: 1, product_price: 10 },
      { quantity: 0, product_price: 20 },
    ],
  },
  {
    name: '3 SKUs · valores mistos',
    items: [
      { quantity: 2, product_price: 15.5 },
      { quantity: 10, product_price: 3.33 },
      { quantity: 1, product_price: 999.99 },
    ],
  },
  { name: 'grande escala (milhares)', items: [{ quantity: 1000, product_price: 12.34 }] },
  {
    name: 'subtotal na casa dos milhões',
    items: [{ quantity: 10_000, product_price: 999.99 }],
  },
  { name: 'preço zero (subtotal oculto)', items: [{ quantity: 3, product_price: 0 }] },
];

describe('CartHeader · snapshot de contrato do meta', () => {
  it('produz strings estáveis para o catálogo fechado (locka BRL + pluralização)', () => {
    const snapshot = CATALOG.map((c) => `${c.name} → ${computeHeaderMeta(c.items)}`).join('\n');
    expect(snapshot).toMatchInlineSnapshot(`
      "vazio → 0 SKUs · 0 unidades
      1 SKU · 1 unidade · R$ pequeno → 1 SKU · 1 unidade · R$ 9,90
      1 SKU · N unidades → 1 SKU · 5 unidades · R$ 50,00
      2 SKUs · 1 unidade total (SKU cadastrado com qty=0) → 2 SKUs · 1 unidade · R$ 10,00
      3 SKUs · valores mistos → 3 SKUs · 13 unidades · R$ 1.064,29
      grande escala (milhares) → 1 SKU · 1000 unidades · R$ 12.340,00
      subtotal na casa dos milhões → 1 SKU · 10000 unidades · R$ 9.999.900,00
      preço zero (subtotal oculto) → 1 SKU · 3 unidades"
    `);
  });

  it('cada snapshot line respeita o contrato regex "N SKU(s) · N unidade(s) [· R$ X,XX]"', () => {
    const CONTRACT = /^\d+ SKUs? · \d+ unidades?(?: · R\$ \d{1,3}(?:\.\d{3})*,\d{2})?$/;
    for (const c of CATALOG) {
      expect(computeHeaderMeta(c.items)).toMatch(CONTRACT);
    }
  });

  it('locka arredondamento BRL em bordas críticas (0,005 / 0,0099 / 1,005 / etc.)', () => {
    // Cada valor abaixo é um subtotal potencial. Se o ICU/Intl mudar de
    // política de arredondamento (half-up ↔ half-even), este snapshot quebra.
    const boundaries = [
      0.001, 0.005, 0.0099, 0.01, 0.014, 0.015, 0.025, 0.995, 1.005, 1.015, 1.245, 1.255, 2.005,
      999.995, 1000.005,
    ];
    const rows = boundaries.map((v) => `${v} → ${norm(formatCurrency(v))}`).join('\n');
    expect(rows).toMatchInlineSnapshot(`
      "0.001 → R$ 0,00
      0.005 → R$ 0,01
      0.0099 → R$ 0,01
      0.01 → R$ 0,01
      0.014 → R$ 0,01
      0.015 → R$ 0,02
      0.025 → R$ 0,03
      0.995 → R$ 1,00
      1.005 → R$ 1,01
      1.015 → R$ 1,02
      1.245 → R$ 1,25
      1.255 → R$ 1,26
      2.005 → R$ 2,01
      999.995 → R$ 1.000,00
      1000.005 → R$ 1.000,01"
    `);
  });

  it('separador de milhar SEMPRE "." e decimal SEMPRE "," (nunca inverte)', () => {
    // Casos > 1000 obrigam separador de milhar.
    for (const v of [1000, 1234.56, 10_000, 999_999.99, 1_000_000]) {
      const out = norm(formatCurrency(v));
      // Regex: "R$ <milhares com ponto>,\d{2}" — vírgula é o decimal.
      expect(out).toMatch(/^R\$ \d{1,3}(?:\.\d{3})+,\d{2}$/);
    }
  });

  it('formatCurrency sempre produz exatamente 2 casas decimais (100 valores)', () => {
    for (let i = 0; i < 100; i++) {
      // Injeta valores com 3+ casas para forçar arredondamento.
      const v = Math.random() * 10_000;
      const out = norm(formatCurrency(v));
      // Nunca 0 ou 3+ casas depois da vírgula.
      expect(out).toMatch(/,\d{2}$/);
      expect(out).not.toMatch(/,\d{3,}$/);
      expect(out).not.toMatch(/,\d{1}$/);
    }
  });

  // ── Bordas envolvendo QUANTIDADES e SUBTOTAIS de itens fracionados ─────
  //
  // O contrato do meta é `SKUs · unidades [· subtotal]`. Se um item tiver
  // preço unitário fracionado (ex.: 0,01, 0,99, 3,33) e/ou quantidade
  // grande, o subtotal pode cair em qualquer borda de arredondamento.
  // Este catálogo prova que `formatCurrency(qty * price)` é estável.

  it('locka subtotais com preços unitários fracionados × quantidades variadas', () => {
    const rows = [
      // 1 item × preços fracionados
      { qty: 1, price: 0.01 },
      { qty: 1, price: 0.99 },
      { qty: 1, price: 3.33 },
      { qty: 1, price: 33.33 },
      // preços fracionados × qty causando .005 no subtotal
      { qty: 3, price: 0.335 }, // 1.005
      { qty: 5, price: 0.201 }, // 1.005
      { qty: 7, price: 0.999 }, // 6.993
      // qty grande × centavos
      { qty: 100, price: 0.01 }, // 1,00
      { qty: 100, price: 0.015 }, // 1,50
      { qty: 999, price: 0.99 }, // 989,01
      { qty: 1000, price: 0.001 }, // 1,00
      // qty grande × preço fracionado — subtotal em milhares
      { qty: 1234, price: 5.678 }, // 7007,652
      { qty: 3600, price: 12.345 }, // 44442,00
      { qty: 10_000, price: 0.005 }, // 50,00
      // qty extrema (limite razoável de UI)
      { qty: 100_000, price: 0.01 }, // 1000,00
      { qty: 99_999, price: 99.99 }, // 9998900,01
    ]
      .map(({ qty, price }) => {
        const subtotal = qty * price;
        return `${qty}×${price} = ${subtotal} → ${norm(formatCurrency(subtotal))}`;
      })
      .join('\n');

    expect(rows).toMatchInlineSnapshot(`
      "1×0.01 = 0.01 → R$ 0,01
      1×0.99 = 0.99 → R$ 0,99
      1×3.33 = 3.33 → R$ 3,33
      1×33.33 = 33.33 → R$ 33,33
      3×0.335 = 1.0050000000000001 → R$ 1,01
      5×0.201 = 1.0050000000000001 → R$ 1,01
      7×0.999 = 6.993 → R$ 6,99
      100×0.01 = 1 → R$ 1,00
      100×0.015 = 1.5 → R$ 1,50
      999×0.99 = 989.01 → R$ 989,01
      1000×0.001 = 1 → R$ 1,00
      1234×5.678 = 7006.652 → R$ 7.006,65
      3600×12.345 = 44442 → R$ 44.442,00
      10000×0.005 = 50 → R$ 50,00
      100000×0.01 = 1000 → R$ 1.000,00
      99999×99.99 = 9998900.01 → R$ 9.998.900,01"
    `);
  });

  it('meta completa com subtotais fracionados respeita o contrato regex', () => {
    // Cenários realistas — pluralização + subtotal fracionado interagem.
    const scenarios: Array<{ items: Item[]; expect: string }> = [
      {
        items: [{ quantity: 3, product_price: 0.335 }],
        expect: '1 SKU · 3 unidades · R$ 1,01',
      },
      {
        items: [
          { quantity: 100, product_price: 0.015 },
          { quantity: 7, product_price: 0.999 },
        ],
        // 100×0.015 + 7×0.999 = 1.5 + 6.993 = 8.493 → R$ 8,49
        expect: '2 SKUs · 107 unidades · R$ 8,49',
      },
      {
        items: [
          { quantity: 1, product_price: 0.01 },
          { quantity: 1, product_price: 0.01 },
          { quantity: 1, product_price: 0.01 },
        ],
        expect: '3 SKUs · 3 unidades · R$ 0,03',
      },
      {
        items: [{ quantity: 999, product_price: 0.99 }],
        expect: '1 SKU · 999 unidades · R$ 989,01',
      },
    ];
    for (const s of scenarios) {
      expect(computeHeaderMeta(s.items)).toBe(s.expect);
    }
  });

  it('subtotais nas bordas de milhar preservam o separador "."', () => {
    // Qty × price arquitetado para cair exatamente em bordas de milhar.
    const cases = [
      { qty: 1000, price: 1 }, // 1000
      { qty: 500, price: 1.998 }, // 999,00
      { qty: 501, price: 1.998 }, // 1000,998 → 1001,00
      { qty: 100, price: 99.995 }, // 9999,5 → 9999,50
      { qty: 10, price: 100_000 }, // 1_000_000
    ];
    for (const { qty, price } of cases) {
      const out = norm(formatCurrency(qty * price));
      // Todo valor ≥ 1000 deve ter ao menos um "." separando milhares.
      if (qty * price >= 1000) {
        expect(out).toMatch(/^R\$ \d{1,3}(?:\.\d{3})+,\d{2}$/);
      } else {
        expect(out).toMatch(/^R\$ \d{1,3},\d{2}$/);
      }
    }
  });
});
