/**
 * useProductsByColor — Server-side color filtering
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/lib/logger';

interface UseProductsByColorOptions {
  colorGroups: string[];
  colorVariations: string[];
  colorNuances: string[];
  colors: string[];
}

interface UseProductsByColorResult {
  productIds: Set<string>;
  hasFilter: boolean;
  isLoading: boolean;
}

export function useProductsByColor({
  colorGroups,
  colorVariations,
  colorNuances,
  colors,
}: UseProductsByColorOptions): UseProductsByColorResult {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const hasFilter = useMemo(
    () =>
      colorGroups.length > 0 ||
      colorVariations.length > 0 ||
      colorNuances.length > 0 ||
      colors.length > 0,
    [colorGroups.length, colorVariations.length, colorNuances.length, colors.length],
  );

  const filterKey = useMemo(
    () =>
      [...colorGroups].sort().join(',') +
      '|' +
      [...colorVariations].sort().join(',') +
      '|' +
      [...colorNuances].sort().join(',') +
      '|' +
      [...colors].sort().join(','),
    [colorGroups, colorVariations, colorNuances, colors],
  );

  const lastFetchedKey = useRef('');
  // fetchTokenRef: substitui isFetchingRef — cada chamada incrementa o token;
  // resultados de chamadas supersedidas sao descartados, eliminando a condicao de corrida
  // onde filtros rapidos A->B bloqueavam B (isFetchingRef=true) e mostravam o resultado
  // stale de A. Propriedade chave: somente o ultimo fetch em voo aplica setState.
  const fetchTokenRef = useRef(0);

  const fetchProductIds = useCallback(async () => {
    if (lastFetchedKey.current === filterKey) return;
    if (!hasFilter) {
      setProductIds(new Set());
      lastFetchedKey.current = '';
      return;
    }

    const token = ++fetchTokenRef.current;
    setIsLoading(true);

    try {
      const refQueries = [
        {
          table: 'color_groups',
          operation: 'select' as const,
          select: 'id, name, slug',
          filters: { is_active: true },
          limit: 200,
          offset: 0,
          cacheKey: 'ref:color_groups',
        },
        {
          table: 'color_variations',
          operation: 'select' as const,
          select: 'id, name, slug, group_id, nuance_id',
          filters: { is_active: true },
          limit: 500,
          offset: 0,
          cacheKey: 'ref:color_variations',
        },
        {
          table: 'color_nuances',
          operation: 'select' as const,
          select: 'id, name, slug',
          filters: { is_active: true },
          limit: 500,
          offset: 0,
          cacheKey: 'ref:color_nuances',
        },
      ];

      const refResults = await Promise.all(refQueries.map((q) => dbInvoke(q)));
      if (token !== fetchTokenRef.current) return; // superseded

      const groupsData = (refResults[0]?.records ?? []) as Record<string, unknown>[];
      const variationsData = (refResults[1]?.records ?? []) as Record<string, unknown>[];

      const groupsBySlug = new Map(groupsData.map((g) => [g.slug as string, g.id as string]));
      const variationsBySlug = new Map(variationsData.map((v) => [v.slug as string, v]));

      const targetColorIds = new Set<string>();
      for (const slug of colorVariations) {
        const v = variationsBySlug.get(slug);
        if (v) targetColorIds.add(v.id as string);
      }
      for (const slug of colorGroups) {
        const gid = groupsBySlug.get(slug);
        if (gid)
          for (const v of variationsData)
            if ((v as Record<string, unknown>).group_id === gid)
              targetColorIds.add((v as Record<string, unknown>).id as string);
      }
      for (const colorName of colors) {
        const lower = colorName.toLowerCase();
        for (const v of variationsData)
          if (((v as Record<string, unknown>).name as string)?.toLowerCase() === lower)
            targetColorIds.add((v as Record<string, unknown>).id as string);
      }

      // FIX-NUANCE (2026-06-18): resolve nuances (color_nuances.slug) via
      // color_variations.nuance_id -> variation ids -> product_variants.color_id.
      // Antes, colorNuances era IGNORADO: nuance sozinha zerava (targetColorIds vazio)
      // e nuance combinada era silenciosamente descartada. Semantica OR (uniao),
      // consistente com group/variation/color dentro do mesmo bloco de cor.
      if (colorNuances.length > 0) {
        const nuancesData = (refResults[2]?.records ?? []) as Record<string, unknown>[];
        const nuanceIdBySlug = new Map(nuancesData.map((n) => [n.slug as string, n.id as string]));
        const targetNuanceIds = new Set<string>();
        for (const slug of colorNuances) {
          const nid = nuanceIdBySlug.get(slug);
          if (nid) targetNuanceIds.add(nid);
        }
        for (const v of variationsData) {
          const nid = (v as Record<string, unknown>).nuance_id as string | null;
          if (nid && targetNuanceIds.has(nid))
            targetColorIds.add((v as Record<string, unknown>).id as string);
        }
      }

      if (targetColorIds.size === 0) {
        if (token !== fetchTokenRef.current) return; // superseded
        setProductIds(new Set());
        lastFetchedKey.current = filterKey;
        return;
      }

      const colorIdArray = [...targetColorIds];
      const matchingProductIds = new Set<string>();

      if (colorIdArray.length > 0) {
        const CHUNK = 50;
        for (let i = 0; i < colorIdArray.length; i += CHUNK) {
          const chunk = colorIdArray.slice(i, i + CHUNK);
          const variantQueries = [
            {
              table: 'product_variants',
              operation: 'select' as const,
              select: 'product_id',
              filters: { is_active: true, color_id: chunk },
              limit: 5000,
              offset: 0,
            },
          ];

          const variantResults = await Promise.all(variantQueries.map((q) => dbInvoke(q)));
          // FIX-CATALOG-01: dbInvoke returns InvokeResult { records, count }, not BatchResult { success, data }
          if (variantResults[0]?.records) {
            for (const r of variantResults[0].records as Array<{ product_id: string }>) {
              matchingProductIds.add(r.product_id);
            }
          }
        }
      }

      if (token !== fetchTokenRef.current) return; // superseded
      setProductIds(matchingProductIds);
      lastFetchedKey.current = filterKey;
      logger.log(
        `[useProductsByColor] Found ${matchingProductIds.size} products for ${colorIdArray.length} color IDs`,
      );
    } catch (err) {
      if (token !== fetchTokenRef.current) return; // superseded
      logger.error('[useProductsByColor] Critical Error:', err);
      setProductIds(new Set());
    } finally {
      if (token === fetchTokenRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, hasFilter]);

  useEffect(() => {
    if (filterKey !== lastFetchedKey.current || !hasFilter) fetchProductIds();
  }, [filterKey, hasFilter, fetchProductIds]);

  return { productIds, hasFilter, isLoading };
}
