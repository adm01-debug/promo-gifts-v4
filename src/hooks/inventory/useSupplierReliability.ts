/**
 * useSupplierReliability — Hook orquestrador da aba "Confiabilidade de Fornecedores".
 *
 * Lê 3 fontes do BD Ouro canônico (doufsxqlfjyuvxuezpln):
 *   1. variant_supplier_sources → promessas (next_date_N / next_quantity_N)
 *   2. stock_snapshots          → chegadas reais (delta positivo)
 *   3. v_suppliers_public       → metadata dos fornecedores
 *
 * Roda a agregação pura (lib/inventory/supplier-reliability) e devolve dados
 * prontos para a UI. Janelas de leitura:
 *   - Promessas: TODAS as ativas (passadas + futuras), para parear histórico
 *   - Chegadas: últimos 180 dias (cobre 6× a janela de retenção típica)
 *
 * Cache: staleTime 5min — dados de fornecedor mudam por hora, não por segundo.
 * Tolerante a falha: cada query individual cai para [] se falhar, sem derrubar a tela.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  aggregateReliability,
  extractArrivals,
  extractPromises,
  type SnapshotRow,
  type SourceRow,
  type SupplierMeta,
} from '@/lib/inventory/supplier-reliability';
import { fetchPaginatedFromBridge } from '@/hooks/stock/stockFetcher';
import { logger } from '@/lib/logger';

const SOURCE_COLS =
  'id,variant_id,supplier_id,updated_at,' +
  'next_quantity_1,next_date_1,next_quantity_2,next_date_2,' +
  'next_quantity_3,next_date_3,next_quantity_4,next_date_4,' +
  'next_quantity_5,next_date_5,next_quantity_6,next_date_6';

const SNAPSHOT_COLS =
  'id,variant_supplier_source_id,supplier_id,variant_id,' +
  'stock_main_old,stock_main_new,stock_other_old,stock_other_new,' +
  'change_type,captured_at';

const SUPPLIER_COLS = 'id,name';

const SNAPSHOT_WINDOW_DAYS = 180;

interface RawData {
  sources: SourceRow[];
  snapshots: SnapshotRow[];
  suppliers: SupplierMeta[];
}

async function fetchRawReliability(): Promise<RawData> {
  const cutoff = new Date(Date.now() - SNAPSHOT_WINDOW_DAYS * 86_400_000).toISOString();
  const [sources, snapshots, suppliers] = await Promise.all([
    fetchPaginatedFromBridge<SourceRow & { id: string }>(
      'variant_supplier_sources',
      SOURCE_COLS,
      1000,
      100_000,
      { is_active: true },
    ).catch((err) => {
      logger.warn('[Reliability] sources fetch failed', err);
      return [] as Array<SourceRow & { id: string }>;
    }),
    fetchPaginatedFromBridge<SnapshotRow & { id: string }>(
      'stock_snapshots',
      SNAPSHOT_COLS,
      1000,
      200_000,
    )
      .then((rows) => rows.filter((r) => (r.captured_at ?? '') >= cutoff))
      .catch((err) => {
        logger.warn('[Reliability] snapshots fetch failed', err);
        return [] as Array<SnapshotRow & { id: string }>;
      }),
    fetchPaginatedFromBridge<{ id: string; name: string }>(
      'suppliers',
      SUPPLIER_COLS,
      1000,
      10_000,
    ).catch((err) => {
      logger.warn('[Reliability] suppliers fetch failed', err);
      return [] as Array<{ id: string; name: string }>;
    }),
  ]);
  return { sources, snapshots, suppliers };
}

export function useSupplierReliability() {
  const query = useQuery({
    queryKey: ['supplier-reliability', 'v1'],
    queryFn: fetchRawReliability,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const aggregated = useMemo(() => {
    if (!query.data) return null;
    const promises = extractPromises(query.data.sources);
    const arrivals = extractArrivals(query.data.snapshots);
    return aggregateReliability({
      promises,
      arrivals,
      suppliers: query.data.suppliers,
    });
  }, [query.data]);

  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    suppliers: aggregated?.bySupplier ?? [],
    matching: aggregated?.matching ?? null,
    rawCounts: query.data
      ? {
          sources: query.data.sources.length,
          snapshots: query.data.snapshots.length,
          suppliers: query.data.suppliers.length,
        }
      : null,
  };
}

export type UseSupplierReliabilityResult = ReturnType<typeof useSupplierReliability>;
