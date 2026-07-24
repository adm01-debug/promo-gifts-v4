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

/** Faixa semântica de saúde: verde (good), amarelo (warning) ou vermelho (danger). */
export type HealthBand = 'danger' | 'good' | 'warning';

/** Parâmetros de entrada para o cálculo do score de saúde do estoque. */
export interface HealthScoreInput {
  productsInStock: number;
  totalProducts: number;
}

/** Produtos agrupados por bucket de status para exibição nos cards do dashboard. */
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
export function getDaysCoverBand(days: number | null | undefined): DaysCoverBand {
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

/** Distribui produtos nos 5 buckets de status para os cards do dashboard. */
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
export function countCriticalAlerts<T extends { severity: string }>(alerts: readonly T[]): number {
  let n = 0;
  for (const a of alerts) if (a.severity === 'error') n++;
  return n;
}

/** Definição visual das faixas de saúde (bom ≥80%, atenção 50–79%, crítico <50%). */
export const HEALTH_BANDS: ReadonlyArray<{ band: HealthBand; min: number; label: string }> = [
  { band: 'good', min: 80, label: '≥ 80% · saudável' },
  { band: 'warning', min: 50, label: '50% a 79% · atenção' },
  { band: 'danger', min: 0, label: '< 50% · crítico' },
];

/** Regras de limiar de estoque exibidas no tooltip dos cards do dashboard. */
export const STOCK_THRESHOLD_RULES: ReadonlyArray<{
  key: 'critical' | 'healthy' | 'low' | 'out';
  label: string;
  rule: string;
}> = [
  { key: 'healthy', label: 'Em estoque', rule: 'saldo acima do limiar do fornecedor' },
  {
    key: 'low',
    label: 'Estoque baixo',
    rule: 'saldo positivo, abaixo do limiar configurado no fornecedor',
  },
  { key: 'critical', label: 'Crítico', rule: 'saldo ≤ 25% do mínimo — risco iminente de ruptura' },
  { key: 'out', label: 'Sem estoque', rule: 'saldo zerado (sem reposição em trânsito)' },
];
