/**
 * Cálculo do score de confiabilidade do fornecedor.
 *
 * FÓRMULA:
 *   pontuality_i  = clamp(0, 1, 1 − max(0, delayDays_i) / pontualityZeroAtDays)
 *   fulfillment_i = min(1, receivedQty_i / promisedQty_i)
 *   pontualityScore  = avg(pontuality_i)
 *   fulfillmentScore = avg(fulfillment_i)
 *   score = round(100 * (pontualityWeight*pontualityScore + fulfillmentWeight*fulfillmentScore))
 *
 * BANDAS: high ≥85, medium 60..84, low <60, unknown se matchedCount=0.
 *
 * EDGE CASES tratados:
 *   - matchedCount=0 → score=null, band='unknown'
 *   - delay negativo (adiantado) → pontuality=1.0 (full credit)
 *   - fulfillment > 100% → cap em 100% (não premia excesso)
 *   - promised=0 → fulfillment=0 (defensivo; extract já filtra)
 */

import type {
  ConfidenceBand,
  ReliabilityConfig,
  ReliabilityWindow,
  ReplenishmentMatch,
} from './types';
import { DEFAULT_RELIABILITY_CONFIG } from './types';

export function computeWindow(
  matches: readonly ReplenishmentMatch[],
  config: Partial<ReliabilityConfig> = {},
): ReliabilityWindow {
  const cfg = { ...DEFAULT_RELIABILITY_CONFIG, ...config };
  if (matches.length === 0) {
    return {
      score: null,
      matchedCount: 0,
      pontualityScore: null,
      fulfillmentScore: null,
      avgDelayDays: null,
    };
  }

  let pSum = 0;
  let fSum = 0;
  let delaySum = 0;
  let delayCount = 0;
  for (const m of matches) {
    const delayPositive = Math.max(0, m.delayDays);
    const pontuality = Math.max(0, 1 - delayPositive / cfg.pontualityZeroAtDays);
    pSum += pontuality;
    fSum += Math.max(0, Math.min(1, m.fulfillmentRatio));
    if (m.delayDays > 0) {
      delaySum += m.delayDays;
      delayCount += 1;
    }
  }
  const pontualityScore = pSum / matches.length;
  const fulfillmentScore = fSum / matches.length;
  const score = Math.round(
    100 * (cfg.pontualityWeight * pontualityScore + cfg.fulfillmentWeight * fulfillmentScore),
  );
  return {
    score,
    matchedCount: matches.length,
    pontualityScore,
    fulfillmentScore,
    avgDelayDays: delayCount > 0 ? delaySum / delayCount : null,
  };
}

export function bandFromScore(
  score: number | null,
  config: Partial<ReliabilityConfig> = {},
): ConfidenceBand {
  const cfg = { ...DEFAULT_RELIABILITY_CONFIG, ...config };
  if (score === null) return 'unknown';
  if (score >= cfg.highBandMin) return 'high';
  if (score >= cfg.mediumBandMin) return 'medium';
  return 'low';
}

/** Filtra matches por janela em dias (relativa ao "hoje" ou data fornecida). */
export function filterMatchesByWindow(
  matches: readonly ReplenishmentMatch[],
  days: number,
  now: Date = new Date(),
): ReplenishmentMatch[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return matches.filter((m) => {
    const t = Date.parse(m.arrival.receivedAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}
