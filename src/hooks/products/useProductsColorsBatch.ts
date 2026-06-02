/**
 * useProductsColorsBatch — Carrega as cores disponíveis para um lote de produtos.
 *
 * Lê variantes ativas em `product_variants` (banco externo de catálogo) e
 * deduplica por nome de cor. Usado para mostrar swatches nas visualizações
 * (grid/lista/tabela) dos módulos que NÃO carregam cores no fetch principal
 * (Novidades, Reposição). Catálogo/Super Filtro/Estoque já trazem cores via
 * fetch enriquecido.
 *
 * Sem alterações de schema: apenas SELECT em tabelas existentes.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase, resolveTable, handleQueryError } from '@/lib/supabase-direct';

export interface ProductColorDot {
  name: string;
  hex: string | null;
}

type VariantRow = {
  product_id: string;
  color_name: string | null;
  color_hex: string | null;
};

/**
 * Retorna um Map<productId, ProductColorDot[]> para os productIds informados.
 * Ordena por nome e deduplica por (name|hex) lower-case.
 */
/**
 * Cache persistente fora do hook para evitar re-fetch de produtos individuais
 * mesmo quando a lista do lote muda parcialmente (e altera a queryKey).
 */
const GLOBAL_COLORS_CACHE = new Map<string, ProductColorDot[]>();

export function useProductsColorsBatch(productIds: string[]) {
  // Chave estável: ids ordenados (evita refetch quando a ordem do array muda)
  const stableIds = useMemo(() => [...new Set(productIds)].sort(), [productIds]);
  const enabled = stableIds.length > 0;

  const query = useQuery({
    queryKey: ['products-colors-batch', stableIds],
    queryFn: async ({ queryKey }): Promise<Map<string, ProductColorDot[]>> => {
      const [, ids] = queryKey as [string, string[]];
      
      // Identifica apenas o que ainda não temos no cache global
      const missingIds = ids.filter(id => !GLOBAL_COLORS_CACHE.has(id));
      
      if (missingIds.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < missingIds.length; i += CHUNK) {
          const chunk = missingIds.slice(i, i + CHUNK);
          const { data, error } = await supabase
            .from(resolveTable('product_variants'))
            .select('product_id, color_name, color_hex')
            .in('product_id', chunk)
            .eq('is_active', true)
            .not('color_name', 'is', null)
            .range(0, 4999);

          if (error) {
            handleQueryError('useProductsColorsBatch', 'product_variants', error);
            continue;
          }

          // Agrupa resultados por ID
          const results = new Map<string, Map<string, ProductColorDot>>();
          
          for (const row of (data ?? []) as VariantRow[]) {
            const pid = row.product_id;
            const name = (row.color_name || '').trim();
            if (!name) continue;
            const hex = row.color_hex?.trim() || null;
            const key = `${name.toLowerCase()}|${(hex || '').toLowerCase()}`;
            
            if (!results.has(pid)) results.set(pid, new Map());
            const dedupMap = results.get(pid)!;
            if (!dedupMap.has(key)) {
              dedupMap.set(key, { name, hex });
            }
          }

          // Salva no cache global garantindo que IDs sem variantes também fiquem marcados (como array vazio)
          chunk.forEach(id => {
            const productColors = results.get(id);
            const arr = productColors ? Array.from(productColors.values()) : [];
            arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            GLOBAL_COLORS_CACHE.set(id, arr);
          });
        }
      }

      // Constrói o Map final apenas com os IDs solicitados nesta query
      const resultMap = new Map<string, ProductColorDot[]>();
      ids.forEach(id => {
        if (GLOBAL_COLORS_CACHE.has(id)) {
          resultMap.set(id, GLOBAL_COLORS_CACHE.get(id)!);
        }
      });

      return resultMap;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return { data: query.data, isLoading: query.isLoading };
}
