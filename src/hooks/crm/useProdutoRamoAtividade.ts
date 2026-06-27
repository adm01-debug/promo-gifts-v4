/**
 * useProdutoRamoAtividade — busca os ramos de atividade vinculados a um produto.
 * FIX-BRIDGE-01 (2026-06-01): migrated from supabase.functions.invoke to dbInvoke.
 */
import { useQuery } from '@tanstack/react-query';
import { dbInvoke } from '@/lib/db/postgrest';

export interface ProdutoRamo {
  ramo_id: string;
  ramo_nome: string;
  segmento_id?: string | null;
  segmento_nome?: string | null;
}

export function useProdutoRamoAtividade(productId: string | null | undefined) {
  return useQuery({
    queryKey: ['produto-ramo-atividade', productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProdutoRamo[]> => {
      const result = await dbInvoke<ProdutoRamo>({
        operation: 'select',
        table: 'produto_ramo_atividade',
        // FIX 2026-06-26: a coluna real e 'produto_id' (PT), nao 'product_id' -> evitava PostgREST 400/42703.
        filters: { produto_id: productId ?? '' },
      });
      return result.records || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
