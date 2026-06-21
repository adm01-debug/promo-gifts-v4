/**
 * Trending Score — algoritmo de ranqueamento por crescimento (não só volume).
 *
 * Score = (recente / baseline) * decay temporal * peso de volume mínimo
 *
 * - recente: eventos nos últimos `recentDays` (ex: 7d)
 * - baseline: média diária dos `baselineDays` anteriores (ex: 30d)
 * - decayFactor: penaliza séries muito antigas
 * - minVolumeWeight: evita inflar produtos com 1-2 vendas explosivas
 */

export interface TrendingScoreInput {
  recentCount: number; // eventos nos últimos N dias
  baselineCount: number; // eventos nos N dias anteriores
  recentDays: number; // janela "recente" (ex: 7)
  baselineDays: number; // janela "baseline" (ex: 23 — para somar 30 dias)
  totalVolume?: number; // volume absoluto (para peso mínimo)
}

export interface TrendingScoreResult {
  score: number; // 0..∞ (1.0 = estável; >1 cresceu; <1 caiu)
  growthPercent: number; // crescimento % vs baseline
  classification: 'falling' | 'new' | 'rising' | 'stable';
}

/**
 * Calcula o score de tendência. Retorna 1.0 quando recente == baseline (estável).
 */
export function calculateTrendingScore({
  recentCount,
  baselineCount,
  recentDays,
  baselineDays,
  totalVolume = 0,
}: TrendingScoreInput): TrendingScoreResult {
  // Taxa diária para normalizar janelas de tamanhos diferentes
  const recentDaily = recentDays > 0 ? recentCount / recentDays : 0;
  const baselineDaily = baselineDays > 0 ? baselineCount / baselineDays : 0;

  // Produto novo: nunca apareceu no baseline
  if (baselineDaily === 0 && recentDaily > 0) {
    // Score alto, mas amortecido pelo volume mínimo
    const volumeWeight = Math.min(totalVolume / 5, 1); // 5+ vendas = peso cheio
    return {
      score: 2.0 + volumeWeight,
      growthPercent: Infinity,
      classification: 'new',
    };
  }

  // Sem dados em nenhuma janela
  if (baselineDaily === 0 && recentDaily === 0) {
    return { score: 0, growthPercent: 0, classification: 'stable' };
  }

  const ratio = recentDaily / baselineDaily;
  const growthPercent = (ratio - 1) * 100;

  // Peso por volume mínimo: produtos com <3 eventos no recente têm peso reduzido
  const volumeWeight = Math.min(recentCount / 3, 1);

  // Score final ponderado
  const score = ratio * (0.5 + 0.5 * volumeWeight);

  let classification: TrendingScoreResult['classification'];
  if (ratio >= 1.3) classification = 'rising';
  else if (ratio <= 0.7) classification = 'falling';
  else classification = 'stable';

  return { score, growthPercent, classification };
}

/**
 * Calcula delta percentual entre período atual e anterior.
 * Retorna null quando não há dados suficientes.
 */
export function calculateDelta(
  current: number,
  previous: number,
): {
  delta: number;
  direction: 'down' | 'neutral' | 'up';
  isSignificant: boolean;
} | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return { delta: 100, direction: 'up', isSignificant: true };
  }
  const delta = ((current - previous) / previous) * 100;
  return {
    delta: Math.round(delta * 10) / 10,
    direction: delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'neutral',
    isSignificant: Math.abs(delta) >= 5,
  };
}
