/**
 * useSupplierReliability — Hook orquestrador da aba "Confiabilidade de Fornecedores".
 *
 * Feature flag: localStorage 'supplierReliabilityServerSide' (default: 'true')
 *   - true  → lê de mv_supplier_reliability (server-side, Gold MV, eficiente)
 *   - false → fallback client-side (200k+ rows, legado, manter por 1 release)
 *
 * Implementação server-side: src/hooks/inventory/useSupplierReliabilityServer.ts
 *
 * A flag pode ser alterada em runtime via console:
 *   localStorage.setItem('supplierReliabilityServerSide', 'false') + reload
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
import {
  useSupplierReliabilityServer,
} from './useSupplierReliabilityServer';

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────────

function isServerSideEnabled(): boolean {
  try {
    const flag = typeof window !== 'undefined'
      ? window.localStorage.getItem('supplierReliabilityServerSide')
      : null;
    // Default: true. Desativar explicitamente com 'false'.
    return flag !== 'false';
  } catch {
    return true;
  }
}

const USE_SERVER_SIDE = isServerSideEnabled();

// ─────────────────────────────────────────────────────────────────────────────
// Path legado (client-side)
// ─────────────────────────────────────────────────────────────────────────────

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

function useSupplierReliabilityClientSide() {
  const query = useQuery({
    queryKey: ['supplier-reliability', 'v1'],
    queryFn: fetchRawReliability,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    // FIX: Não busca 200k+ rows quando o path server-side está ativo (default).
    // Ambos os hooks são sempre chamados (React Rules of Hooks), mas apenas
    // o hook do path ativo deve disparar fetches.
    // Sem este guard, o useMemo rodava aggregateReliability() → matchReplenishments()
    // → sort crash (d.id.localeCompare is not a function) mesmo com serverSide=true.
    enabled: !USE_SERVER_SIDE,
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
    dataSource: 'client' as const,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook público: roteia entre server-side e client-side via feature flag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper que seleciona o path server-side (padrão) ou client-side (fallback).
 * Ambos retornam a mesma forma de dados (SupplierReliability[]).
 *
 * Para forçar path legado em dev:
 *   localStorage.setItem('supplierReliabilityServerSide', 'false'); location.reload();
 * Para voltar ao server-side:
 *   localStorage.removeItem('supplierReliabilityServerSide'); location.reload();
 */
export function useSupplierReliability() {
  const serverHook = useSupplierReliabilityServer();
  const clientHook = useSupplierReliabilityClientSide();

  // React Rules of Hooks: ambos os hooks são sempre chamados.
  // A seleção acontece no retorno, não condicionalmente antes do call.
  if (USE_SERVER_SIDE) {
    return serverHook;
  }
  return clientHook;
}

export type UseSupplierReliabilityResult = ReturnType<typeof useSupplierReliability>;
