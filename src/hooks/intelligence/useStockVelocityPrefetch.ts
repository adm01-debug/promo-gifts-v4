/**
 * useStockVelocityPrefetch
 *
 * ANTI N+1 FIX (2026-07-17):
 * `useStockVelocity(productId)` é chamado dentro de cada `ProductCard` via
 * `useProductIntelligenceBadges`. Em listagens com 20+ produtos isso gera
 * 20+ queries independentes `mv_stock_velocity?product_id=eq.{id}`.
 *
 * Esta hook faz UMA única query batch `product_id=in.(id1,...,idN)` e popula
 * o React Query cache individualmente via `queryClient.setQueryData`.
 * As chamadas individuais nos cards encontram seus dados no cache sem disparar
 * novos requests. Acréscimo zero ao bundle dos cards (hook só existe no parent).
 *
 * Uso — chamar UMA VEZ no componente pai da listagem:
 *   const productIds = useMemo(() => products.map(p => p.id), [products]);
 *   useStockVelocityPrefetch(productIds);
 *
 * @see src/hooks/intelligence/useStockHistory.ts — useStockVelocity individual
 * @see src/components/products/ProductGrid.tsx — consumer principal
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StockVelocity } from './useStockHistory';
import { logger } from '@/lib/logger';

/** Máximo de product_ids por request (URL safety: 100 UUIDs ≈ 3600 chars). */
const CHUNK_SIZE = 100;

/** Colunas mínimas para o badge — evita buscar dados pesados desnecessários. */
const SELECT_COLS =
  'variant_supplier_source_id,supplier_id,product_id,variant_id,' +
  'current_stock,avg_daily_depletion_7d,avg_daily_depletion_30d,' +
  'avg_daily_depletion_90d,velocity_trend,days_to_stockout,' +
  'total_depleted_7d,total_depleted_30d,total_depleted_90d,' +
  'total_restocked_30d,restock_events_30d,avg_days_between_restocks,' +
  'price_changes_30d,active_days_7d,active_days_30d,active_days_90d';

/**
 * Produz chave determinística e estável para o React Query.
 * Ordena os IDs para evitar cache miss quando a ordem muda entre renders.
 */
function batchKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

export function useStockVelocityPrefetch(productIds: string[]): void {
  const queryClient = useQueryClient();
  const enabled = productIds.length > 0;

  useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['stock-velocity-batch', batchKey(productIds)],
    queryFn: async (): Promise<StockVelocity[]> => {
      const all: StockVelocity[] = [];

      // Chunk para manter URL abaixo de 8KB (CHUNK_SIZE UUIDs ≈ 3.6KB)
      for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
        const chunk = productIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('mv_stock_velocity')
          .select(SELECT_COLS)
          .in('product_id', chunk);

        if (error) {
          // Log mas não lança — o prefetch é best-effort. Os hooks individuais
          // tratarão seus próprios erros se necessário.
          logger.warn('[StockVelocityPrefetch] Falha no batch:', error.message);
          return all;
        }
        if (data) all.push(...(data as unknown as StockVelocity[]));
      }

      // Agrupar resultados por product_id
      const byProduct = new Map<string, StockVelocity[]>();
      for (const row of all) {
        if (!row.product_id) continue;
        const arr = byProduct.get(row.product_id) ?? [];
        arr.push(row);
        byProduct.set(row.product_id, arr);
      }

      // Popula cache individual para cada product_id solicitado.
      // - Produtos COM dados: injeta o array de StockVelocity[]
      // - Produtos SEM dados (não aparecem na MV): injeta [] para evitar
      //   que o hook individual dispare request resultando em 0 linhas.
      for (const pid of productIds) {
        const velocities = byProduct.get(pid) ?? [];
        queryClient.setQueryData(['stock-velocity', pid], velocities);
      }

      logger.log(
        `[StockVelocityPrefetch] Batch OK: ${all.length} linhas para ${productIds.length} produtos`,
      );
      return all;
    },
    enabled,
    staleTime: 30 * 60 * 1000, // Alinhado com useStockVelocity individual
    // Não retry agressivo — se a MV não existe/está vazia, é esperado
    retry: 1,
  });
}
