/**
 * useStockVelocityPrefetch
 *
 * ANTI N+1 FIX + HARDENING v2:
 * seedCache agora distingue sucesso vs falha via `overwriteMissing`:
 *  - sucesso (batch completo): ausência é verdade → grava [] por cima do antigo
 *  - falha (batch abortado): ausência é incerteza → só preenche cache frio
 *
 * @see src/lib/db-retry.ts — política de retry compartilhada
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StockVelocity } from './useStockHistory';
import { isPermanentDbError, makeDbQueryRetry } from '@/lib/db-retry';
import { logger } from '@/lib/logger';

const CHUNK_SIZE = 100;

const SELECT_COLS =
  'variant_supplier_source_id,supplier_id,product_id,variant_id,' +
  'current_stock,avg_daily_depletion_7d,avg_daily_depletion_30d,' +
  'avg_daily_depletion_90d,velocity_trend,days_to_stockout,' +
  'total_depleted_7d,total_depleted_30d,total_depleted_90d,' +
  'total_restocked_30d,restock_events_30d,avg_days_between_restocks,' +
  'price_changes_30d,active_days_7d,active_days_30d,active_days_90d';

function batchKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

function groupByProduct(rows: StockVelocity[]): Map<string, StockVelocity[]> {
  const byProduct = new Map<string, StockVelocity[]>();
  for (const row of rows) {
    if (!row.product_id) continue;
    const arr = byProduct.get(row.product_id) ?? [];
    arr.push(row);
    byProduct.set(row.product_id, arr);
  }
  return byProduct;
}

function seedCache(
  queryClient: QueryClient,
  productIds: string[],
  byProduct: Map<string, StockVelocity[]>,
  { overwriteMissing }: { overwriteMissing: boolean },
): void {
  for (const pid of productIds) {
    const velocities = byProduct.get(pid);
    if (velocities !== undefined) {
      queryClient.setQueryData(['stock-velocity', pid], velocities);
      continue;
    }
    if (overwriteMissing || queryClient.getQueryData(['stock-velocity', pid]) === undefined) {
      queryClient.setQueryData(['stock-velocity', pid], []);
    }
  }
}

export function useStockVelocityPrefetch(productIds: string[]): void {
  const queryClient = useQueryClient();
  const enabled = productIds.length > 0;

  useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['stock-velocity-batch', batchKey(productIds)],
    queryFn: async (): Promise<StockVelocity[]> => {
      const all: StockVelocity[] = [];

      for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
        const chunk = productIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('mv_stock_velocity')
          .select(SELECT_COLS)
          .in('product_id', chunk);

        if (error) {
          if (isPermanentDbError(error)) {
            seedCache(queryClient, productIds, groupByProduct(all), { overwriteMissing: false });
            logger.warn(
              `[StockVelocityPrefetch] Erro permanente, cache selado (N+1 contido): ${error.message}`,
            );
            return all;
          }
          logger.warn(`[StockVelocityPrefetch] Falha transitória no batch: ${error.message}`);
          return all;
        }
        if (data) all.push(...(data as unknown as StockVelocity[]));
      }

      seedCache(queryClient, productIds, groupByProduct(all), { overwriteMissing: true });

      logger.log(
        `[StockVelocityPrefetch] Batch OK: ${all.length} linhas para ${productIds.length} produtos`,
      );
      return all;
    },
    enabled,
    staleTime: 30 * 60 * 1000,
    retry: makeDbQueryRetry(2),
  });
}
