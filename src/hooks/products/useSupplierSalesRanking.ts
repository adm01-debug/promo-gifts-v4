/**
 * Hook para ranking de vendas por fornecedor (dados reais do BD externo).
 * Consome mv_product_intelligence via RPC fn_get_product_intelligence_all()
 * para obter turnover_score e avg_depletion_7d de TODOS os produtos.
 * Cache de 10 minutos — dados de MV não mudam em tempo real.
 *
 * FIX BUG-A (2026-06-18): dbInvoke com limit:20000 usava PostgREST range()
 * e era silenciosamente truncado pelo max_rows=1000 do servidor, deixando
 * 6 243/7 243 produtos (86%) com turnover_score=0 → sort 'best-seller-supplier'
 * completamente quebrado. A RPC bypassa max_rows e retorna TODAS as 7 243 linhas.
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

interface ProductIntelligenceRanking {
  product_id: string;
  turnover_score: number;
  avg_depletion_7d: number;
  avg_depletion_30d: number;
  abc_classification: string;
  total_depleted_30d: number;
  total_depleted_90d: number;
}

export interface SupplierSalesEntry {
  turnoverScore: number;
  velocity7d: number;
  velocity30d: number;
  abcClass: string;
  depleted30d: number;
  depleted90d: number;
}

/**
 * Fetches supplier sales ranking via RPC fn_get_product_intelligence_all().
 * Returns a Map<productId, SupplierSalesEntry> for use in sorting.
 *
 * Replaces the previous dbInvoke approach that was capped at 1 000 rows by
 * PostgREST max_rows (Supabase default), leaving 6 243 products unranked.
 */
export function useSupplierSalesRanking() {
  return useQuery({
    queryKey: ['supplier-sales-ranking'],
    queryFn: async (): Promise<Map<string, SupplierSalesEntry>> => {
      try {
        // FIX BUG-A: usar RPC que retorna todas as 7 243+ linhas sem limite.
        // supabase.rpc() não é afetado por db-max-rows do PostgREST.
        // fn_get_product_intelligence_all é SECURITY DEFINER e não está nos tipos gerados.
        type AnyRpc = (fn: string) => ReturnType<typeof supabase.rpc>;
        const { data, error } = await (supabase.rpc as unknown as AnyRpc)(
          'fn_get_product_intelligence_all',
        );

        if (error) {
          const msg = (error as { message?: string }).message ?? '';
          if (
            msg.includes('not been populated') ||
            msg.includes('does not exist') ||
            msg.includes('não mapeada')
          ) {
            logger.warn('[SupplierSalesRanking] MV not populated yet, returning empty map');
            return new Map();
          }
          throw error;
        }

        const rows = (data ?? []) as unknown as ProductIntelligenceRanking[];
        const map = new Map<string, SupplierSalesEntry>();

        for (const row of rows) {
          if (!row.product_id) continue;
          map.set(row.product_id, {
            turnoverScore: row.turnover_score || 0,
            velocity7d: row.avg_depletion_7d || 0,
            velocity30d: row.avg_depletion_30d || 0,
            abcClass: row.abc_classification || 'C',
            depleted30d: row.total_depleted_30d || 0,
            depleted90d: row.total_depleted_90d || 0,
          });
        }

        logger.info(
          `[SupplierSalesRanking] Loaded ${map.size} products from mv_product_intelligence (RPC)`,
        );
        return map;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (
          msg.includes('not been populated') ||
          msg.includes('não mapeada') ||
          msg.includes('does not exist')
        ) {
          logger.warn('[SupplierSalesRanking] MV not populated yet, returning empty map');
          return new Map();
        }
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error: unknown) => {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('not been populated') || msg.includes('does not exist')) return false;
      return failureCount < 2;
    },
  });
}
