/**
 * Tipos canônicos do módulo de Confiabilidade de Fornecedores.
 *
 * Pipeline:
 *   variant_supplier_sources.next_date_N/next_quantity_N  →  PromisedReplenishment
 *   stock_snapshots (delta positivo)                      →  ActualArrival
 *   matching(promessas, chegadas)                         →  ReplenishmentMatch[]
 *   aggregate(matches, suppliers)                          →  SupplierReliability[]
 *
 * Documentado em mem://features/supplier-reliability-panel.
 */

/** Promessa de reposição extraída de um slot (1..6) de variant_supplier_sources. */
export interface PromisedReplenishment {
  /** Estável: `${sourceId}:${slot}` — identifica unicamente uma promessa ativa. */
  id: string;
  sourceId: string;
  supplierId: string;
  variantId: string;
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  /** Data prometida (ISO yyyy-mm-dd). */
  promisedDate: string;
  /** Quantidade prometida (> 0). */
  promisedQuantity: number;
  /** updated_at da source — proxy de "quando a promessa foi observada". */
  observedAt: string;
}

/** Chegada real de estoque, derivada de stock_snapshots com delta positivo. */
export interface ActualArrival {
  id: string;
  sourceId: string;
  supplierId: string;
  variantId: string;
  /** Δ positivo: (stock_main_new + stock_other_new) − (stock_main_old + stock_other_old). */
  receivedQuantity: number;
  /** Data efetiva da chegada (captured_at ISO). */
  receivedAt: string;
}

/** Pareamento promessa × chegada (resolvido). */
export interface ReplenishmentMatch {
  promise: PromisedReplenishment;
  arrival: ActualArrival;
  /** arrival.receivedAt − promise.promisedDate (positivo = atraso, negativo = adiantado). */
  delayDays: number;
  /** min(1, arrival.receivedQuantity / promise.promisedQuantity). */
  fulfillmentRatio: number;
}

/** Promessa que nunca casou (chegada não aconteceu na janela). */
export interface UnmatchedPromise {
  promise: PromisedReplenishment;
  /** 'expired' = passou a janela sem chegada; 'pending' = ainda no futuro. */
  reason: 'expired' | 'pending';
}

/** Chegada sem promessa associada (entrada não anunciada). */
export interface OrphanArrival {
  arrival: ActualArrival;
}

export interface MatchingResult {
  matches: ReplenishmentMatch[];
  unmatchedPromises: UnmatchedPromise[];
  orphanArrivals: OrphanArrival[];
}

export type ConfidenceBand = 'high' | 'low' | 'medium' | 'unknown';

export interface ReliabilityWindow {
  /** Score 0..100, ou null se sem dados na janela. */
  score: number | null;
  /** Quantidade de chegadas pareadas na janela. */
  matchedCount: number;
  /** % pontualidade ponderada (0..1). */
  pontualityScore: number | null;
  /** % cumprimento de quantidade (0..1). */
  fulfillmentScore: number | null;
  /** Média de atraso em dias (somente atrasos positivos). null se sem atrasos. */
  avgDelayDays: number | null;
}

export interface SupplierReliability {
  supplierId: string;
  supplierName: string;
  totalPromises: number;
  totalArrivals: number;
  matchedCount: number;
  orphanArrivalsCount: number;
  expiredPromisesCount: number;
  /** Próxima reposição prometida (mais próxima no futuro). */
  nextPromise: PromisedReplenishment | null;
  /** Score geral (todas as janelas, todas as pareadas) + janelas. */
  overall: ReliabilityWindow;
  last30d: ReliabilityWindow;
  last90d: ReliabilityWindow;
  band: ConfidenceBand;
}

/** Parâmetros do matching/score. Expostos para testes e tuning. */
export interface ReliabilityConfig {
  /** Janela ± em dias para parear uma chegada com uma promessa. Default 15. */
  matchWindowDays: number;
  /** Dias de atraso a partir dos quais pontualidade vira 0. Default 14. */
  pontualityZeroAtDays: number;
  /** Peso pontualidade no score. Default 0.6. */
  pontualityWeight: number;
  /** Peso cumprimento no score. Default 0.4. */
  fulfillmentWeight: number;
  /** Limite inferior da banda "high". Default 85. */
  highBandMin: number;
  /** Limite inferior da banda "medium". Default 60. */
  mediumBandMin: number;
}

export const DEFAULT_RELIABILITY_CONFIG: ReliabilityConfig = Object.freeze({
  matchWindowDays: 15,
  pontualityZeroAtDays: 14,
  pontualityWeight: 0.6,
  fulfillmentWeight: 0.4,
  highBandMin: 85,
  mediumBandMin: 60,
});
