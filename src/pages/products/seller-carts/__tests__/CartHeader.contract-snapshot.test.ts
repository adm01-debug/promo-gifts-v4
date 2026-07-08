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
  const qty = items.reduce((s, it) => s + (it.quantity || 0), 0);
  const subtotal = items.reduce(
    (s, it) => s + (it.product_price || 0) * (it.quantity || 0),
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
    const snapshot = CATALOG.map((c) => `${c.name} → ${computeHeaderMeta(c.items)}`).join(
      '\n',
    );
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
    const CONTRACT =
      /^\d+ SKUs? · \d+ unidades?(?: · R\$ \d{1,3}(?:\.\d{3})*,\d{2})?$/;
    for (const c of CATALOG) {
      expect(computeHeaderMeta(c.items)).toMatch(CONTRACT);
    }
  });

  it('locka arredondamento BRL em bordas críticas (0,005 / 0,0099 / 1,005 / etc.)', () => {
    // Cada valor abaixo é um subtotal potencial. Se o ICU/Intl mudar de
    // política de arredondamento (half-up ↔ half-even), este snapshot quebra.
    const boundaries = [
      0.001,
      0.005,
      0.0099,
      0.01,
      0.014,
      0.015,
      0.025,
      0.995,
      1.005,
      1.015,
      1.245,
      1.255,
      2.005,
      999.995,
      1000.005,
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
});
