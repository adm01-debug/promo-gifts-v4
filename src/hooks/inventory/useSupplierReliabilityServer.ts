/**
 * useSupplierReliabilityServer — Implementação server-side da aba "Confiabilidade".
 *
 * Substitui a versão client-side (useSupplierReliability) que baixava 200k+ rows.
 * Lê diretamente de:
 *   - mv_supplier_reliability   → KPI bar + tabela de fornecedores (3 rows instant)
 *   - get_supplier_reliability_history (RPC) → drawer de histórico (≤200 rows)
 *
 * A MV é atualizada a cada 15 min via pg_cron (refresh-mv-supplier-reliability).
 * staleTime: 5 min → garante que o cache expira antes do próximo refresh da MV.
 *
 * Compatível com a interface SupplierReliability canônica.
 * Campos ausentes na MV (totalArrivals, orphanArrivalsCount, janela-scores completos)
 * são preenchidos com defaults seguros para manter o contrato de tipos.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type {
  SupplierReliability,
  PromisedReplenishment,
  ReliabilityWindow,
  ConfidenceBand,
} from '@/lib/inventory/supplier-reliability';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos da MV (colunas retornadas pelo PostgREST)
// ─────────────────────────────────────────────────────────────────────────────

interface MvSupplierReliabilityRow {
  supplier_id: string;
  supplier_name: string;
  total_promises: number;
  matched_count: number;
  expired_count: number;
  pending_count: number;
  overall_score: number;
  overall_pontuality: number | null;
  overall_fulfillment: number | null;
  overall_avg_delay_days: number | null;
  score_30d: number;
  matched_30d: number;
  score_90d: number;
  matched_90d: number;
  next_promise_date: string | null;
  next_promise_quantity: number | null;
  band: string;
  refreshed_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento MV row → SupplierReliability
// ─────────────────────────────────────────────────────────────────────────────

function buildReliabilityWindow(
  score: number,
  matchedCount: number,
  pontualityScore: number | null = null,
  fulfillmentScore: number | null = null,
  avgDelayDays: number | null = null,
): ReliabilityWindow {
  return {
    score: matchedCount > 0 ? score : null,
    matchedCount,
    pontualityScore,
    fulfillmentScore,
    avgDelayDays,
  };
}

function mvRowToSupplierReliability(row: MvSupplierReliabilityRow): SupplierReliability {
  const nextPromise: PromisedReplenishment | null = row.next_promise_date
    ? {
        // id sintético para estabilidade de key no React.
        id: `${row.supplier_id}:next`,
        sourceId: '',
        supplierId: row.supplier_id,
        variantId: '',
        slot: 1 as const,
        promisedDate: row.next_promise_date,
        promisedQuantity: row.next_promise_quantity ?? 0,
        observedAt: row.refreshed_at,
      }
    : null;

  const band = (['high', 'medium', 'low', 'unknown'].includes(row.band)
    ? row.band
    : 'unknown') as ConfidenceBand;

  return {
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    totalPromises: row.total_promises,
    // totalArrivals não existe na MV; matched_count é proxy conservador
    totalArrivals: row.matched_count,
    matchedCount: row.matched_count,
    // orphanArrivalsCount não rastreado na MV
    orphanArrivalsCount: 0,
    expiredPromisesCount: row.expired_count,
    nextPromise,
    overall: buildReliabilityWindow(
      row.overall_score,
      row.matched_count,
      row.overall_pontuality,
      row.overall_fulfillment,
      row.overall_avg_delay_days,
    ),
    // Janelas 30d/90d: MV tem score + matched_count (sem breakdown pontuality/fulfillment)
    last30d: buildReliabilityWindow(row.score_30d, row.matched_30d),
    last90d: buildReliabilityWindow(row.score_90d, row.matched_90d),
    band,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher da MV
// ─────────────────────────────────────────────────────────────────────────────

async function fetchMvReliability(): Promise<SupplierReliability[]> {
  const { data, error } = await supabase
    .from('mv_supplier_reliability')
    .select('*')
    .order('overall_score', { ascending: false });

  if (error) {
    logger.warn('[ReliabilityServer] mv_supplier_reliability fetch failed', error);
    throw error;
  }

  return (data as MvSupplierReliabilityRow[]).map(mvRowToSupplierReliability);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook principal — summary (KPI bar + tabela)
// ─────────────────────────────────────────────────────────────────────────────

export function useSupplierReliabilityServer() {
  const query = useQuery({
    queryKey: ['supplier-reliability-server', 'v2'],
    queryFn: fetchMvReliability,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    suppliers: query.data ?? [],
    matching: null,
    rawCounts: query.data
      ? {
          sources: 0,
          snapshots: 0,
          suppliers: query.data.length,
        }
      : null,
    dataSource: 'server' as const,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook de histórico (drawer) — RPC get_supplier_reliability_history
// ─────────────────────────────────────────────────────────────────────────────

export interface SupplierReliabilityEvent {
  id: string;
  sourceId: string;
  variantId: string;
  slot: number;
  promisedDate: string;
  promisedQuantity: number;
  resolution: 'fulfilled' | 'expired';
  actualDate: string | null;
  actualQuantity: number | null;
  delayDays: number | null;
  fulfillmentRatio: number | null;
  resolvedAt: string | null;
  createdAt: string;
}

async function fetchReliabilityHistory(
  supplierId: string,
  limit = 200,
): Promise<SupplierReliabilityEvent[]> {
  const { data, error } = await supabase.rpc('get_supplier_reliability_history', {
    _supplier_id: supplierId,
    _limit: limit,
  });

  if (error) {
    logger.warn('[ReliabilityServer] get_supplier_reliability_history failed', error);
    throw error;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    variantId: row.variant_id,
    slot: row.slot,
    promisedDate: row.promised_date,
    promisedQuantity: row.promised_quantity,
    resolution: row.resolution,
    actualDate: row.actual_date,
    actualQuantity: row.actual_quantity,
    delayDays: row.delay_days,
    fulfillmentRatio: row.fulfillment_ratio ? Number(row.fulfillment_ratio) : null,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  }));
}

export function useSupplierReliabilityHistory(
  supplierId: string | null | undefined,
  limit = 200,
) {
  return useQuery({
    queryKey: ['supplier-reliability-history', supplierId, limit],
    queryFn: () => fetchReliabilityHistory(supplierId!, limit),
    enabled: Boolean(supplierId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export type UseSupplierReliabilityServerResult = ReturnType<typeof useSupplierReliabilityServer>;
