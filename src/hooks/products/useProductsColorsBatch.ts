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
import { resolveTable, handleQueryError } from '@/lib/supabase-direct';
import { untypedFrom } from '@/lib/supabase-untyped';

import { logger } from '@/lib/logger';
export interface ProductColorDot {
  name: string;
  hex: string | null;
  /** Imagem da variante (primary_image_url) — usada pelos cards para trocar a
   *  foto principal ao clicar no swatch (mini-carrossel de variantes). */
  image: string | null;
}

type VariantRow = {
  product_id: string;
  color_name: string | null;
  color_hex: string | null;
  selected_thumbnail: string | null;
  images: string[] | null;
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
    queryFn: async ({ queryKey: batchQueryKey }): Promise<Map<string, ProductColorDot[]>> => {
      const [, ids] = batchQueryKey as [string, string[]];

      // Identifica apenas o que ainda não temos no cache global
      const missingIds = ids.filter((id) => !GLOBAL_COLORS_CACHE.has(id));

      if (missingIds.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < missingIds.length; i += CHUNK) {
          const chunk = missingIds.slice(i, i + CHUNK);
          // BUGFIX (audit 200-commits, P1-1): pagina as variantes do chunk em vez de
          // depender de .range(0,4999). Com 100 produtos/chunk e db-max-rows (~1000),
          // o cap unico poderia truncar cores. A dedup por (nome|hex) abaixo torna a
          // paginacao estavel mesmo sem PK explicita.
          const PAGE = 1000;
          const MAX_PAGES = 50;
          let allRows: VariantRow[] = [];
          let chunkFailed = false;
          // HARDENING: avanca pelo nro real de linhas e para em pagina vazia.
          // Robusto a QUALQUER db-max-rows (medido = 1000), sem depender de PAGE == teto.
          let from = 0;
          for (let page = 0; page < MAX_PAGES; page += 1) {
            const { data, error } = await untypedFrom(resolveTable('product_variants'))
              .select('product_id, color_name, color_hex, selected_thumbnail, images')
              .in('product_id', chunk)
              .eq('is_active', true)
              .not('color_name', 'is', null)
              .order('product_id', { ascending: true })
              .order('color_name', { ascending: true })
              .order('color_hex', { ascending: true })
              .range(from, from + PAGE - 1);

            if (error) {
              logger.error(`[useProductsColorsBatch] Error fetching colors for chunk:`, error);
              handleQueryError('useProductsColorsBatch', 'product_variants', error);
              chunkFailed = true;
              break;
            }
            const rows = (data ?? []) as VariantRow[];
            allRows = allRows.concat(rows);
            from += rows.length;
            if (rows.length === 0) break;
          }
          if (chunkFailed) continue;

          // Agrupa resultados por ID
          const results = new Map<string, Map<string, ProductColorDot>>();

          for (const row of allRows) {
            const pid = row.product_id;
            const name = (row.color_name ?? '').trim();
            if (!name) continue;
            const hex = row.color_hex?.trim() || null;
            const image =
              row.selected_thumbnail?.trim() ||
              (Array.isArray(row.images) && row.images.length > 0 ? row.images[0] : null);
            const key = `${name.toLowerCase()}|${(hex ?? '').toLowerCase()}`;

            let dedupMap = results.get(pid);
            if (!dedupMap) {
              dedupMap = new Map();
              results.set(pid, dedupMap);
            }
            // Mantém a primeira ocorrência (já ordenada por color_name/color_hex),
            // mas se a primeira não tinha imagem e a próxima tem, preenche.
            const existing = dedupMap.get(key);
            if (!existing) {
              dedupMap.set(key, { name, hex, image });
            } else if (!existing.image && image) {
              dedupMap.set(key, { ...existing, image });
            }
          }

          // Salva no cache global; IDs sem variantes ficam marcados como array vazio
          chunk.forEach((id) => {
            const productColors = results.get(id);
            const arr = productColors ? [...productColors.values()] : [];
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
    for (const id of stableIds) {
      const cached = GLOBAL_COLORS_CACHE.get(id);
      if (cached) resultMap.set(id, cached);
    }
    return {
      data: resultMap,
      isLoading: query.isLoading,
      hasError: query.isError,
    };
    // query.data is intentionally included: it changes when the query completes,
    // which is what populates GLOBAL_COLORS_CACHE — we need to recompute then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableIds, query.isLoading, query.isError, query.data]);
}
