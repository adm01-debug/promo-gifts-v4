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
export function useProductsColorsBatch(productIds: string[]) {
  // Chave estável: ids ordenados (evita refetch quando a ordem do array muda)
  const stableIds = useMemo(() => [...new Set(productIds)].sort(), [productIds]);
  const enabled = stableIds.length > 0;

  const query = useQuery({
    queryKey: ['products-colors-batch', stableIds],
    queryFn: async ({ queryKey }): Promise<Map<string, ProductColorDot[]>> => {
      const [, ids] = queryKey as [string, string[]];
      const map = new Map<string, ProductColorDot[]>();
      if (ids.length === 0) return map;

      // Quebra em chunks p/ não estourar o limite de IN do PostgREST
      const CHUNK = 100;
      const seen = new Map<string, Set<string>>();

      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
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

        for (const row of (data ?? []) as VariantRow[]) {
          const pid = row.product_id;
          const name = (row.color_name || '').trim();
          if (!name) continue;
          const hex = row.color_hex?.trim() || null;
          const key = `${name.toLowerCase()}|${(hex || '').toLowerCase()}`;
          if (!seen.has(pid)) seen.set(pid, new Set());
          const dedup = seen.get(pid)!;
          if (dedup.has(key)) continue;
          dedup.add(key);
          const arr = map.get(pid) ?? [];
          arr.push({ name, hex });
          map.set(pid, arr);
        }
      }

      for (const arr of map.values()) {
        arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      }

      return map;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Aumentado para 10 min
    gcTime: 30 * 60 * 1000,    // Mantido por 30 min em memória
  });

  return { data: query.data, isLoading: query.isLoading };
}
