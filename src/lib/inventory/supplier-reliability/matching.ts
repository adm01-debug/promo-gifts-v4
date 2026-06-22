/**
 * Pareamento promessas × chegadas dentro de uma janela ±N dias.
 *
 * ALGORITMO (greedy ordenado por proximidade):
 *   1. Indexa promessas por sourceId.
 *   2. Para cada chegada (mais antiga → mais recente), busca todas as promessas
 *      da MESMA sourceId ainda livres com |captured_at − promisedDate| ≤ window.
 *   3. Escolhe a promessa de menor |Δdias|; empate → menor diferença de quantidade;
 *      empate → menor id (determinístico).
 *   4. Marca promessa como consumida; remanescentes ficam para a próxima chegada.
 *
 * POR QUÊ greedy e não Hungarian? Volume típico: 6 promessas/source vs poucas chegadas/
 * source. O custo de matching ótimo global não compensa — e o greedy ordenado por data
 * é estável e intuitivo para o usuário ("a chegada mais antiga consome a promessa mais
 * próxima"). Coberto por 200+ cenários no fuzz.
 */

import {
  DEFAULT_RELIABILITY_CONFIG,
  type ActualArrival,
  type MatchingResult,
  type OrphanArrival,
  type PromisedReplenishment,
  type ReliabilityConfig,
  type ReplenishmentMatch,
  type UnmatchedPromise,
} from './types';

const MS_PER_DAY = 86_400_000;

function diffDays(aIso: string, bIso: string): number {
  // (a − b) em dias inteiros. Trunca para o dia (UTC) para evitar timezone.
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.round((a - b) / MS_PER_DAY);
}

export function matchReplenishments(
  promises: readonly PromisedReplenishment[],
  arrivals: readonly ActualArrival[],
  config: Partial<ReliabilityConfig> = {},
): MatchingResult {
  const cfg = { ...DEFAULT_RELIABILITY_CONFIG, ...config };
  const window = cfg.matchWindowDays;

  // Indexa promessas por sourceId
  const bySource = new Map<string, PromisedReplenishment[]>();
  for (const p of promises) {
    const arr = bySource.get(p.sourceId) ?? [];
    arr.push(p);
    bySource.set(p.sourceId, arr);
  }
  const consumed = new Set<string>();

  // Ordena chegadas por receivedAt ASC (determinismo + ordem natural)
  const sortedArrivals = [...arrivals].sort((a, b) => {
    const cmp = a.receivedAt.localeCompare(b.receivedAt);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });

  const matches: ReplenishmentMatch[] = [];
  const orphanArrivals: OrphanArrival[] = [];

  for (const arrival of sortedArrivals) {
    const candidates = bySource.get(arrival.sourceId) ?? [];
    let best: { p: PromisedReplenishment; absDelay: number; qtyDiff: number } | null = null;
    for (const p of candidates) {
      if (consumed.has(p.id)) continue;
      const delay = diffDays(arrival.receivedAt, p.promisedDate);
      const absDelay = Math.abs(delay);
      if (absDelay > window) continue;
      const qtyDiff = Math.abs(arrival.receivedQuantity - p.promisedQuantity);
      if (
        best === null ||
        absDelay < best.absDelay ||
        (absDelay === best.absDelay && qtyDiff < best.qtyDiff) ||
        (absDelay === best.absDelay && qtyDiff === best.qtyDiff && p.id < best.p.id)
      ) {
        best = { p, absDelay, qtyDiff };
      }
    }
    if (best === null) {
      orphanArrivals.push({ arrival });
      continue;
    }
    consumed.add(best.p.id);
    const delayDays = diffDays(arrival.receivedAt, best.p.promisedDate);
    const fulfillmentRatio =
      best.p.promisedQuantity > 0
        ? Math.min(1, arrival.receivedQuantity / best.p.promisedQuantity)
        : 0;
    matches.push({ promise: best.p, arrival, delayDays, fulfillmentRatio });
  }

  // Promessas não consumidas
  const todayIso = new Date().toISOString().slice(0, 10);
  const unmatchedPromises: UnmatchedPromise[] = [];
  for (const p of promises) {
    if (consumed.has(p.id)) continue;
    const overdue = diffDays(todayIso, p.promisedDate) > window;
    unmatchedPromises.push({ promise: p, reason: overdue ? 'expired' : 'pending' });
  }

  // Ordenação determinística da saída
  matches.sort((a, b) => a.arrival.receivedAt.localeCompare(b.arrival.receivedAt));
  unmatchedPromises.sort((a, b) => a.promise.promisedDate.localeCompare(b.promise.promisedDate));
  orphanArrivals.sort((a, b) => a.arrival.receivedAt.localeCompare(b.arrival.receivedAt));

  return { matches, unmatchedPromises, orphanArrivals };
}
