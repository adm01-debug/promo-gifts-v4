/**
 * SSOT — Risco de Ruptura (preditivo).
 *
 * Substitui a regra estática de "estoque baixo" (current ≤ min) por uma
 * projeção que considera a média diária de baixa do fornecedor nos últimos
 * 30 dias (Inteligência de Mercado) e a quantidade-alvo desejada pelo
 * vendedor (filtro "quantidade mínima").
 *
 * Fórmula:
 *   projectedStock = current − (avgDailyDepletion × horizonDays)
 *   atRisk         = current > 0 && projectedStock < targetQty
 *
 * Se faltar média OU alvo (ou forem inválidos), retorna `atRisk = false`
 * — o consumidor deve cair no comportamento estático anterior (≤ min).
 */

/** Janelas válidas (em dias) para a projeção de risco de ruptura. */
export const RUPTURE_HORIZON_OPTIONS = [3, 7, 15, 30] as const;
/** Número de dias da janela de ruptura — restrito a `RUPTURE_HORIZON_OPTIONS`. */
export type RuptureHorizonDays = (typeof RUPTURE_HORIZON_OPTIONS)[number];
/** Janela padrão (3 dias) aplicada quando o vendedor não configurou outra. */
export const DEFAULT_RUPTURE_HORIZON: RuptureHorizonDays = 3;

/** Dados de entrada para o cálculo preditivo de risco de ruptura. */
export interface RuptureRiskInput {
  current: number;
  avgDailyDepletion: number | null | undefined;
  targetQty: number | null | undefined;
  horizonDays: number;
}

/** Resultado do cálculo preditivo de risco de ruptura para uma variação. */
export interface RuptureRiskResult {
  /** Verdadeiro se a projeção indica ruptura abaixo do alvo dentro da janela. */
  atRisk: boolean;
  /** Estoque projetado ao fim da janela (≥ 0). `null` se a fórmula não pôde ser aplicada. */
  projectedStock: number | null;
  /** Dias estimados até cruzar o alvo (`null` se sem média ou sem alvo). */
  daysToTarget: number | null;
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function computeRuptureRisk({
  current,
  avgDailyDepletion,
  targetQty,
  horizonDays,
}: RuptureRiskInput): RuptureRiskResult {
  // Pré-condições básicas: current precisa ser numérico finito ≥ 0.
  if (!Number.isFinite(current) || current < 0) {
    return { atRisk: false, projectedStock: null, daysToTarget: null };
  }

  // Fallback crítico: SKU já esgotada (current === 0) é risco máximo
  // independentemente de média/alvo/horizonte. Sem isso, milhares de
  // SKUs sem estoque ficavam fora do KPI "Risco de Ruptura".
  if (current === 0) {
    return { atRisk: true, projectedStock: 0, daysToTarget: 0 };
  }
  if (!isPositiveFinite(avgDailyDepletion)) {
    return { atRisk: false, projectedStock: null, daysToTarget: null };
  }
  if (!isPositiveFinite(targetQty)) {
    return { atRisk: false, projectedStock: null, daysToTarget: null };
  }
  if (!isPositiveFinite(horizonDays)) {
    return { atRisk: false, projectedStock: null, daysToTarget: null };
  }

  const projectedRaw = current - avgDailyDepletion * horizonDays;
  const projectedStock = Math.max(0, Math.round(projectedRaw));
  const daysToTarget =
    current > targetQty ? Math.floor((current - targetQty) / avgDailyDepletion) : 0;

  return {
    atRisk: projectedStock < targetQty,
    projectedStock,
    daysToTarget,
  };
}
