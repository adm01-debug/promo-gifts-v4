/**
 * Fuzz / property-based — 500 cenários aleatórios de filtros do Estoque.
 *
 * Objetivo: caçar gaps que testes determinísticos não pegam.
 * Invariantes verificadas em TODA execução (qualquer falha quebra o build):
 *
 *   I1. Projeção é subconjunto: produto retornado tem `totalVariants`
 *       ≤ produto original e variants ⊆ variants originais.
 *   I2. Idempotência: aplicar o mesmo filtro 2× retorna o mesmo resultado.
 *   I3. Monotonicidade: adicionar um filtro NUNCA aumenta a quantidade
 *       de produtos retornados (vs. baseline `all`).
 *   I4. Conservação de SKU: nenhum SKU duplicado entre linhas projetadas.
 *   I5. Coerência de status: quando há `colorName`/`colorGroup`, toda
 *       variação visível casa com a cor pedida (normalize-insensitive).
 *   I6. Status de variação canônico: toda variação na saída tem status entre
 *       os 6 valores válidos de StockStatus (in_stock, low_stock, critical,
 *       out_of_stock, incoming, overstocked).
 *   I7. categoryId/supplierId estreitam: todo produto retornado tem o
 *       categoryName/supplierName batendo (normalize-insensitive).
 *   I8. status='critical' retorna SÓ produtos com pelo menos 1 variação
 *       crítica OU overallStatus='critical'.
 *   I9. status='incoming' retorna SÓ produtos com pelo menos 1 variação
 *       'incoming' (ou inTransitStock>0) OU overallStatus='incoming'.
 */
import { describe, it, expect } from 'vitest';
import { applyStockFilters, buildStockIndexes, normalize } from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockFilters,
  type VariantStock,
} from '@/types/stock';

// ---------- gerador determinístico (seed fixo p/ reprodutibilidade) ----------
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const STATUSES: VariantStock['status'][] = [
  'in_stock',
  'low_stock',
  'critical',
  'out_of_stock',
  'incoming',
  'overstocked',
];
const CATEGORIES = ['Canecas', 'Garrafas', 'Mochilas', 'Camisetas', 'Canetas'];
const SUPPLIERS = ['Acme', 'Globex', 'Initech', 'Umbrella'];
const COLORS = ['Azul', 'Verde', 'Vermelho', 'Preto', 'Amarelo'];

function mkWorld(rng: () => number, productCount: number): ProductStockSummary[] {
  const out: ProductStockSummary[] = [];
  for (let i = 0; i < productCount; i++) {
    const variants: VariantStock[] = [];
    const nVariants = 1 + Math.floor(rng() * 5);
    for (let j = 0; j < nVariants; j++) {
      const status = STATUSES[Math.floor(rng() * STATUSES.length)];
      // Match calculateStockStatus semantics:
      //   'incoming'    → currentStock=0, inTransitStock>0
      //   'overstocked' → very high stock (>max*1.5)
      //   'out_of_stock'→ stock=0
      const stock =
        status === 'out_of_stock' || status === 'incoming'
          ? 0
          : status === 'overstocked'
            ? 1000 + Math.floor(rng() * 500)
            : Math.floor(rng() * 500);
      const inTransitStock = status === 'incoming' ? 10 + Math.floor(rng() * 50) : 0;
      variants.push({
        id: `p${i}-v${j}`,
        productId: `p${i}`,
        variantId: `p${i}-v${j}`,
        variantSku: `SKU-${i}-${j}`,
        colorName: COLORS[Math.floor(rng() * COLORS.length)],
        colorHex: '#000',
        currentStock: stock,
        minStock: 10,
        reservedStock: 0,
        inTransitStock,
        availableStock: stock,
        status,
        updatedAt: '2026-01-01',
      });
    }
    // Mirror aggregateVariantsToProduct logic exactly (post BUG-A fix).
    const totalCurrentStock = variants.reduce((s, x) => s + x.currentStock, 0);
    const variantsIncoming = variants.filter(
      (x) => x.status === 'incoming' || x.inTransitStock > 0,
    ).length;
    const variantsOutOfStockCount = variants.filter((x) => x.status === 'out_of_stock').length;
    const variantsCriticalCount = variants.filter((x) => x.status === 'critical').length;
    const variantsLowStockCount = variants.filter((x) => x.status === 'low_stock').length;

    const overall: ProductStockSummary['overallStatus'] =
      variants.length === 0
        ? 'in_stock'
        : variantsIncoming > 0 && (variantsOutOfStockCount > 0 || totalCurrentStock === 0)
          ? 'incoming'
          : variantsOutOfStockCount === variants.length
            ? 'out_of_stock'
            : variantsCriticalCount > 0 || variantsOutOfStockCount > 0
              ? 'critical'
              : variantsLowStockCount > 0
                ? 'low_stock'
                : 'in_stock';

    out.push({
      productId: `p${i}`,
      productName: `Produto ${i}`,
      productSku: `P${i}`,
      categoryName: CATEGORIES[Math.floor(rng() * CATEGORIES.length)],
      supplierName: SUPPLIERS[Math.floor(rng() * SUPPLIERS.length)],
      overallStatus: overall,
      // 'in_stock'|'incoming'|'overstocked' → variantsInStock (mirrors BUG-A fix)
      variantsInStock: variants.filter(
        (x) => x.status === 'in_stock' || x.status === 'incoming' || x.status === 'overstocked',
      ).length,
      variantsLowStock: variantsLowStockCount,
      variantsCritical: variantsCriticalCount,
      variantsOutOfStock: variantsOutOfStockCount,
      availableColors: [],
      totalVariants: variants.length,
      totalCurrentStock,
      totalMinStock: variants.length * 10,
      totalReservedStock: 0,
      totalInTransitStock: variants.reduce((s, x) => s + x.inTransitStock, 0),
      totalAvailableStock: variants.reduce((s, x) => s + x.availableStock, 0),
      variants,
    });
  }
  return out;
}

function mkFilters(rng: () => number): StockFilters {
  const pick = <T,>(arr: T[], pNone = 0.3): T | undefined =>
    rng() < pNone ? undefined : arr[Math.floor(rng() * arr.length)];
  const statusOptions: StockFilters['status'][] = [
    'all',
    'in_stock',
    'low_stock',
    'critical',
    'out_of_stock',
    'incoming',
    'overstocked',
  ];
  return {
    ...defaultStockFilters,
    status: statusOptions[Math.floor(rng() * statusOptions.length)],
    categoryId: pick(CATEGORIES),
    supplierId: pick(SUPPLIERS),
    colorName: pick(COLORS, 0.5),
  };
}

describe('Fuzz — 500 combinações aleatórias respeitam invariantes do filtro', () => {
  const rng = mulberry32(0xc0ffee);
  const products = mkWorld(rng, 80);
  const idx = buildStockIndexes(products);
  const productById = new Map(products.map((p) => [p.productId, p]));
  const baseline = applyStockFilters(products, defaultStockFilters, [], idx);
  const baselineCount = baseline.length;

  for (let i = 0; i < 500; i++) {
    it(`cenário #${i}`, () => {
      const rng2 = mulberry32(0xdead0000 + i);
      const filters = mkFilters(rng2);
      const out1 = applyStockFilters(products, filters, [], idx);
      const out2 = applyStockFilters(products, filters, [], idx);

      // I2 idempotência
      expect(out2.length).toBe(out1.length);
      expect(out2.map((p) => p.productId)).toEqual(out1.map((p) => p.productId));

      // I3 monotonicidade
      expect(out1.length).toBeLessThanOrEqual(baselineCount);

      // I4 SKU único
      const seen = new Set<string>();
      for (const p of out1) {
        for (const v of p.variants) {
          expect(seen.has(v.variantSku)).toBe(false);
          seen.add(v.variantSku);
        }
      }

      const wantColorN = normalize(filters.colorName);
      const wantCatN = normalize(filters.categoryId);
      const wantSupN = normalize(filters.supplierId);

      for (const p of out1) {
        const orig = productById.get(p.productId);
        expect(orig).toBeDefined();
        // I1 subconjunto
        expect(p.totalVariants).toBeLessThanOrEqual(orig!.totalVariants);
        const origSkus = new Set(orig!.variants.map((x) => x.variantSku));
        for (const v of p.variants) {
          expect(origSkus.has(v.variantSku)).toBe(true);
          // I6 status canônico (6 valores válidos de StockStatus)
          expect(STATUSES).toContain(v.status);
          // I5 coerência de cor
          if (wantColorN) expect(normalize(v.colorName)).toBe(wantColorN);
        }
        // I7 categoria/fornecedor
        if (wantCatN) expect(normalize(p.categoryName)).toBe(wantCatN);
        if (wantSupN) expect(normalize(p.supplierName)).toBe(wantSupN);
        // I8 status=critical
        if (filters.status === 'critical') {
          const hasCrit =
            p.variants.some((x) => x.status === 'critical') || p.overallStatus === 'critical';
          expect(hasCrit).toBe(true);
        }
        // I9 status=incoming
        if (filters.status === 'incoming') {
          const hasIncoming =
            p.variants.some((x) => x.status === 'incoming' || x.inTransitStock > 0) ||
            p.overallStatus === 'incoming';
          expect(hasIncoming).toBe(true);
        }
      }
    });
  }
});
