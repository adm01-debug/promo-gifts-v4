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
      `${[...colorGroups].sort().join(',')}|${[...colorVariations].sort().join(',')}|${[
        ...colorNuances,
      ]
        .sort()
        .join(',')}|${[...colors].sort().join(',')}`,
    [colorGroups, colorVariations, colorNuances, colors],
  );

  const lastFetchedKey = useRef('');
  const isFetchingRef = useRef(false);

  const fetchProductIds = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (lastFetchedKey.current === filterKey) return;
    if (!hasFilter) {
      setProductIds(new Set());
      lastFetchedKey.current = '';
      return;
    }

    isFetchingRef.current = true;
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
          select: 'id, name, slug, group_id',
          filters: { is_active: true },
          limit: 500,
          offset: 0,
          cacheKey: 'ref:color_variations',
        },
      ];

      const refResults = await Promise.all(refQueries.map((q) => dbInvoke(q)));

      const groupsData = (refResults[0]?.records ?? []) as Array<Record<string, unknown>>;
      const variationsData = (refResults[1]?.records ?? []) as Array<Record<string, unknown>>;

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
            if (v.group_id === gid) targetColorIds.add(v.id as string);
      }
      for (const colorName of colors) {
        const lower = colorName.toLowerCase();
        for (const v of variationsData)
          if ((v.name as string)?.toLowerCase() === lower) targetColorIds.add(v.id as string);
      }

      if (targetColorIds.size === 0 && colorNuances.length === 0) {
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

      setProductIds(matchingProductIds);
      lastFetchedKey.current = filterKey;
      logger.log(
        `[useProductsByColor] Found ${matchingProductIds.size} products for ${colorIdArray.length} color IDs`,
      );
    } catch (err) {
      logger.error('[useProductsByColor] Critical Error:', err);
      setProductIds(new Set());
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, hasFilter]);

  useEffect(() => {
    if (filterKey !== lastFetchedKey.current || !hasFilter) fetchProductIds();
  }, [filterKey, hasFilter, fetchProductIds]);

  return { productIds, hasFilter, isLoading };
}
