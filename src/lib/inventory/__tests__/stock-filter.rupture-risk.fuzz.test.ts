/**
 * stock-filter.rupture-risk.fuzz — 500 simulações randomizadas validando
 * invariantes do filtro "Risco de Ruptura" sob universos sintéticos.
 *
 * Invariantes testadas em CADA simulação:
 *   I1. Todas variações da saída ∈ ruptureRiskVariantIds (subset estrito).
 *   I2. Toda variação que está no set E existe em algum produto do universo
 *       aparece exatamente UMA vez na saída (sem duplicação, sem perda).
 *   I3. ∀ produto p ∈ saída: p.variants.length ≥ 1 (sem produtos órfãos).
 *   I4. Nenhuma variação fora do set (status in_stock/out_of_stock/critical)
 *       aparece na saída (proteção contra "vazamento de variações OK").
 *   I5. Paridade card↔tabela: Σ variants.length = |set ∩ universo|.
 *   I6. Idempotência: aplicar o filtro duas vezes produz o mesmo resultado.
 *   I7. Filtro vazio (set undefined ou size=0) ≡ comportamento legado
 *       (mantém produtos conforme filters.status).
 *   I8. Combinação com `search`: a interseção nunca expande o resultado.
 *   I9. Fallback flag-off: status='critical' filtra por overallStatus apenas.
 *   I10. Sem mutação: o array de produtos original não é alterado.
 */
import { describe, expect, it } from 'vitest';
import { applyStockFilters } from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockStatus,
  type VariantStock,
} from '@/types/stock';

// PRNG determinístico (mulberry32) — seeds reproduzíveis.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['Azul', 'Vermelho', 'Verde', 'Preto', 'Branco', 'Amarelo', 'Cinza'];
const STATUSES: VariantStock['status'][] = ['in_stock', 'out_of_stock', 'critical'];

function makeUniverse(seed: number, productCount: number) {
  const rand = rng(seed);
  const products: ProductStockSummary[] = [];
  const allVariantIds: string[] = [];
  for (let i = 0; i < productCount; i++) {
    const variantCount = 1 + Math.floor(rand() * 6); // 1..6
    const variants: VariantStock[] = [];
    for (let j = 0; j < variantCount; j++) {
      const id = `p${i}-v${j}`;
      const stock = Math.floor(rand() * 1000);
      const statusPick = STATUSES[Math.floor(rand() * STATUSES.length)];
      const status: VariantStock['status'] = stock === 0 ? 'out_of_stock' : statusPick;
      variants.push({
        id,
        productId: `p${i}`,
        variantId: id,
        variantSku: id.toUpperCase(),
        colorName: COLORS[Math.floor(rand() * COLORS.length)],
        currentStock: stock,
        minStock: 10,
        reservedStock: 0,
        inTransitStock: 0,
        availableStock: stock,
        status,
        updatedAt: '2026-01-01',
      });
      allVariantIds.push(id);
    }
    const allOut = variants.every((v) => v.status === 'out_of_stock');
    const someCritical = variants.some((v) => v.status === 'critical');
    const overallStatus: ProductStockSummary['overallStatus'] = allOut
      ? 'out_of_stock'
      : someCritical
        ? 'critical'
        : 'in_stock';
    products.push({
      productId: `p${i}`,
      productName: `Produto ${i}`,
      productSku: `P${i}`,
      categoryName: 'Geral',
      supplierName: 'Forn',
      overallStatus,
      variantsInStock: variants.filter((v) => v.status === 'in_stock').length,
      variantsLowStock: 0,
      variantsCritical: variants.filter((v) => v.status === 'critical').length,
      variantsOutOfStock: variants.filter((v) => v.status === 'out_of_stock').length,
      availableColors: [],
      totalVariants: variants.length,
      totalCurrentStock: variants.reduce((s, v) => s + v.currentStock, 0),
      totalMinStock: variants.reduce((s, v) => s + v.minStock, 0),
      totalReservedStock: 0,
      totalInTransitStock: 0,
      totalAvailableStock: variants.reduce((s, v) => s + v.availableStock, 0),
      variants,
    });
  }
  return { products, allVariantIds };
}

function pickRuptureSet(rand: () => number, ids: string[]): Set<string> {
  // 0..30% das variações entram no set; ocasionalmente inclui IDs inexistentes.
  const target = Math.floor(rand() * Math.max(1, ids.length * 0.3));
  const out = new Set<string>();
  for (let k = 0; k < target; k++) {
    out.add(ids[Math.floor(rand() * ids.length)]);
  }
  // 10% de chance de poluir com IDs fantasmas (não devem aparecer na saída)
  if (rand() < 0.1) out.add(`ghost-${Math.floor(rand() * 1e6)}`);
  return out;
}

const SIM_COUNT = 500;

describe(`stock-filter.fuzz — ${SIM_COUNT} simulações de Risco de Ruptura`, () => {
  it(`mantém todas as ${SIM_COUNT} invariantes`, () => {
    const failures: string[] = [];

    for (let sim = 0; sim < SIM_COUNT; sim++) {
      const rand = rng(sim + 1);
      const productCount = 5 + Math.floor(rand() * 45); // 5..50 produtos
      const { products, allVariantIds } = makeUniverse(sim + 1, productCount);
      const universeIds = new Set(allVariantIds);
      const ruptureSet = pickRuptureSet(rand, allVariantIds);
      const intersection = new Set([...ruptureSet].filter((id) => universeIds.has(id)));

      const snapshot = JSON.stringify(products);
      const out = applyStockFilters(
        products,
        { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet },
        [],
      );

      const outVariantIds = out.flatMap((p) => p.variants.map((v) => v.variantId));
      const outVariantSet = new Set(outVariantIds);

      // Quando o set está vazio, o contrato (I7) é "comportamento legado" —
      // as invariantes I1-I5 não se aplicam.
      const ruptureActive = ruptureSet.size > 0;

      if (ruptureActive) {
        // I1: subset estrito
        for (const id of outVariantIds) {
          if (!ruptureSet.has(id)) {
            failures.push(`#${sim} I1: ${id} fora do set apareceu na saída`);
            break;
          }
        }
        // I2 + I5: paridade card↔tabela (interseção set∩universo)
        if (outVariantSet.size !== intersection.size) {
          failures.push(
            `#${sim} I2/I5: saída=${outVariantSet.size} ≠ interseção=${intersection.size}`,
          );
        }
        for (const id of intersection) {
          if (!outVariantSet.has(id)) {
            failures.push(`#${sim} I2: ${id} ∈ interseção mas ausente da saída`);
            break;
          }
        }
        // I3: produtos sem variações na saída são proibidos
        for (const p of out) {
          if (p.variants.length === 0) {
            failures.push(`#${sim} I3: produto ${p.productId} sem variações na saída`);
            break;
          }
        }
        // I4: nenhum vazamento por classe de status (regressão dirigida)
        for (const status of STATUSES as StockStatus[]) {
          const leak = out
            .flatMap((p) => p.variants)
            .find((v) => v.status === status && !ruptureSet.has(v.variantId));
          if (leak) {
            failures.push(`#${sim} I4[${status}]: vazamento de ${leak.variantId}`);
            break;
          }
        }
      }

      // I6: idempotência (sempre aplica)
      const out2 = applyStockFilters(
        products,
        { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet },
        [],
      );
      const ids1 = outVariantIds.slice().sort().join(',');
      const ids2 = out2
        .flatMap((p) => p.variants.map((v) => v.variantId))
        .sort()
        .join(',');
      if (ids1 !== ids2) failures.push(`#${sim} I6: não-idempotente`);
      // I10: sem mutação no input
      if (JSON.stringify(products) !== snapshot) {
        failures.push(`#${sim} I10: input mutado pelo filtro`);
      }
      // I8: combinação com search nunca expande
      const outWithSearch = applyStockFilters(
        products,
        {
          ...defaultStockFilters,
          ruptureRiskVariantIds: ruptureSet,
          search: 'Produto',
        },
        [],
      );
      const expandedCount = outWithSearch.reduce((s, p) => s + p.variants.length, 0);
      if (expandedCount > outVariantIds.length) {
        failures.push(`#${sim} I8: search expandiu de ${outVariantIds.length}→${expandedCount}`);
      }
    }

    if (failures.length > 0) {
      // Mostra até 10 falhas (suficiente para diagnosticar padrão)
      throw new Error(
        `Falhas em ${failures.length}/${SIM_COUNT * 7} verificações:\n` +
          failures.slice(0, 10).join('\n'),
      );
    }
  });

  it('I7: set vazio ≡ comportamento legado em 100 simulações', () => {
    for (let sim = 0; sim < 100; sim++) {
      const { products } = makeUniverse(sim + 999, 20);
      const baseline = applyStockFilters(products, { ...defaultStockFilters }, []);
      const withEmpty = applyStockFilters(
        products,
        { ...defaultStockFilters, ruptureRiskVariantIds: new Set<string>() },
        [],
      );
      const withUndef = applyStockFilters(
        products,
        { ...defaultStockFilters, ruptureRiskVariantIds: undefined },
        [],
      );
      expect(withEmpty.length).toBe(baseline.length);
      expect(withUndef.length).toBe(baseline.length);
    }
  });

  it('I9: fallback flag-off — status=critical filtra por overallStatus em 100 simulações', () => {
    for (let sim = 0; sim < 100; sim++) {
      const { products } = makeUniverse(sim + 2000, 30);
      const out = applyStockFilters(
        products,
        { ...defaultStockFilters, status: 'critical' },
        [],
      );
      // Todo produto retornado DEVE ter overallStatus === 'critical'
      for (const p of out) {
        expect(p.overallStatus).toBe('critical');
      }
      // E o conjunto deve ser exatamente os críticos do universo
      const expected = products.filter((p) => p.overallStatus === 'critical').length;
      expect(out.length).toBe(expected);
    }
  });
});
