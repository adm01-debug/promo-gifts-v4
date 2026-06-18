import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Ranking de "mais vendidos internamente" (por volume em orçamentos Promo).
 * Shared entre Catálogo e Super Filtro.
 *
 * PERF-PROMO-01 (2026-06-18, audit-10-10):
 * Versão anterior fazia SELECT * de quote_items sem filtro algum — scan
 * completo da tabela (potencialmente 100k+ linhas) com todo o payload
 * transmitido ao browser para ser agregado em JS. Em produção escalada,
 * isso se tornaria inaceitável.
 *
 * Versão atual usa a RPC get_promo_sales_ranking() que:
 *   - Faz o SUM(quantity) GROUP BY product_id server-side
 *   - Filtra apenas orçamentos não-rascunho (status IN approved/pending/...)
 *   - Retorna apenas {product_id, total_qty} — payload mínimo
 *   - Fallback gracioso: erro → Map vazio (catálogo funciona sem ranking)
 */
export function usePromoSalesRanking() {
  return useQuery({
    queryKey: ['promo-sales-ranking-v2'],
    queryFn: async (): Promise<Map<string, number>> => {
      try {
        const { data, error } = await (supabase as unknown as {
          rpc: (name: string) => Promise<{ data: unknown; error: unknown }>;
        }).rpc('get_promo_sales_ranking');

        if (error) {
          logger.warn('[PromoSalesRanking] RPC error, returning empty map:', error);
          return new Map();
        }

        const rows = (data as Array<{ product_id: string; total_qty: number }> | null) ?? [];
        const map = new Map<string, number>();
        for (const row of rows) {
          if (row.product_id) {
            map.set(row.product_id, Number(row.total_qty) || 0);
          }
        }

        logger.info(`[PromoSalesRanking] Loaded ${map.size} products from RPC`);
        return map;
      } catch (err) {
        logger.warn('[PromoSalesRanking] Exception, returning empty map:', err);
        return new Map();
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: false, // Falha silenciosa — catálogo funciona sem ranking
  });
}
