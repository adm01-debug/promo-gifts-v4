/**
 * useProdutoRamoAtividade — busca os ramos de atividade vinculados a um produto.
 * Consulta o banco externo Promobrind via external-db-bridge (SSOT).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoRamo {
  ramo_id: string;
  ramo_nome: string;
  segmento_id?: string | null;
  segmento_nome?: string | null;
}

export function useProdutoRamoAtividade(productId: string | null | undefined) {
  return useQuery({
    queryKey: ["produto-ramo-atividade", productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProdutoRamo[]> => {
      const { data, error } = await supabase.functions.invoke("external-db-bridge", {
        body: {
          operation: "select",
          table: "produto_ramo_atividade",
          filters: { product_id: productId },
        },
      });
      if (error) throw error;
      return (data?.rows || []) as ProdutoRamo[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
