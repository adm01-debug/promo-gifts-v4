/**
 * Regressão SSOT — consistência do módulo Estoque (granularidade VARIAÇÃO).
 *
 * Histórico (mantido para contexto):
 *   - O KPI "Estoque Baixo" (productsLowStock) ficou ESTRUTURALMENTE 0 após a
 *     descontinuação da régua por `min` e foi removido (card morto).
 *   - O card "Crítico" (productsCritical) foi SUBSTITUÍDO por "Risco de Ruptura"
 *     (EMA, Onda 1) e migrado para granularidade de VARIAÇÃO (variantsCritical).
 *   - O dashboard passou a montar os cards via `buildStockKpiCards` — helper puro
 *     extraído justamente para teste unitário (sem providers / React Query).
 *
 * Invariantes (qualquer regressão FALHA o build):
 *   1. Chips da tabela preservam labels: low_stock→'Estoque Baixo',
 *      out_of_stock→'Sem Estoque', critical→'Crítico'.
 *   2. buildStockKpiCards produz os 4 slugs de variação e NÃO reintroduz o
 *      card morto "Estoque Baixo".
 *   3. "Risco de Ruptura" usa variantsCritical no fallback (EMA off) e a contagem
 *      EMA quando fornecida; mantém filter='critical'. Nunca usa productsCritical.
 *   4. O dashboard delega ao builder (não volta a hardcodar cards inline).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildStockKpiCards } from '@/components/inventory/stockKpiCards';
import type { StockDashboardSummary } from '@/types/stock';

const ROOT = resolve(__dirname, '../../..');
const TABLE_SRC = readFileSync(
  resolve(ROOT, 'components/inventory/VariantStockTable.tsx'),
  'utf8',
);
const DASHBOARD_SRC = readFileSync(
  resolve(ROOT, 'components/inventory/StockDashboard.tsx'),
  'utf8',
);

const summaryOf = (
  over: Partial<StockDashboardSummary> = {},
): StockDashboardSummary => ({
  totalProducts: 10,
  totalVariants: 25,
  totalColors: 4,
  productsInStock: 7,
  productsLowStock: 2,
  productsCritical: 1,
  productsOutOfStock: 1,
  variantsInStock: 18,
  variantsLowStock: 4,
  variantsCritical: 2,
  variantsOutOfStock: 1,
  totalStockValue: 0,
  totalAvailableValue: 0,
  averageDaysOfStock: 0,
  stockTurnoverRate: 0,
  totalAlerts: 5,
  criticalAlerts: 1,
  incomingStockValue: 0,
  ...over,
});

describe('SSOT — chips de status da VariantStockTable', () => {
  it('low_stock preserva o label "Estoque Baixo"', () => {
    expect(TABLE_SRC).toMatch(/low_stock:\s*'Estoque Baixo'/);
  });
  it('out_of_stock usa "Sem Estoque"', () => {
    expect(TABLE_SRC).toMatch(/out_of_stock:\s*'Sem Estoque'/);
  });
  it('critical usa "Crítico"', () => {
    expect(TABLE_SRC).toMatch(/critical:\s*'Crítico'/);
  });
});

describe('SSOT — buildStockKpiCards (granularidade variação)', () => {
  it('produz exatamente os 4 slugs esperados (sem card morto "Estoque Baixo")', () => {
    const cards = buildStockKpiCards(summaryOf());
    expect(cards.map((c) => c.slug)).toEqual([
      'total-de-variacoes',
      'em-estoque',
      'risco-de-ruptura',
      'sem-estoque',
    ]);
    expect(cards.some((c) => c.title === 'Estoque Baixo')).toBe(false);
  });

  it('"Risco de Ruptura": fallback usa variantsCritical e filter="critical"', () => {
    const card = buildStockKpiCards(summaryOf({ variantsCritical: 7 })).find(
      (c) => c.slug === 'risco-de-ruptura',
    );
    expect(card?.value).toBe(7);
    expect(card?.filter).toBe('critical');
  });

  it('"Risco de Ruptura": usa a contagem EMA (≤30d) quando fornecida', () => {
    const card = buildStockKpiCards(summaryOf({ variantsCritical: 7 }), 3).find(
      (c) => c.slug === 'risco-de-ruptura',
    );
    expect(card?.value).toBe(3);
  });

  it('"Sem Estoque" usa variantsOutOfStock e filter="out_of_stock"', () => {
    const card = buildStockKpiCards(summaryOf({ variantsOutOfStock: 9 })).find(
      (c) => c.slug === 'sem-estoque',
    );
    expect(card?.value).toBe(9);
    expect(card?.filter).toBe('out_of_stock');
  });

  it('o card crítico usa variantsCritical, NÃO productsCritical', () => {
    const card = buildStockKpiCards(
      summaryOf({ variantsCritical: 2, productsCritical: 99 }),
    ).find((c) => c.slug === 'risco-de-ruptura');
    expect(card?.value).toBe(2);
    expect(card?.value).not.toBe(99);
  });
});

describe('SSOT — o dashboard delega ao builder', () => {
  it('StockDashboard usa buildStockKpiCards e não reintroduz o card morto inline', () => {
    expect(DASHBOARD_SRC).toMatch(/buildStockKpiCards\(/);
    expect(DASHBOARD_SRC).not.toMatch(/title="Estoque Baixo"/);
  });
});
