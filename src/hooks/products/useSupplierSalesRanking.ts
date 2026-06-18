/**
 * Hook para ranking de vendas por fornecedor (dados reais do BD).
 *
 * FIX BUG-A (2026-06-18): dbInvoke com limit:20000 usava PostgREST range()
 * truncado silenciosamente pelo max_rows=1000 do servidor. Resultado: 6 243/7 243
 * produtos (86%) com turnover_score=0 → sort 'best-seller-supplier' quebrado.
 * Corrigido via RPC fn_get_product_intelligence_all() que bypassa max_rows.
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

export function useSupplierSalesRanking() {
  return useQuery({
    queryKey: ['supplier-sales-ranking'],
    queryFn: async (): Promise<Map<string, SupplierSalesEntry>> => {
      try {
        // FIX BUG-A: RPC bypassa db-max-rows=1000, retorna todas as 7 243 linhas.
        const { data, error } = await supabase.rpc('fn_get_product_intelligence_all');
        if (error) {
          const msg = error.message ?? '';
          if (msg.includes('not been populated') || msg.includes('does not exist') || msg.includes('não mapeada')) {
            logger.warn('[SupplierSalesRanking] MV not populated yet, returning empty map');
            return new Map();
          }
          throw error;
        }
        const rows = (data ?? []) as ProductIntelligenceRanking[];
        const map = new Map<string, SupplierSalesEntry>();
        for (const row of rows) {
          if (!row.product_id) continue;
          map.set(row.product_id, {
            turnoverScore: row.turnover_score    || 0,
            velocity7d:    row.avg_depletion_7d  || 0,
            velocity30d:   row.avg_depletion_30d || 0,
            abcClass:      row.abc_classification || 'C',
            depleted30d:   row.total_depleted_30d || 0,
            depleted90d:   row.total_depleted_90d || 0,
          });
        }
        logger.info(`[SupplierSalesRanking] Loaded ${map.size} products from mv_product_intelligence (RPC)`);
        return map;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('not been populated') || msg.includes('não mapeada') || msg.includes('does not exist')) {
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
