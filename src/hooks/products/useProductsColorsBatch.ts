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
 * UUID v4 regex — filtra IDs mock/placeholder (ex: "mock-1") que causam
 * erro 400 no Supabase quando enviados em queries `.in()`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * BUG-4 FIX: Cache de módulo para evitar re-fetch quando a queryKey muda
 * parcialmente (novos produtos entram na lista sem invalidar os já carregados).
 *
 * ⚠️  ATENÇÃO — Invalidação de cache:
 * queryClient.invalidateQueries(['products-colors-batch']) re-executa o queryFn,
 * mas o queryFn vê missingIds.length === 0 e retorna do cache sem tocar o Supabase.
 * Para forçar re-fetch real (ex: após logout, refresh de catálogo), chame:
 *   clearColorsCache()
 * antes de invalidar a query.
 */
const GLOBAL_COLORS_CACHE = new Map<string, ProductColorDot[]>();

/**
 * Limpa o cache de módulo de cores. Deve ser chamado em:
 * - Logout do usuário
 * - Refresh forçado de catálogo
 * - Qualquer fluxo que precise de dados frescos do Supabase
 *
 * @example
 * clearColorsCache();
 * queryClient.invalidateQueries(['products-colors-batch']);
 */
export function clearColorsCache(): void {
  GLOBAL_COLORS_CACHE.clear();
}

/**
 * Retorna um Map<productId, ProductColorDot[]> para os productIds informados.
 * Ordena por nome e deduplica por (name|hex) lower-case.
 */
export function useProductsColorsBatch(productIds: string[]) {
  // Chave estável: ids únicos ordenados, filtrando mock/placeholder IDs
  const stableIds = useMemo(
    () => [...new Set(productIds)].filter((id) => UUID_RE.test(id)).sort(),
    [productIds],
  );
  // Query key que inclui os IDs específicos solicitados
  const queryKey = useMemo(() => ['products-colors-batch', stableIds], [stableIds]);

  const enabled = stableIds.length > 0;

  const query = useQuery({
    queryKey,
    queryFn: async ({ queryKey }): Promise<Map<string, ProductColorDot[]>> => {
      const [, ids] = queryKey as [string, string[]];

      // Identifica apenas o que ainda não temos no cache global
      const missingIds = ids.filter((id) => !GLOBAL_COLORS_CACHE.has(id));

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
            console.error(`[useProductsColorsBatch] Error fetching colors for chunk:`, error);
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

            let dedupMap = results.get(pid);
            if (!dedupMap) {
              dedupMap = new Map();
              results.set(pid, dedupMap);
            }
            if (!dedupMap.has(key)) {
              dedupMap.set(key, { name, hex });
            }
          }

          // Salva no cache global; IDs sem variantes ficam marcados como array vazio
          chunk.forEach((id) => {
            const productColors = results.get(id);
            const arr = productColors ? Array.from(productColors.values()) : [];
            arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            GLOBAL_COLORS_CACHE.set(id, arr);
          });
        }
      }

      // Constrói o Map final apenas com os IDs solicitados nesta query
      const resultMap = new Map<string, ProductColorDot[]>();
      ids.forEach((id) => {
        const cached = GLOBAL_COLORS_CACHE.get(id);
        if (cached) {
          resultMap.set(id, cached);
        }
      });

      return resultMap;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return useMemo(() => {
    const resultMap = new Map<string, ProductColorDot[]>();
    stableIds.forEach(id => {
      if (GLOBAL_COLORS_CACHE.has(id)) {
        resultMap.set(id, GLOBAL_COLORS_CACHE.get(id)!);
      }
    });
    return { 
      data: resultMap, 
      isLoading: query.isLoading,
      hasError: query.isError
    };
  }, [stableIds, query.isLoading, query.isError, query.data]);
}
