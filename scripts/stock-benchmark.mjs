#!/usr/bin/env node
/**
 * Benchmark do módulo de Estoque — gera relatório antes/depois para
 * regressão de performance em cenários com 10k SKUs.
 *
 * Saída: stock-benchmark-report.json (raiz do projeto)
 *
 * Uso:
 *   node scripts/stock-benchmark.mjs                  # gera baseline atual
 *   BASELINE=stock-benchmark-baseline.json node ...   # compara vs baseline
 *
 * Regride se p95 piorar mais que THRESHOLD_PCT (default 25%).
 */
import { performance } from 'node:perf_hooks';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Importa via tsx-like runtime do Node 20+: usamos require dinâmico do build.
// Para evitar bundler aqui, replicamos a fixture e medimos as funções puras
// através do ts-node/tsx do projeto. Quando rodado pelo CI usamos `tsx`.

const { applyStockFilters, buildStockIndexes } = await import(
  '../src/lib/inventory/stock-filter.ts'
);
const { defaultStockFilters } = await import('../src/types/stock.ts');

const SKU_COUNT = Number(process.env.SKU_COUNT ?? 10_000);
const ITERATIONS = Number(process.env.ITERATIONS ?? 30);
const THRESHOLD_PCT = Number(process.env.THRESHOLD_PCT ?? 25);

const colors = [
  ['Azul', '#0000FF'], ['Vermelho', '#FF0000'], ['Verde', '#00FF00'],
  ['Preto', '#000000'], ['Branco', '#FFFFFF'], ['Amarelo', '#FFFF00'],
];

function buildDataset(n) {
  const products = [];
  const perProduct = 5;
  for (let p = 0; p < Math.ceil(n / perProduct); p++) {
    const variants = [];
    for (let v = 0; v < perProduct; v++) {
      const [name, hex] = colors[(p + v) % colors.length];
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
      });
    }
    products.push({
      productId: `p-${p}`,
      productName: `Produto ${p}`,
      productSku: `P-${p}`,
      totalStock: variants.reduce((s, v) => s + v.currentStock, 0),
      totalReserved: 0,
      totalAvailable: variants.reduce((s, v) => s + v.availableStock, 0),
      totalMinStock: variants.length * 10,
      worstStatus: 'in_stock',
      variantCount: variants.length,
      variants,
    });
  }
  return products;
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function bench(label, fn) {
  // warmup
  for (let i = 0; i < 3; i++) fn();
  const times = [];
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

console.log(`[stock-benchmark] Dataset: ${SKU_COUNT} SKUs, ${ITERATIONS} iterações`);
const products = buildDataset(SKU_COUNT);

const indexes = buildStockIndexes(products);
const baseFilters = defaultStockFilters();

const results = [
  bench('buildStockIndexes', () => buildStockIndexes(products)),
  bench('applyStockFilters (no filter)', () =>
    applyStockFilters(products, baseFilters, [], indexes),
  ),
  bench('applyStockFilters (search)', () =>
    applyStockFilters(products, { ...baseFilters, search: 'produto 1' }, [], indexes),
  ),
  bench('applyStockFilters (status=low_stock)', () =>
    applyStockFilters(products, { ...baseFilters, status: ['low_stock'] }, [], indexes),
  ),
  bench('applyStockFilters (color=Azul)', () =>
    applyStockFilters(products, { ...baseFilters, colors: ['Azul'] }, [], indexes),
  ),
];

const report = {
  generatedAt: new Date().toISOString(),
  skuCount: SKU_COUNT,
  iterations: ITERATIONS,
  results,
};

const baselinePath = process.env.BASELINE;
let exitCode = 0;
if (baselinePath && existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  report.comparison = [];
  for (const cur of results) {
    const prev = baseline.results?.find((r) => r.label === cur.label);
    if (!prev) continue;
    const delta = ((cur.p95Ms - prev.p95Ms) / prev.p95Ms) * 100;
    const entry = {
      label: cur.label,
      p95Before: prev.p95Ms,
      p95After: cur.p95Ms,
      deltaPct: +delta.toFixed(2),
      regressed: delta > THRESHOLD_PCT,
    };
    report.comparison.push(entry);
    if (entry.regressed) {
      console.error(
        `❌ REGRESSÃO: ${cur.label} p95 ${prev.p95Ms}ms → ${cur.p95Ms}ms (+${delta.toFixed(1)}%)`,
      );
      exitCode = 1;
    } else {
      console.log(
        `✅ ${cur.label}: p95 ${prev.p95Ms}ms → ${cur.p95Ms}ms (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`,
      );
    }
  }
} else {
  for (const r of results) {
    console.log(`  ${r.label}: avg=${r.avgMs}ms p95=${r.p95Ms}ms`);
  }
}

writeFileSync(
  resolve(process.cwd(), 'stock-benchmark-report.json'),
  JSON.stringify(report, null, 2),
);
console.log('[stock-benchmark] Relatório: stock-benchmark-report.json');
process.exit(exitCode);
