/**
 * SSOT do cálculo de "Saúde do Estoque" e classificação por faixa.
 *
 * Importado pelo StockDashboard (UI) e pelos testes unitários — sem duplicação.
 *
 * Thresholds são DINÂMICOS por produto (derivam do `min` cadastrado de cada
 * produto, calculados em `calculateStockStatus` em src/types/stock.ts):
 *   - crítico:   current ≤ min * 0.25
 *   - baixo:     min * 0.25 < current ≤ min
 *   - adequado:  current > min
 *   - sem estoque: current ≤ 0 (sem `inTransit`)
 *   - chegando:  current ≤ 0 com `inTransit > 0`
 */

import type { ProductStockSummary, StockStatus } from '@/types/stock';

export type HealthBand = 'good' | 'warning' | 'danger';

export interface HealthScoreInput {
  productsInStock: number;
  totalProducts: number;
}

export interface ProductBuckets {
  healthy: ProductStockSummary[];
  low: ProductStockSummary[];
  critical: ProductStockSummary[];
  out: ProductStockSummary[];
  incoming: ProductStockSummary[];
}

/**
 * Saúde = round(productsInStock / totalProducts * 100).
 * Quando não há produtos, retornamos 100 (não há nada para alertar).
 */
export function calcHealthScore({ productsInStock, totalProducts }: HealthScoreInput): number {
  // Defesa contra NaN/Infinity/negativos vindos de agregações tortas.
  if (!Number.isFinite(productsInStock) || !Number.isFinite(totalProducts)) return 0;
  if (totalProducts <= 0) return 100;
  const safeIn = Math.max(0, productsInStock);
  const ratio = safeIn / totalProducts;
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

/** Faixa visual do score: ≥80 verde · 50–79 amarelo · <50 vermelho. */
export function getHealthBand(score: number): HealthBand {
  if (!Number.isFinite(score)) return 'danger';
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'danger';
}

/**
 * SSOT da faixa de cobertura em dias (`daysCover = floor(stockOnHand / avgDailySales)`).
 *   ≥ 30d → good · 7–29d → warning · <7d ou indefinido/0 → danger
 */
export type DaysCoverBand = HealthBand;
export function getDaysCoverBand(days: number | undefined | null): DaysCoverBand {
  if (days === null || days === undefined || !Number.isFinite(days) || days < 7) return 'danger';
  if (days < 30) return 'warning';
  return 'good';
}

const STATUS_BUCKET: Record<StockStatus, keyof ProductBuckets | null> = {
  in_stock: 'healthy',
  low_stock: 'low',
  critical: 'critical',
  out_of_stock: 'out',
  incoming: 'incoming',
  overstocked: 'healthy',
};

export function bucketByStatus(products: readonly ProductStockSummary[]): ProductBuckets {
  const buckets: ProductBuckets = {
    healthy: [],
    low: [],
    critical: [],
    out: [],
    incoming: [],
  };
  for (const p of products) {
    const key = STATUS_BUCKET[p.overallStatus];
    if (key) buckets[key].push(p);
  }
  return buckets;
}

/** Conta `severity === 'error'` (alertas críticos exibidos no badge). */
export function countCriticalAlerts(alerts: ReadonlyArray<{ severity: string }>): number {
  let n = 0;
  for (const a of alerts) if (a.severity === 'error') n++;
  return n;
}

export const HEALTH_BANDS: ReadonlyArray<{ band: HealthBand; min: number; label: string }> = [
  { band: 'good', min: 80, label: '≥ 80% · saudável' },
  { band: 'warning', min: 50, label: '50% a 79% · atenção' },
  { band: 'danger', min: 0, label: '< 50% · crítico' },
];

export const STOCK_THRESHOLD_RULES: ReadonlyArray<{
  key: 'healthy' | 'low' | 'critical' | 'out';
  label: string;
  rule: string;
}> = [
  { key: 'healthy', label: 'Adequado', rule: 'estoque atual > mínimo do produto' },
  { key: 'low', label: 'Baixo', rule: '25% do mínimo < estoque ≤ mínimo' },
  { key: 'critical', label: 'Crítico', rule: 'estoque ≤ 25% do mínimo (e > 0)' },
  { key: 'out', label: 'Sem estoque', rule: 'estoque = 0 (sem reposição em trânsito)' },
];
