/**
 * Benchmark do módulo de Estoque — 10k SKUs, gera relatório antes/depois.
 *
 * Rodar como teste vitest para reutilizar resolução de paths `@/`:
 *   npx vitest run scripts/__tests__/stock-benchmark.test.ts
 *
 * Comparação vs baseline:
 *   BASELINE=stock-benchmark-baseline.json THRESHOLD_PCT=25 npx vitest run scripts/__tests__/stock-benchmark.test.ts
 *
 * Saída sempre escrita em ./stock-benchmark-report.json
 * Falha quando p95 piora mais que THRESHOLD_PCT (default 25%).
 */
import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyStockFilters, buildStockIndexes } from '@/lib/inventory/stock-filter';
import { defaultStockFilters, type ProductStockSummary, type VariantStock } from '@/types/stock';

const SKU_COUNT = Number(process.env.SKU_COUNT ?? 10_000);
const ITERATIONS = Number(process.env.ITERATIONS ?? 30);
const THRESHOLD_PCT = Number(process.env.THRESHOLD_PCT ?? 25);
const BASELINE = process.env.BASELINE;

const COLORS: Array<[string, string]> = [
  ['Azul', '#0000FF'], ['Vermelho', '#FF0000'], ['Verde', '#00FF00'],
  ['Preto', '#000000'], ['Branco', '#FFFFFF'], ['Amarelo', '#FFFF00'],
];

function buildDataset(n: number): ProductStockSummary[] {
  const products: ProductStockSummary[] = [];
  const perProduct = 5;
  for (let p = 0; p < Math.ceil(n / perProduct); p++) {
    const variants: VariantStock[] = [];
    for (let v = 0; v < perProduct; v++) {
      const [name, hex] = COLORS[(p + v) % COLORS.length];
      const stock = (p * 7 + v * 13) % 500;
      variants.push({
        id: `v-${p}-${v}`,
        productId: `p-${p}`,
        variantId: `v-${p}-${v}`,
        variantSku: `SKU-${p}-${v}`,
        colorName: name,
        colorHex: hex,
        currentStock: stock,
        minStock: 10,
        reservedStock: 0,
        inTransitStock: 0,
        availableStock: stock,
        status: stock === 0 ? 'out_of_stock' : stock < 10 ? 'low_stock' : 'in_stock',
        daysUntilStockout: stock,
        updatedAt: new Date().toISOString(),
      } as VariantStock);
    }
    products.push({
      productId: `p-${p}`,
      productName: `Produto ${p}`,
      productSku: `P-${p}`,
      totalStock: variants.reduce((s, x) => s + x.currentStock, 0),
      totalReserved: 0,
      totalAvailable: variants.reduce((s, x) => s + x.availableStock, 0),
      totalMinStock: variants.length * 10,
      worstStatus: 'in_stock',
      variantCount: variants.length,
      variants,
    } as ProductStockSummary);
  }
  return products;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function bench(label: string, fn: () => unknown) {
  for (let i = 0; i < 3; i++) fn();
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  return {
    label,
    iterations: ITERATIONS,
    avgMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3),
    p50Ms: +percentile(times, 50).toFixed(3),
    p95Ms: +percentile(times, 95).toFixed(3),
    maxMs: +Math.max(...times).toFixed(3),
  };
}

describe(`stock benchmark — ${SKU_COUNT} SKUs × ${ITERATIONS} iter`, () => {
  it('gera relatório e bloqueia regressão > THRESHOLD_PCT em p95', () => {
    const products = buildDataset(SKU_COUNT);
    const indexes = buildStockIndexes(products);
    const base = { ...defaultStockFilters };

    const results = [
      bench('buildStockIndexes', () => buildStockIndexes(products)),
      bench('applyStockFilters (no filter)', () =>
        applyStockFilters(products, base, [], indexes),
      ),
      bench('applyStockFilters (search)', () =>
        applyStockFilters(products, { ...base, search: 'produto 1' }, [], indexes),
      ),
      bench('applyStockFilters (status=low_stock)', () =>
        applyStockFilters(products, { ...base, status: ['low_stock'] }, [], indexes),
      ),
      bench('applyStockFilters (color=Azul)', () =>
        applyStockFilters(products, { ...base, colors: ['Azul'] }, [], indexes),
      ),
    ];

    const report: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      skuCount: SKU_COUNT,
      iterations: ITERATIONS,
      results,
    };

    const regressions: string[] = [];
    if (BASELINE && existsSync(BASELINE)) {
      const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as {
        results?: Array<{ label: string; p95Ms: number }>;
      };
      report.comparison = results.map((cur) => {
        const prev = baseline.results?.find((r) => r.label === cur.label);
        if (!prev) return { label: cur.label, p95After: cur.p95Ms, baseline: 'missing' };
        const delta = ((cur.p95Ms - prev.p95Ms) / prev.p95Ms) * 100;
        const regressed = delta > THRESHOLD_PCT;
        if (regressed) {
          regressions.push(
            `${cur.label}: ${prev.p95Ms}ms → ${cur.p95Ms}ms (+${delta.toFixed(1)}%)`,
          );
        }
        return {
          label: cur.label,
          p95Before: prev.p95Ms,
          p95After: cur.p95Ms,
          deltaPct: +delta.toFixed(2),
          regressed,
        };
      });
    }

    writeFileSync(
      resolve(process.cwd(), 'stock-benchmark-report.json'),
      JSON.stringify(report, null, 2),
    );

    // eslint-disable-next-line no-console
    console.log('\n[stock-benchmark]', JSON.stringify(results, null, 2));
    expect(regressions, `Regressões detectadas:\n${regressions.join('\n')}`).toHaveLength(0);
  }, 120_000);
});
