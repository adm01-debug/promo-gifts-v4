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
 * HARDENING (2026-07-17 — incidente 403 mv_stock_velocity):
 * O batch falhava e retornava SEM semear o cache, então cada card disparava sua
 * própria query e o N+1 ressuscitava — justamente sob falha, o pior momento.
 * Agora, em erro permanente (403/404), o cache é sempre semeado, contendo o dano
 * a 1 request em vez de ~N×4.
 *
 * Uso — chamar UMA VEZ no componente pai da listagem:
 *   const productIds = useMemo(() => products.map(p => p.id), [products]);
 *   useStockVelocityPrefetch(productIds);
 *
 * @see src/hooks/intelligence/useStockHistory.ts — useStockVelocity individual
 * @see src/components/products/ProductGrid.tsx — consumer principal
 * @see src/lib/db-retry.ts — política de retry compartilhada
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StockVelocity } from './useStockHistory';
import { isPermanentDbError, makeDbQueryRetry } from '@/lib/db-retry';
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

/** Agrupa as linhas do batch por product_id. */
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

/**
 * Semeia o cache individual de cada product_id solicitado.
 *
 * `overwriteMissing` decide o que fazer com produto que NÃO veio no batch:
 *  - `true`  (batch completo e bem-sucedido): ausência é verdade — grava [] mesmo
 *    por cima de dado antigo, senão o card exibe badge obsoleto indefinidamente.
 *  - `false` (batch abortado por erro): ausência pode ser só falta de dado. Só
 *    preenche onde o cache está frio, para não destruir resultado bom de um
 *    batch anterior numa falha parcial de paginação.
 */
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
          if (isPermanentDbError(error)) {
            // 403/404 não melhora tentando de novo — e cada card tentaria o mesmo
            // erro por conta própria. Sela o cache com o que já veio, contendo o
            // estrago em 1 request em vez de N × tentativas.
            seedCache(queryClient, productIds, groupByProduct(all), { overwriteMissing: false });
            logger.warn(
              `[StockVelocityPrefetch] Erro permanente, cache selado (N+1 contido): ${error.message}`,
            );
            return all;
          }
          // Transitório: não sela — deixa os hooks individuais retentarem.
          logger.warn(`[StockVelocityPrefetch] Falha transitória no batch: ${error.message}`);
          return all;
        }
        if (data) all.push(...(data as unknown as StockVelocity[]));
      }

      // Popula cache individual para cada product_id solicitado.
      // - Produtos COM dados: injeta o array de StockVelocity[]
      // - Produtos SEM dados (não aparecem na MV): injeta [] para evitar
      //   que o hook individual dispare request resultando em 0 linhas.
      seedCache(queryClient, productIds, groupByProduct(all), { overwriteMissing: true });

      logger.log(
        `[StockVelocityPrefetch] Batch OK: ${all.length} linhas para ${productIds.length} produtos`,
      );
      return all;
    },
    enabled,
    staleTime: 30 * 60 * 1000, // Alinhado com useStockVelocity individual
    // Best-effort: 2 tentativas em falha transitória, nenhuma em erro permanente.
    retry: makeDbQueryRetry(2),
  });
}
